// ===============================
// server.js (CommonJS syntax)
// ===============================

require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

// ✅ Gemini import MUST come before it's used
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ Now safely create the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

const app = express();

// ===============================
// Middleware
// ===============================
app.use(
  cors({
    origin: [
      "http://localhost:5500",   // VS Code Live Server
      "http://127.0.0.1:5500",
      "http://localhost:3000",   // optional for React/Vite
      "https://openark2-0.onrender.com" // deployed domain
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ===============================
// Serve static files
// ===============================
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // uploaded book images
app.use(express.static(path.join(__dirname, "public"))); // frontend (HTML/CSS/JS)

// ===============================
// MongoDB Setup
// ===============================
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Failed:", err));

// ===============================
// Schemas
// ===============================
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  collegeYear: String,
  role: { type: String, enum: ["student", "librarian"], default: "student" },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
    continueReading: [
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
      lastPage: { type: Number, default: 1 },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  profilePic: { type: String, default: "assets/default-pfp.jpg" }
});
const User = mongoose.model("User", userSchema);

const pageSchema = new mongoose.Schema({
  img: String,
  text: String,
});

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  publisher: { type: String, required: true },
  year: { type: Number, required: true },
  category: { type: [String], required: true },
  img: { type: String, default: "img/default-book.png" },
  description: { type: String, default: "" },
  pages: [pageSchema],
});
const Book = mongoose.model("Book", bookSchema);

// ---- Comments: schema and routes ----
// add this after bookSchema (or near other schemas)
const commentSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Comment = mongoose.model("Comment", commentSchema);

app.post("/api/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    const result = await gemini.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: { data: imageBase64, mimeType },
            },
            {
              text: "Extract all readable text from this image clearly and accurately.",
            },
          ],
        },
      ],
    });

    const text = result.response.text();
    res.json({ text });
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ error: "OCR failed" });
  }
});

