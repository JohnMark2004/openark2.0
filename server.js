// server.js (CommonJS)
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const gTTS = require("gtts");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ✅ Gemini import MUST come before it's used
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const staticLibrarians = [
  { email: "librarian1@gmail.com", password: "lib123", username: "Librarian 1" },
  { email: "librarian2@gmail.com", password: "lib123", username: "Librarian 2" },
  { email: "librarian3@gmail.com", password: "lib123", username: "Librarian 3" },
];

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ensure uploads folder
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "https://openark2-0.onrender.com",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// static serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// http + socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "https://openark2-0.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -------------------- helpers --------------------
function authenticateMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function addActivity({ user = "System", action, details = "" }) {
  try {
    await db.collection("activities").add({
      user,
      action,
      details,
      date: new Date(),
    });
  } catch (err) {
    console.error("Failed to add activity:", err);
  }
}

// NOTE: you must implement sendApprovalEmail elsewhere (or replace with your mailer)
async function sendApprovalEmail(user) {
  // simple placeholder - replace with your mailer implementation
  console.log("sendApprovalEmail called for:", user.email);
  // Example: use nodemailer / Brevo / Mailersend here
  return;
}

// -------------------- OCR using Gemini (image inlineData) --------------------
app.post("/api/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

    const result = await gemini.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType } },
            { text: "Extract all readable text from this image clearly and accurately." },
          ],
        },
      ],
    });

    const text = result.response.text();
    res.json({ text });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ error: "OCR failed" });
  }
});

// -------------------- multer --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage });

// -------------------- Signup (Firestore) --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password, collegeYear } = req.body;

    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });

    // Save extra info in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      username,
      email,
      collegeYear,
      role: "student",
      active: false, // wait for admin approval
      profilePic: "assets/default-pfp.jpg",
      createdAt: new Date(),
    });

    res.json({
      message: "Signup successful. Please verify your email and wait for admin approval.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message });
  }
});


// -------------------- Login (static librarians/admins + Firestore students) --------------------
// -------------------- Login (admin + Firebase users) --------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Step 1: Check if admin login
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      return res.json({
        message: "Admin login successful",
        role: "admin",
        username: "Administrator",
        email,
        token: "admin-token",
      });
    }

    // ✅ Step 1.5: Check for static librarian login
const librarian = staticLibrarians.find(
  (lib) => lib.email === email && lib.password === password
);
if (librarian) {
  return res.json({
    message: "Librarian login successful",
    role: "librarian",
    username: librarian.username,
    email: librarian.email,
    token: "librarian-token",
  });
}


    // ✅ Step 2: Regular Firebase user login
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const data = await response.json();
    if (data.error) return res.status(401).json({ error: "Invalid credentials" });

    // ✅ Step 3: Check Firestore record for approval
    const userSnap = await db.collection("users").where("email", "==", email).get();
    if (userSnap.empty) return res.status(404).json({ error: "User not found" });

    const user = userSnap.docs[0].data();
    if (!user.active)
      return res.status(403).json({ error: "Your account is pending admin approval." });

    res.json({
      message: "Login successful",
      token: data.idToken,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// -------------------- Approve user (protected) --------------------
app.put("/api/users/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const user = userDoc.data();
    if (user.active) return res.status(400).json({ error: "Already approved" });

    await userRef.update({ active: true });

    res.json({ message: `${user.username} has been approved.` });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// -------------------- Get users (admin) --------------------
app.get("/api/users", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });

    const usersSnap = await db.collection("users").get();
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data(), password: undefined }));
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// -------------------- Update user active (admin) --------------------
app.put("/api/users/:id", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
    const { active } = req.body;
    const id = req.params.id;
    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    await userRef.update({ active });
    res.json({ message: `User ${active ? "activated" : "deactivated"} successfully` });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// -------------------- Delete user (admin) --------------------
app.delete("/api/users/:id", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });

    const id = req.params.id;
    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();
    await userRef.delete();

    await db.collection("activities").add({
      user: "Admin",
      action: "Deleted User",
      details: `Removed account: ${user.username} (${user.email})`,
      date: new Date(),
    });

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// -------------------- Upload profile pic (students only) --------------------
app.post("/api/upload-profile-pic", upload.single("profilePic"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRef = db.collection("users").doc(decoded.id);
    const userDoc = await userRef.get();

    // handle static librarians (not in DB)
    if (!userDoc.exists && decoded.role === "librarian") {
      const uploadedUrl = `/uploads/${req.file.filename}`;
      return res.json({ message: "Profile picture updated", profilePic: uploadedUrl });
    }
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const user = userDoc.data();
    if (user.role === "librarian") return res.status(403).json({ error: "Librarians cannot change profile picture" });

    // upload to cloudinary if configured
    let imageUrl = `/uploads/${req.file.filename}`;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const uploadRes = await cloudinary.uploader.upload(req.file.path, { folder: "profile_pics" });
      imageUrl = uploadRes.secure_url;
      fs.unlinkSync(req.file.path);
    }

    await userRef.update({ profilePic: imageUrl });
    res.json({ message: "Profile picture updated", profilePic: imageUrl });
  } catch (err) {
    console.error("Profile pic upload error:", err);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
});