// POST a comment to a book (authenticated)
app.post("/api/books/:id/comments", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Empty comment" });

    const comment = new Comment({
      bookId: book._id,
      authorId: user._id,
      text: text.trim(),
    });
    await comment.save();

    const populated = await Comment.findById(comment._id).populate({
      path: "authorId",
      select: "username profilePic role",
    });

    // ✅ broadcast AFTER populate
    broadcastComment(book._id, "new", {
      _id: populated._id,
      text: populated.text,
      createdAt: populated.createdAt,
      author: {
        _id: populated.authorId._id,
        username: populated.authorId.username,
        profilePic: populated.authorId.profilePic,
        role: populated.authorId.role,
      },
    });

    res.json({
      message: "Comment saved",
      comment: {
        _id: populated._id,
        text: populated.text,
        createdAt: populated.createdAt,
        author: {
          _id: populated.authorId._id,
          username: populated.authorId.username,
          profilePic: populated.authorId.profilePic,
          role: populated.authorId.role,
        },
      },
    });
  } catch (err) {
    console.error("❌ Add comment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});


// GET comments for a book (sorted newest first)
app.get("/api/books/:id/comments", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const comments = await Comment.find({ bookId: book._id })
      .sort({ createdAt: -1 })
      .populate({ path: "authorId", select: "username profilePic role" });

    const payload = comments.map(c => ({
      _id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      author: {
        _id: c.authorId._id,
        username: c.authorId.username,
        profilePic: c.authorId.profilePic,
        role: c.authorId.role,
      },
    }));

    res.json(payload);
  } catch (err) {
    console.error("❌ Get comments error:", err);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

// DELETE a comment (only author or librarian)
app.delete("/api/comments/:commentId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const comment = await Comment.findById(req.params.commentId).populate("authorId");
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    // allow deletion if requester is comment author OR librarian
    if (comment.authorId._id.toString() !== user._id.toString() && user.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await Comment.deleteOne({ _id: comment._id });
    broadcastComment(comment.bookId, "delete", { _id: comment._id });
    res.json({ message: "Comment deleted", commentId: comment._id });
  } catch (err) {
    console.error("❌ Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ===============================
// Get Single Book by ID
// ===============================
app.get("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(book);
  } catch (err) {
    console.error("❌ Fetch book by ID error:", err);
    res.status(500).json({ error: "Failed to load book" });
  }
});


// ===============================
// Multer Setup
// ===============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ===============================
// User Routes
// ===============================
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password, collegeYear } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      collegeYear,
      role: "student",
    });
    await newUser.save();

    res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

// ===============================
// Librarian Login (Static Librarians)
// ===============================
const staticLibrarians = [
  { email: "librarian1@gmail.com", password: "libpass1", username: "Librarian 1" },
  { email: "librarian2@gmail.com", password: "libpass2", username: "Librarian 2" },
  { email: "librarian3@gmail.com", password: "libpass3", username: "Librarian 3" },
  { email: "librarian4@gmail.com", password: "libpass4", username: "Librarian 4" },
  { email: "librarian5@gmail.com", password: "libpass5", username: "Librarian 5" },
];

const matchedLibrarian = staticLibrarians.find(
  (lib) => lib.email === email && lib.password === password
);

if (matchedLibrarian) {
  const index = staticLibrarians.indexOf(matchedLibrarian);

  // 🧩 Local librarian profile images (non-changeable)
  const librarianImages = [
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
  ];

  // ensure librarian exists in DB (so comments/bookmarks work)
  let librarianUser = await User.findOne({ email: matchedLibrarian.email });
  if (!librarianUser) {
    librarianUser = new User({
      username: matchedLibrarian.username,
      email: matchedLibrarian.email,
      password: await bcrypt.hash(matchedLibrarian.password, 10),
      role: "librarian",
      collegeYear: "N/A",
      profilePic: librarianImages[index], // ✅ fixed image in DB
    });
    await librarianUser.save();
  } else if (librarianUser.profilePic !== librarianImages[index]) {
    // update pic if not matching
    librarianUser.profilePic = librarianImages[index];
    await librarianUser.save();
  }

  const token = jwt.sign(
    { id: librarianUser._id, role: "librarian", email: matchedLibrarian.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.json({
    message: "Login successful",
    token,
    _id: librarianUser._id,
    role: "librarian",
    email: librarianUser.email,
    username: librarianUser.username,
    profilePic: librarianUser.profilePic, // ✅ send correct local image
  });
}


    // Otherwise, check student in DB
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: "student", email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      _id: user._id,
      role: "student",
      email: user.email,
      username: user.username,
      collegeYear: user.collegeYear,
      profilePic: user.profilePic,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ===============================
// Upload Profile Picture (Students only)
// ===============================
app.post("/api/upload-profile-pic", upload.single("profilePic"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ❌ Librarians cannot upload
    if (user.role === "librarian") {
      return res.status(403).json({ error: "Librarians cannot change profile picture" });
    }

    // ✅ Students upload normally
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "openark/profile_pics",
    });
    fs.unlinkSync(req.file.path);

    user.profilePic = result.secure_url;
    await user.save();

    res.json({ message: "Profile picture updated", profilePic: result.secure_url });
  } catch (err) {
    console.error("❌ Profile pic upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===============================
// Book Routes
// ===============================
const uploadToCloudinary = (filePath, folder) => {
  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
  });
};

app.post(
  "/api/books",
  (req, res, next) => {
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "pages" }])(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: "File upload error: " + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      // 🔒 Librarian token check
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing token" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== "librarian") return res.status(403).json({ error: "Forbidden" });

      const { title, author, publisher, year, category, description, pageTexts } = req.body;

      // ✅ Normalize category into array
// ✅ Normalize categories (always an array of unique, trimmed strings)
let parsedCategories = [];
try {
  parsedCategories = JSON.parse(category); // frontend sends JSON string
} catch {
  parsedCategories = Array.isArray(category)
    ? category
    : category.split(",").map(c => c.trim());
}

// Clean: remove empty, trim, unique
parsedCategories = parsedCategories
  .filter(c => c && c.trim() !== "")
  .map(c => c.trim())
  .filter((c, i, arr) => arr.indexOf(c) === i);

      // ✅ Upload cover to Cloudinary
      let coverUrl = "";
      if (req.files?.cover) {
        const result = await uploadToCloudinary(req.files.cover[0].path, "openark/covers");
        coverUrl = result.secure_url;
      }

      // ✅ Handle page OCR texts
      let texts = [];
      try {
        texts = JSON.parse(pageTexts || "[]");
      } catch {
        texts = [];
      }

      // ✅ Upload pages to Cloudinary
      const pageUrls = [];
      for (let i = 0; i < (req.files.pages || []).length; i++) {
        const file = req.files.pages[i];
        const result = await uploadToCloudinary(file.path, "openark/pages");
        pageUrls.push({
          img: result.secure_url,
          text: texts[i] || "",
        });
      }

      // ✅ Create new Book
      const newBook = new Book({
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        year: Number(year),
        category: parsedCategories,   // always array
        description: description?.trim() || "",
        img: coverUrl || "img/default-book.png",
        pages: pageUrls,
      });

      await newBook.save();
      res.status(201).json(newBook);
    } catch (err) {
      console.error("❌ Error creating book:", err);
      res.status(500).json({ error: "Failed to create book: " + err.message });
    }
  }
);