// -------------------- Book routes --------------------
// helper: uploadToCloudinary
const uploadToCloudinary = (filePath, folder) => cloudinary.uploader.upload(filePath, { folder, resource_type: "image" });

// add new book (librarian)
app.post(
  "/api/books",
  (req, res, next) => {
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "pages" }])(req, res, function (err) {
      if (err) return res.status(400).json({ error: "File upload error: " + err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing token" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== "librarian") return res.status(403).json({ error: "Forbidden" });

      const { title, author, publisher, year, category, description, pageTexts } = req.body;

      // normalize categories
      let parsedCategories = [];
      try {
        parsedCategories = JSON.parse(category);
      } catch {
        parsedCategories = Array.isArray(category) ? category : (category || "").split(",").map((c) => c.trim());
      }
      parsedCategories = parsedCategories.filter((c) => c && c.trim() !== "").map((c) => c.trim());
      parsedCategories = [...new Set(parsedCategories)];

      // cover upload
      let coverUrl = "";
      if (req.files?.cover && req.files.cover[0]) {
        const result = await uploadToCloudinary(req.files.cover[0].path, "openark/covers");
        coverUrl = result.secure_url;
        try { fs.unlinkSync(req.files.cover[0].path); } catch(_) {}
      }

      // page texts
      let texts = [];
      try {
        texts = JSON.parse(pageTexts || "[]");
      } catch {
        texts = [];
      }

      // pages upload
      const pageUrls = [];
      for (let i = 0; i < (req.files.pages || []).length; i++) {
        const file = req.files.pages[i];
        const result = await uploadToCloudinary(file.path, "openark/pages");
        pageUrls.push({
          img: result.secure_url,
          text: texts[i] || "",
        });
        try { fs.unlinkSync(file.path); } catch(_) {}
      }

      // create book doc
      const bookData = {
        title: title?.trim() || "",
        author: author?.trim() || "",
        publisher: publisher?.trim() || "",
        year: Number(year) || null,
        category: parsedCategories,
        description: description?.trim() || "",
        img: coverUrl || "img/default-book.png",
        pages: pageUrls,
        createdAt: new Date(),
      };
      const bookRef = await db.collection("books").add(bookData);

      await db.collection("activities").add({
        user: "Librarian",
        action: "Added Book",
        details: `Added "${bookData.title}" by ${bookData.author}`,
        date: new Date(),
      });

      await updateReport();

      res.status(201).json({ id: bookRef.id, ...bookData });
    } catch (err) {
      console.error("Error creating book:", err);
      res.status(500).json({ error: "Failed to create book: " + err.message });
    }
  }
);

// get all books
app.get("/api/books", async (req, res) => {
  try {
    const booksSnap = await db.collection("books").get();
    const books = booksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(books);
  } catch (err) {
    console.error("Fetch books error:", err);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// get single book
app.get("/api/books/:id", async (req, res) => {
  try {
    const doc = await db.collection("books").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Book not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error("Fetch book error:", err);
    res.status(500).json({ error: "Failed to load book" });
  }
});

// delete book (librarian or admin)
app.delete("/api/books/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "librarian" && decoded.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const bookRef = db.collection("books").doc(req.params.id);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) return res.status(404).json({ error: "Book not found" });
    const book = bookDoc.data();

    await bookRef.delete();
    await db.collection("activities").add({
      user: decoded.role === "admin" ? "Admin" : "Librarian",
      action: "Deleted Book",
      details: `Removed "${book.title}" by ${book.author}`,
      date: new Date(),
    });

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// add pages to book (librarian)
app.post("/api/books/:id/add-pages", upload.array("pages"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "librarian") return res.status(403).json({ error: "Forbidden" });

    const bookRef = db.collection("books").doc(req.params.id);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) return res.status(404).json({ error: "Book not found" });

    let texts = [];
    try {
      texts = JSON.parse(req.body.pageTexts || "[]");
    } catch {
      texts = [];
    }

    const uploadedPages = [];
    for (let i = 0; i < (req.files || []).length; i++) {
      const file = req.files[i];
      const r = await cloudinary.uploader.upload(file.path, { folder: "openark/pages" });
      uploadedPages.push({ img: r.secure_url, text: texts[i] || "" });
      try { fs.unlinkSync(file.path); } catch(_) {}
    }

    const current = bookDoc.data().pages || [];
    await bookRef.update({ pages: [...current, ...uploadedPages] });

    res.json({ message: "New pages added", pages: uploadedPages });
  } catch (err) {
    console.error("Add pages error:", err);
    res.status(500).json({ error: "Failed to add pages" });
  }
});

// update page text (librarian)
app.patch("/api/books/:bookId/pages/:pageIndex", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "librarian") return res.status(403).json({ error: "Forbidden" });

    const { bookId, pageIndex } = req.params;
    const { newText } = req.body;
    const bookRef = db.collection("books").doc(bookId);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) return res.status(404).json({ error: "Book not found" });

    const pages = bookDoc.data().pages || [];
    const idx = parseInt(pageIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= pages.length) return res.status(400).json({ error: "Invalid page index" });

    pages[idx].text = newText;
    await bookRef.update({ pages });
    res.json({ message: "Page text updated" });
  } catch (err) {
    console.error("Update page text error:", err);
    res.status(500).json({ error: "Failed to update page text" });
  }
});