app.delete("/api/books/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (decoded.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden: Only librarians can delete books" });
    }

    const deleted = await Book.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Book not found" });

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting book:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/genres", async (req, res) => {
  try {
    let genres = await Book.distinct("category");

    // ✅ Clean up: remove empty/null, trim spaces, unique only
    genres = genres
      .filter(g => g && g.trim() !== "")   // remove empty/null
      .map(g => g.trim())                  // trim spaces
      .filter((g, i, arr) => arr.indexOf(g) === i); // unique only

    res.json(genres);
  } catch (err) {
    console.error("❌ Error fetching genres:", err);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});


app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// ===============================
// Bookmark Routes
// ===============================
app.post("/api/bookmarks/:bookId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ error: "Invalid book ID" });

    if (user.bookmarks.includes(bookId)) {
      return res.status(400).json({ error: "Book already bookmarked" });
    }

    user.bookmarks.push(bookId);
    await user.save();

    res.json({ message: "Book added to bookmarks" });
  } catch (err) {
    console.error("❌ Add bookmark error:", err);
    res.status(500).json({ error: "Failed to add bookmark" });
  }
});

app.delete("/api/bookmarks/:bookId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.bookmarks = user.bookmarks.filter(
      (b) => b.toString() !== req.params.bookId
    );
    await user.save();

    res.json({ message: "Book removed from bookmarks" });
  } catch (err) {
    console.error("❌ Remove bookmark error:", err);
    res.status(500).json({ error: "Failed to remove bookmark" });
  }
});

app.get("/api/bookmarks", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).populate("bookmarks");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.bookmarks);
  } catch (err) {
    console.error("❌ Fetch bookmarks error:", err);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// ===============================
// Continue Reading Routes
// ===============================
app.post("/api/continue", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { bookId, lastPage } = req.body;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = user.continueReading.find(
      (c) => c.bookId.toString() === bookId
    );

    if (existing) {
      existing.lastPage = lastPage || existing.lastPage;
      existing.updatedAt = Date.now();
    } else {
      user.continueReading.push({ bookId, lastPage: lastPage || 1 });
    }

    await user.save();
    res.json({ message: "Progress saved" });
  } catch (err) {
    console.error("❌ Continue save error:", err);
    res.status(500).json({ error: "Failed to save progress" });
  }
});

app.get("/api/continue", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).populate({
      path: "continueReading.bookId",
      model: "Book",
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const books = user.continueReading
      .filter((c) => c.bookId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({
        _id: c.bookId._id,
        title: c.bookId.title,
        author: c.bookId.author,
        img: c.bookId.img,
        category: c.bookId.category,
        description: c.bookId.description,
        lastPage: c.lastPage,
      }));

    res.json(books);
  } catch (err) {
    console.error("❌ Continue fetch error:", err);
    res.status(500).json({ error: "Failed to fetch continue reading" });
  }
});