// -------------------- Comments (subcollection under books) --------------------
// add comment
app.post("/api/books/:id/comments", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRef = db.collection("users").doc(decoded.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    const bookRef = db.collection("books").doc(req.params.id);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) return res.status(404).json({ error: "Book not found" });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Empty comment" });

    const commentRef = await bookRef.collection("comments").add({
      authorId: decoded.id,
      text: text.trim(),
      createdAt: new Date(),
    });

    const commentDoc = await commentRef.get();
    const payload = {
      id: commentDoc.id,
      text: commentDoc.data().text,
      createdAt: commentDoc.data().createdAt,
      author: {
        id: decoded.id,
        username: user.username,
        profilePic: user.profilePic,
        role: user.role || "student",
      },
    };

    // broadcast to room named by book id
    broadcastComment(req.params.id, "new", payload);

    res.json({ message: "Comment saved", comment: payload });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// get comments
app.get("/api/books/:id/comments", async (req, res) => {
  try {
    const bookRef = db.collection("books").doc(req.params.id);
    const bookDoc = await bookRef.get();
    if (!bookDoc.exists) return res.status(404).json({ error: "Book not found" });

    const commentsSnap = await bookRef.collection("comments").orderBy("createdAt", "desc").get();
    const comments = await Promise.all(
      commentsSnap.docs.map(async (d) => {
        const c = d.data();
        const authorRef = db.collection("users").doc(c.authorId);
        const authorDoc = await authorRef.get();
        const author = authorDoc.exists ? authorDoc.data() : { username: "Unknown", profilePic: "" };
        return {
          id: d.id,
          text: c.text,
          createdAt: c.createdAt,
          author: {
            id: c.authorId,
            username: author.username,
            profilePic: author.profilePic,
            role: author.role || "student",
          },
        };
      })
    );

    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

// delete comment (author or librarian)
app.delete("/api/comments/:bookId/:commentId", authenticateMiddleware, async (req, res) => {
  try {
    const { bookId, commentId } = req.params;
    const decoded = req.user;
    const userRef = db.collection("users").doc(decoded.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    const commentRef = db.collection("books").doc(bookId).collection("comments").doc(commentId);
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) return res.status(404).json({ error: "Comment not found" });
    const c = commentDoc.data();

    if (c.authorId !== decoded.id && user.role !== "librarian") return res.status(403).json({ error: "Forbidden" });

    await commentRef.delete();
    broadcastComment(bookId, "delete", { id: commentId });

    res.json({ message: "Comment deleted", commentId });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// -------------------- Genres --------------------
app.get("/api/genres", async (req, res) => {
  try {
    const booksSnap = await db.collection("books").get();
    const allCats = [];
    booksSnap.docs.forEach((d) => {
      const data = d.data();
      if (Array.isArray(data.category)) allCats.push(...data.category);
      else if (data.category) allCats.push(data.category);
    });
    const genres = [...new Set(allCats.map((g) => (g || "").trim()).filter(Boolean))];
    res.json(genres);
  } catch (err) {
    console.error("Fetch genres error:", err);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

// -------------------- Bookmarks --------------------
app.post("/api/bookmarks/:bookId", authenticateMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    const userRef = db.collection("users").doc(req.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    const bookmarks = user.bookmarks || [];
    if (bookmarks.includes(bookId)) return res.status(400).json({ error: "Book already bookmarked" });

    bookmarks.push(bookId);
    await userRef.update({ bookmarks });
    res.json({ message: "Book added to bookmarks" });
  } catch (err) {
    console.error("Add bookmark error:", err);
    res.status(500).json({ error: "Failed to add bookmark" });
  }
});

app.delete("/api/bookmarks/:bookId", authenticateMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    const userRef = db.collection("users").doc(req.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const bookmarks = (userDoc.data().bookmarks || []).filter((b) => b !== bookId);
    await userRef.update({ bookmarks });
    res.json({ message: "Book removed from bookmarks" });
  } catch (err) {
    console.error("Remove bookmark error:", err);
    res.status(500).json({ error: "Failed to remove bookmark" });
  }
});

app.get("/api/bookmarks", authenticateMiddleware, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const bookmarks = userDoc.data().bookmarks || [];
    // fetch book details for each (optional)
    const books = [];
    for (const bId of bookmarks) {
      const bDoc = await db.collection("books").doc(bId).get();
      if (bDoc.exists) books.push({ id: bDoc.id, ...bDoc.data() });
    }
    res.json(books);
  } catch (err) {
    console.error("Fetch bookmarks error:", err);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// -------------------- Continue reading --------------------
app.post("/api/continue", authenticateMiddleware, async (req, res) => {
  try {
    const { bookId, lastPage } = req.body;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const userRef = db.collection("users").doc(req.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const ur = userDoc.data();
    const existing = (ur.continueReading || []).find((c) => c.bookId === bookId);

    let continueReading = ur.continueReading || [];
    if (existing) {
      continueReading = continueReading.map((c) => (c.bookId === bookId ? { ...c, lastPage: lastPage || c.lastPage, updatedAt: new Date() } : c));
    } else {
      continueReading.push({ bookId, lastPage: lastPage || 1, updatedAt: new Date() });
    }

    await userRef.update({ continueReading });
    res.json({ message: "Progress saved" });
  } catch (err) {
    console.error("Continue save error:", err);
    res.status(500).json({ error: "Failed to save progress" });
  }
});

app.get("/api/continue", authenticateMiddleware, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const continueReading = userDoc.data().continueReading || [];
    // fetch book details
    const books = [];
    for (const c of continueReading.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))) {
      const bDoc = await db.collection("books").doc(c.bookId).get();
      if (bDoc.exists) {
        const data = bDoc.data();
        books.push({
          _id: bDoc.id,
          title: data.title,
          author: data.author,
          img: data.img,
          category: data.category,
          description: data.description,
          lastPage: c.lastPage,
        });
      }
    }
    res.json(books);
  } catch (err) {
    console.error("Continue fetch error:", err);
    res.status(500).json({ error: "Failed to fetch continue reading" });
  }
});

// -------------------- TTS --------------------
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "No text provided" });

    const filename = `uploads/tts-${Date.now()}.mp3`;
    const gtts = new gTTS(text, "en");
    gtts.save(path.join(__dirname, filename), (err) => {
      if (err) {
        console.error("gTTS Error:", err);
        return res.status(500).json({ error: "Failed to generate speech" });
      }
      res.json({ url: `/${filename}` });
    });
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: "TTS failed" });
  }
});

// -------------------- Gemini outline --------------------
app.post("/api/gemini-outline", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "No OCR text provided" });

    const prompt = `
You are an academic assistant. Read the following OCR text and create an outline for a PowerPoint presentation.

Guidelines:
- Add Introduction and Conclusion slides.
- Each slide should have a clear title.
- Use concise bullet points (no full sentences).
- Avoid overly technical jargon;
- Ensure logical flow between slides.
- Focus on key concepts and main ideas.
- Create 5–8 slide titles.
- Under each slide title, list 2–4 bullet points.
- Keep the tone professional and concise.

Text:
${text}
`;

    const result = await gemini.generateContent(prompt);
    const outline = result.response.text();

    await db.collection("activities").add({
      user: "Librarian",
      action: "Generated Gemini Outline",
      details: "Created PowerPoint outline from OCR text",
      date: new Date(),
    });

    res.json({ outline });
  } catch (err) {
    console.error("Gemini outline error:", err);
    res.status(500).json({ error: "Failed to generate PPT outline" });
  }
});

// -------------------- Socket.io helpers --------------------
function broadcastComment(bookId, type, payload) {
  io.to(bookId.toString()).emit("commentUpdate", { type, payload });
}
function broadcastUserStatus(userId, isActive) {
  io.emit("userStatusChange", { userId, active: isActive });
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("registerUser", async (userId) => {
    if (!userId) return;
    socket.userId = userId;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists && userDoc.data().active) {
        broadcastUserStatus(userId, true);
      }
    } catch (err) {
      console.error("registerUser error:", err);
    }
  });

  socket.on("disconnect", async () => {
    if (!socket.userId) return;
    try {
      const userRef = db.collection("users").doc(socket.userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await userRef.update({ active: false });
        broadcastUserStatus(socket.userId, false);
      }
      console.log("Disconnected:", socket.userId);
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  });

  socket.on("userLoggedOut", async (userId) => {
    try {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await userRef.update({ active: false });
        broadcastUserStatus(userId, false);
      }
    } catch (err) {
      console.error("userLoggedOut error:", err);
    }
  });
});