// ===============================
// Add more pages to existing book (Librarian only)
// ===============================
app.post(
  "/api/books/:id/add-pages",
  upload.array("pages"),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing token" });
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== "librarian")
        return res.status(403).json({ error: "Forbidden" });

      const book = await Book.findById(req.params.id);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const { pageTexts } = req.body;
      let texts = [];
      try {
        texts = JSON.parse(pageTexts || "[]");
      } catch {
        texts = [];
      }

      const uploadedPages = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "openark/pages",
        });
        uploadedPages.push({
          img: result.secure_url,
          text: texts[i] || "",
        });
      }

      book.pages.push(...uploadedPages);
      await book.save();

      res.json({ message: "✅ New pages added successfully", pages: uploadedPages });
    } catch (err) {
      console.error("❌ Add pages failed:", err);
      res.status(500).json({ error: "Failed to add pages" });
    }
  }
);

// ===============================
// Update specific page text (Librarian only)
// ===============================
app.patch("/api/books/:bookId/pages/:pageIndex", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "librarian")
      return res.status(403).json({ error: "Forbidden" });

    const { bookId, pageIndex } = req.params;
    const { newText } = req.body;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const index = parseInt(pageIndex, 10);
    if (isNaN(index) || index < 0 || index >= book.pages.length) {
      return res.status(400).json({ error: "Invalid page index" });
    }

    book.pages[index].text = newText;
    await book.save();

    res.json({ message: "✅ Page text updated successfully" });
  } catch (err) {
    console.error("❌ Update page text failed:", err);
    res.status(500).json({ error: "Failed to update page text" });
  }
});


// ===============================
// API Fallback (must come after all /api routes)
// ===============================
app.use(/^\/api(\/|$)/, (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// ===============================
// Frontend Routes (catch-all)
// ===============================
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
});

// ===============================
// Profile Picture Upload (Student + Librarian)
// ===============================
app.post("/api/uploadProfilePic", upload.single("profilePic"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Librarians may not exist in DB, so handle both
    let user = await User.findById(decoded.id);

    // Static librarian handling (not saved in DB)
    const staticLibrarians = [
      "librarian1@gmail.com",
      "librarian2@gmail.com",
      "librarian3@gmail.com",
      "librarian4@gmail.com",
      "librarian5@gmail.com",
    ];

    if (!user && decoded.role === "librarian") {
      // Fake librarian record (not persisted)
      const uploadedUrl = `/uploads/${req.file.filename}`;
      return res.json({
        message: "Profile picture updated",
        profilePic: uploadedUrl,
      });
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    // Upload to Cloudinary (optional, if configured)
    let imageUrl = `/uploads/${req.file.filename}`;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const uploadRes = await cloudinary.uploader.upload(req.file.path, {
        folder: "profile_pics",
      });
      imageUrl = uploadRes.secure_url;
      fs.unlinkSync(req.file.path); // remove local temp
    }

    user.profilePic = imageUrl;
    await user.save();

    res.json({ message: "Profile picture updated", profilePic: imageUrl });
  } catch (err) {
    console.error("❌ Profile pic upload error:", err);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
});


// ===============================
// Start Server
// ===============================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "https://openark2-0.onrender.com"
    ],
    methods: ["GET", "POST", "DELETE"],
  },
});

// Socket.IO connection listener
io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  // join a room for each book (so we broadcast only to relevant book viewers)
  socket.on("joinBookRoom", (bookId) => {
    socket.join(bookId);
    console.log(`📚 socket ${socket.id} joined book room: ${bookId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected:", socket.id);
  });
});

// Helper: broadcast new or deleted comment
function broadcastComment(bookId, type, payload) {
  io.to(bookId.toString()).emit("commentUpdate", { type, payload });
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));