// -------------------- Activity logs --------------------
app.get("/api/activity", async (req, res) => {
  try {
    const snap = await db.collection("activities").orderBy("date", "desc").limit(10).get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(logs);
  } catch (err) {
    console.error("Fetch activity error:", err);
    res.status(500).json({ error: "Failed to load activity logs" });
  }
});

// -------------------- Report summary --------------------
app.get("/api/report-summary", async (req, res) => {
  try {
    const usersSnap = await db.collection("users").get();
    const booksSnap = await db.collection("books").get();

    // top category
    const categoryCount = {};
    booksSnap.docs.forEach((d) => {
      const cats = Array.isArray(d.data().category) ? d.data().category : [d.data().category].filter(Boolean);
      cats.forEach((c) => {
        if (!c) return;
        categoryCount[c] = (categoryCount[c] || 0) + 1;
      });
    });
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // top book (heuristic: most pages)
    let topBook = "N/A";
    if (!booksSnap.empty) {
      let max = null;
      booksSnap.docs.forEach((d) => {
        const data = d.data();
        if (!max || (data.pages || []).length > (max.pages || []).length) max = data;
      });
      if (max) topBook = `${max.title} (${(max.pages || []).length} pages)`;
    }

    res.json({ totalUsers: usersSnap.size, totalBooks: booksSnap.size, topCategory, topBook });
  } catch (err) {
    console.error("Report summary error:", err);
    res.status(500).json({ error: "Failed to load report summary" });
  }
});

// -------------------- API fallback & frontend routes --------------------
app.use(/^\/api(\/|$)/, (req, res) => res.status(404).json({ error: "API route not found" }));

app.get(["/intro.html", "/admin.html", "/dashboard.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", req.path));
});
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
});

// -------------------- start server --------------------
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
