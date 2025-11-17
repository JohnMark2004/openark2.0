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
const gTTS = require('gtts');
const crypto = require('crypto');
const { sendPendingEmail, sendApprovalEmail, sendPasswordResetEmail } = require("./emailService");
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
// HTTP & Socket.IO Server Setup
// ===============================
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5500",   // VS Code Live Server
      "http://127.0.0.1:5500",
      "http://localhost:3000",   // React/Vite local
      "https://openark2-0.onrender.com" // deployed domain
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ===============================
// ✅ Authentication Middleware
// ===============================
function authenticateMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Missing authorization header" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.put("/api/users/approve/:id", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.active) return res.status(200).json({ message: "User already active" }); // ✅ fixed

    user.active = true;
    await user.save();

  // ✅ *** ADD THIS BLOCK: Send Approval Email ***
   sendApprovalEmail(user.email, user.username).catch(err => {
      console.error(`Failed to send approval email to ${user.email} via Gmail API:`, err);
});

    await Activity.create({
      user: "Admin",
      action: "Approved User",
      details: `${user.username} (${user.email})`,
    });

// ✅ *** MODIFY THIS LINE: Update success message ***
    res.json({ message: "User approved successfully" });
  } catch (err) {
    console.error("Approve user error:", err);
    res.status(500).json({ error: "Failed to approve user" });
  }
});

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
  role: { type: String, enum: ["student", "librarian", "admin"], default: "student" },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
    continueReading: [
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
      lastPage: { type: Number, default: 1 },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  profilePic: { type: String, default: "assets/default-pfp.jpg" },
  active: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date

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
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

const Book = mongoose.model("Book", bookSchema);

// ===============================
// 📚 GET ALL DISTINCT CATEGORIES
// ===============================
// ===============================
// 📚 GET ALL DISTINCT CATEGORIES (Static + Dynamic Merge)
// ===============================
app.get("/api/genres", async (req, res) => {
  try {
    // 🧱 Static base genres (always shown)
    const staticGenres = [
      "Accountancy",
      "Criminology",
      "Computer Science",
      "Engineering",
      "Commerce",
      "Maritime",
      "Mass Communication",
      "Political Science",
      "Psychology",
      "Aviation",
      "Fiction",
      "Filipiana",
      "General Education",
      "Senior High"
    ];

    // 🧠 Get distinct categories from DB
    const dbGenres = await Book.distinct("category");

    // Handle nested arrays, trim spaces, remove empties
    const flatDbGenres = dbGenres
      .flatMap(g => (Array.isArray(g) ? g : [g]))
      .map(g => g.trim())
      .filter(g => g);

    // Combine static + dynamic, remove duplicates, sort alphabetically
    const combined = [...new Set([...staticGenres, ...flatDbGenres])].sort((a, b) =>
      a.localeCompare(b)
    );

    res.json(combined);
  } catch (err) {
    console.error("❌ Failed to load genres:", err);
    res.status(500).json({ error: "Failed to load genres" });
  }
});



// ---- Comments: schema and routes ----
// add this after bookSchema (or near other schemas)
const commentSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Comment = mongoose.model("Comment", commentSchema);

// ===============================
// 📄 ACTIVITY LOG MODEL
// ===============================
const activitySchema = new mongoose.Schema({
  user: { type: String, required: true }, // username or role
  action: { type: String, required: true }, // e.g. "Added Book", "Deleted User"
  details: { type: String },
  date: { type: Date, default: Date.now },
});

const Activity = mongoose.model("Activity", activitySchema);

// ===============================
// 📊 REPORT MODEL
// ===============================
const reportSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  totalBooks: { type: Number, default: 0 },
  topCategory: { type: String, default: "N/A" },
  topBook: { type: String, default: "N/A" },
  lastUpdated: { type: Date, default: Date.now },
});

const Report = mongoose.model("Report", reportSchema);

// ===============================
// 📈 REPORT AUTO-UPDATER
// ===============================
async function updateReport() {
  try {
    const usersCount = await User.countDocuments();
    const books = await Book.find();

    // Count category frequency
    const categoryCount = {};
    books.forEach(b => {
      const cats = Array.isArray(b.category) ? b.category : [b.category];
      cats.forEach(c => {
        if (c) categoryCount[c] = (categoryCount[c] || 0) + 1;
      });
    });

    // Find top category
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

    // Find "top book" by number of pages (as a simple metric)
    const topBook =
      books.length > 0
        ? books.reduce((max, b) => (b.pages.length > max.pages.length ? b : max))
        : null;

    await Report.findOneAndUpdate(
      {},
      {
        totalUsers: usersCount,
        totalBooks: books.length,
        topCategory: topCategory ? topCategory[0] : "N/A",
        topBook: topBook ? topBook.title : "N/A",
        lastUpdated: Date.now(),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("❌ Failed to update report:", err);
  }
}



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
// ✅ EDIT BOOK DESCRIPTION (Librarian only)
// ===============================
app.patch("/api/books/:bookId/description", authenticateMiddleware, async (req, res) => {
    try {
        // 1. Authorization: Only librarians can edit
        if (req.user.role !== "librarian") {
            return res.status(403).json({ error: "Forbidden: Librarians only" });
        }

        const { bookId } = req.params;
        const { newDescription } = req.body;

        // 2. Find the book in the database
        const book = await Book.findById(bookId);
        if (!book) {
            return res.status(404).json({ error: "Book not found" });
        }

        // 3. Update the description and save it
        book.description = newDescription.trim();
        await book.save();

        // 4. Log this important action
        await Activity.create({
            user: "Librarian", 
            action: "Edited Book Description",
            details: `Updated description for book "${book.title}"`,
        });

        // 5. Send a success response
        res.json({ message: "Description updated successfully", book });

    } catch (err) {
        console.error("❌ Update description failed:", err);
        res.status(500).json({ error: "Failed to update description" });
    }
});

// ✅ ADD THIS NEW ROUTE: GET ALL ARCHIVED BOOKS (Admin/Librarian only)
app.get("/api/books/archived", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const books = await Book.find({ isArchived: true });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch archived books" });
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

// ✅ ADD THIS NEW ROUTE: ARCHIVE A BOOK (Admin/Librarian only)
app.patch("/api/books/:id/archive", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const book = await Book.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!book) return res.status(404).json({ error: "Book not found" });

    await Activity.create({
      user: req.user.role === "admin" ? "Admin" : "Librarian",
      action: "Archived Book",
      details: `Archived "${book.title}"`,
    });
    res.json({ message: "Book archived successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive book" });
  }
});

// ✅ ADD THIS NEW ROUTE: RESTORE A BOOK (Admin/Librarian only)
app.patch("/api/books/:id/restore", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const book = await Book.findByIdAndUpdate(req.params.id, { isArchived: false }, { new: true });
    if (!book) return res.status(404).json({ error: "Book not found" });

    await Activity.create({
      user: req.user.role === "admin" ? "Admin" : "Librarian",
      action: "Restored Book",
      details: `Restored "${book.title}"`,
    });
    res.json({ message: "Book restored successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore book" });
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

                // ✅ *** ADD THIS BLOCK: Send Pending Email ***
      sendPendingEmail(newUser.email, newUser.username).catch(err => {
            console.error(`Failed to send pending email to ${newUser.email} via Gmail API:`, err);
        });

    // ✅ Log activity AFTER saving
    await Activity.create({
      user: username,
      action: "Registered Account",
      details: `New user registered (${email})`,
    });
    await updateReport();
// ✅ *** MODIFY THIS LINE: Update success message ***
    res.json({ message: "Signup successful! Your account is pending approval." });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ===============================
// FORGOT PASSWORD
// ===============================
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // 1. Always send a generic success response to prevent email enumeration
    // We do the work *only* if the user exists.
    if (user) {
      // 2. Generate a token
      const token = crypto.randomBytes(20).toString("hex");

      // 3. Set token and 1-hour expiry on user
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      // 4. Send the email
      // We assume you have a function `sendPasswordResetEmail` in emailService.js
      // and a frontend page at `/reset.html`
      const resetLink = `https://openark2-0.onrender.com/reset.html?token=${token}`;
      
      // This function is assumed to exist in your emailService.js
      sendPasswordResetEmail(user.email, user.username, resetLink).catch(err => {
        console.error(`Failed to send password reset email to ${user.email}:`, err);
        // Don't report failure to user
      });
    }

    // ✅ ADD THIS LINE TO LOG THE REQUEST
    await Activity.create({
      user: email, // Log the email that made the request
      action: "Requested Password Reset",
      details: `Password reset link requested for ${email}`,
    });

    // 5. Send generic success message
    res.json({ message: "If your email is registered, you will receive a password reset link." });

  } catch (err) {
    console.error("❌ Forgot Password error:", err);
    // Send generic message even on server error
    res.json({ message: "If your email is registered, you will receive a password reset link." });
  }
});

// ===============================
// RESET PASSWORD
// ===============================
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    // 1. Find user by valid token and expiry date
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // $gt = greater than
    });

    if (!user) {
      return res.status(400).json({ error: "Password reset token is invalid or has expired." });
    }

    // 2. Set new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    
    // 3. Clear the token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    // ✅ ADD THIS LINE TO LOG THE SUCCESSFUL RESET
    await Activity.create({
      user: user.username || user.email, // Log username or email
      action: "Reset Password",
      details: `Password was successfully reset for user ${user.username || user.email}`,
    });

    // You could also send a "password changed" confirmation email here

    res.json({ message: "✅ Password has been reset successfully. You can now log in." });

  } catch (err) {
    console.error("❌ Reset Password error:", err);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  console.log("📩 /api/login request received");
console.log("Request body:", req.body);

  try {
    const { email, password } = req.body;

    // ===============================
    // ✅ 1. Static Librarian Login
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
  const librarianImages = [
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
    "assets/librarian1.png",
  ];

  let librarianUser = await User.findOne({ email: matchedLibrarian.email });
  if (!librarianUser) {
    librarianUser = new User({
      username: matchedLibrarian.username,
      email: matchedLibrarian.email,
      password: await bcrypt.hash(matchedLibrarian.password, 10),
      role: "librarian",
      collegeYear: "N/A",
      profilePic: librarianImages[index],
    });
  } else if (librarianUser.profilePic !== librarianImages[index]) {
    librarianUser.profilePic = librarianImages[index];
  }

librarianUser.active = true;
  await librarianUser.save();

  const token = jwt.sign(
    { id: librarianUser._id, role: "librarian", email: matchedLibrarian.email },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "24h" }
  );

  // ✅ ADD THIS BLOCK FOR LIBRARIAN LOGIN LOG
      await Activity.create({
        user: librarianUser.username || librarianUser.email,
        action: "Logged In",
        details: `Librarian ${librarianUser.username || librarianUser.email} logged in`,
      });

  return res.json({
    message: "Login successful",
    token,
    _id: librarianUser._id,
    role: "librarian",
    email: librarianUser.email,
    username: librarianUser.username,
    profilePic: librarianUser.profilePic,
  });
}

    // ===============================
    // ✅ 2. ✨ Static Admin Login (INSERTED HERE!)
    // ===============================
    const staticAdmins = [
      { email: "admin@gmail.com", password: "admin123", username: "Admin", role: "admin" }
    ];

    const matchedAdmin = staticAdmins.find(
      (admin) => admin.email === email && admin.password === password
    );

    if (matchedAdmin) {
      const token = jwt.sign(
        { id: matchedAdmin.email, role: "admin", email: matchedAdmin.email },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "24h" }
      );

      await Activity.create({
        user: matchedAdmin.username || matchedAdmin.email,
        action: "Logged In",
        details: `Admin ${matchedAdmin.username || matchedAdmin.email} logged in`,
      });

      return res.json({
        message: "Admin login successful",
        token,
        _id: matchedAdmin.email,
        role: "admin",
        email: matchedAdmin.email,
        username: matchedAdmin.username,
        profilePic: "assets/default-pfp.jpg" // Optional default
      });
    }

// ✅ 3. Student Login (Database)
const user = await User.findOne({ email });
if (!user) return res.status(401).json({ error: "Invalid credentials" });

const validPass = await bcrypt.compare(password, user.password);
if (!validPass) return res.status(401).json({ error: "Invalid credentials" });

// 🔒 Check approval status
if (!user.active) {
  return res.status(403).json({
    error: "Your account is pending admin approval. Please wait for confirmation.",
  });
}

const token = jwt.sign(
  { id: user._id, role: "student", email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
);

await Activity.create({
        user: user.username || user.email,
        action: "Logged In",
        details: `User ${user.username || user.email} logged in`,
      });

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
// ✅ LOGOUT ROUTE
// ===============================
// ✅ LOGOUT ROUTE (does not set inactive)
app.post("/api/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userIdentifier = "Unknown User";
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    // ✅ ADD THIS BLOCK TO DECODE TOKEN AND LOGOUT
    if (authHeader) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Use email or username if available in the token payload
        userIdentifier = decoded.username || decoded.email || decoded.id || "User";

        await Activity.create({
          user: userIdentifier,
          action: "Logged Out",
          details: `User ${userIdentifier} logged out`,
        });
      } catch (tokenError) {
        console.warn("Logout log: Invalid or expired token provided.", tokenError.message);
        // Optionally log even with invalid token
        // await Activity.create({ user: 'Invalid Token', action: 'Logout Attempt', details: 'Logout attempted with invalid token' });
      }
    } else {
        console.warn("Logout log: No token provided.");
        // Optionally log anonymous logout attempt
        // await Activity.create({ user: 'Anonymous', action: 'Logout Attempt', details: 'Logout attempted without token' });
    }

    // We no longer mark user inactive
    res.json({ message: "Logout successful" });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
});


// ===============================
// 👑 Admin: Manage Users
// ===============================

// 👑 Admin: Manage Users (Protected)
app.get("/api/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Ensure it's an admin account
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Access denied: Admins only" });
    }

    const users = await User.find({}, "-password");
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user active status
app.put("/api/users/:id", authenticateMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }

    const { id } = req.params;
    const { active } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { active },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    await Activity.create({
      user: "Admin",
      action: active ? "Activated User" : "Deactivated User",
      details: `${user.username} (${user.email})`,
    });

    res.json({
      message: `User ${active ? "activated" : "deactivated"} successfully`,
      user,
    });
  } catch (err) {
    console.error("❌ Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});


app.delete("/api/users/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });

    await Activity.create({
      user: "Admin",
      action: "Deleted User",
      details: `Removed account: ${deletedUser.username} (${deletedUser.email})`,
    });

    res.json({ message: "User account deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// AFTER (Fixed)
app.post("/api/upload-profile-pic", upload.single("profilePic"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Both students AND librarians can upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "openark/profile_pics",
    });
    fs.unlinkSync(req.file.path);

    user.profilePic = result.secure_url;
    await user.save();

    await Activity.create({
        user: user.username || user.email,
        action: "Updated Profile Picture",
        details: `User ${user.username || user.email} updated their profile picture`,
      });

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
      await Activity.create({
  user: "Librarian",
  action: "Added Book",
  details: `Added "${newBook.title}" by ${newBook.author}`,
});
await updateReport();
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

    // ✅ Allow both librarians AND admins
    if (decoded.role !== "librarian" && decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only librarians or admins can delete books" });
    }

    const deleted = await Book.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Book not found" });

    // ✅ Log who deleted it
    await Activity.create({
      user: decoded.role === "admin" ? "Admin" : "Librarian",
      action: "Deleted Book",
      details: `Removed "${deleted.title}" by ${deleted.author}`,
    });

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting book:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find({ isArchived: { $ne: true } });
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

    // ✅ ADD THIS BLOCK TO LOG BOOKMARK ADDITION
    try {
      // Find the book title to make the log more informative
      const book = await Book.findById(bookId).select('title').lean();
      await Activity.create({
        user: user.username || user.email,
        action: "Added Bookmark",
        details: `Bookmarked "${book?.title || 'Unknown Book'}"`,
      });
    } catch (logErr) {
      console.error("Error logging bookmark addition:", logErr);
    }

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

    // ✅ ADD THIS BLOCK TO LOG BOOKMARK REMOVAL
    try {
      // Find the book title
      const bookId = req.params.bookId;
      const book = await Book.findById(bookId).select('title').lean();
      await Activity.create({
        user: user.username || user.email,
        action: "Removed Bookmark",
        details: `Removed bookmark for "${book?.title || 'Unknown Book'}"`,
      });
    } catch (logErr) {
      console.error("Error logging bookmark removal:", logErr);
    }

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
// Add more pages to existing book (Librarian only) + Gemini OCR
// ===============================
app.post("/api/books/:id/add-pages", upload.array("pages"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "librarian")
      return res.status(403).json({ error: "Forbidden" });

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const uploadedPages = [];

    for (const file of req.files) {
      // ✅ Upload page image to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: "openark/pages",
      });

      // ✅ Convert image to base64 for Gemini OCR
      const imageBase64 = fs.readFileSync(file.path, { encoding: "base64" });
      fs.unlinkSync(file.path); // delete after reading

      // ✅ Run Gemini OCR
      let ocrText = "";
      try {
        const result = await gemini.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { data: imageBase64, mimeType: file.mimetype } },
                { text: "Extract all readable text from this scanned page clearly and accurately." },
              ],
            },
          ],
        });
        ocrText = result.response.text();
      } catch (ocrErr) {
        console.error("❌ Gemini OCR failed for page:", file.originalname, ocrErr);
        ocrText = "(OCR failed or unreadable image)";
      }

      uploadedPages.push({ img: uploadResult.secure_url, text: ocrText });
    }

    book.pages.push(...uploadedPages);
    await book.save();

    await Activity.create({
      user: "Librarian",
      action: "Added Book Pages with OCR",
      details: `Added ${uploadedPages.length} new pages to "${book.title}"`,
    });

    res.json({
      message: "✅ New pages added with OCR successfully",
      pages: uploadedPages,
    });
  } catch (err) {
    console.error("❌ Add pages with OCR failed:", err);
    res.status(500).json({ error: "Failed to add pages with OCR" });
  }
});


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

    // ✅ ADD THIS LINE TO LOG PAGE TEXT EDIT
    await Activity.create({
        user: decoded.username || decoded.email, // Identify the librarian
        action: "Edited Book Page Text",
        details: `Edited Page ${index + 1} of book "${book.title}"`,
      });

    res.json({ message: "✅ Page text updated successfully" });
  } catch (err) {
    console.error("❌ Update page text failed:", err);
    res.status(500).json({ error: "Failed to update page text" });
  }
});

// ===============================
// 📊 REPORT SUMMARY API (For Admin Reports Tab)
// ===============================
app.get("/api/report-summary", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBooks = await Book.countDocuments({ isArchived: { $ne: true } });
    const totalArchivedBooks = await Book.countDocuments({ isArchived: true });

    const books = await Book.find({ isArchived: { $ne: true } }, "category title author");
    const categoryCount = {};
    books.forEach(b => {
      const cats = Array.isArray(b.category) ? b.category : [b.category];
      cats.forEach(c => {
        if (c) categoryCount[c] = (categoryCount[c] || 0) + 1;
      });
    });
    const topCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    let topBook = "N/A";
    if (books.length > 0) {
      const top = books.reduce((max, b) => {
        const views = b.views || b.readCount || 0;
        return views > (max.views || max.readCount || 0) ? b : max;
      });
      topBook = `${top.title} (${top.views || top.readCount || 0} reads)`;
    }

    res.json({ totalUsers, totalBooks, totalArchivedBooks, topCategory, topBook });
  } catch (err) {
    console.error("❌ Report summary error:", err);
    res.status(500).json({ error: "Failed to load report summary" });
  }
});



// ===============================
// API Fallback (must come after all /api routes)
// ===============================
app.use(/^\/api(\/|$)/, (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// ===============================
// ✅ FRONTEND ROUTES (Fixed for Render Deployment)
// ===============================

// Serve all static files from /public (includes admin.html, dashboard.html, etc.)
app.use(express.static(path.join(__dirname, "public")));

// Explicitly handle known pages to prevent 502 errors
app.get(["/intro.html", "/admin.html", "/dashboard.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", req.path));
});

// ✅ Catch-all fallback (Express 5-safe)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
});

// === Simple GTTS endpoint (Fixed for Cloudinary) ===
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // 1. Define a temporary local path
    const tempFilename = `tts-${Date.now()}.mp3`;
    const tempPath = path.join(__dirname, "uploads", tempFilename);

    const gtts = new gTTS(text, 'en');

    // 2. Save to temp path (wrapped in a Promise to use await)
    await new Promise((resolve, reject) => {
      gtts.save(tempPath, (err) => {
        if (err) {
          console.error('gTTS Error:', err);
          return reject(new Error('Failed to generate speech file'));
        }
        resolve();
      });
    });

    // 3. Upload the temp file to Cloudinary
    // Note: Cloudinary treats audio files as "video" resource type
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "openark/tts_audio" // A folder in Cloudinary for audio
    });

    // 4. Delete the temporary file from the server
    fs.unlinkSync(tempPath);

    // 5. Return the permanent Cloudinary URL
    res.json({ url: result.secure_url });

  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message || 'TTS failed' });
  }
});

// ===============================
// 🧠 Gemini Outline Generator (PPT summary)
// ===============================
app.post("/api/gemini-outline", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No OCR text provided" });
    }

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
- Focus on summarizing and organizing key ideas clearly.
- Keep the tone professional and concise.

Text:
${text}
`;

    const result = await gemini.generateContent(prompt);
    const outline = result.response.text();
    await Activity.create({
  user: "Librarian",
  action: "Generated Gemini Outline",
  details: "Created PowerPoint outline from OCR text",
});


    res.json({ outline });
  } catch (err) {
    console.error("❌ Gemini outline generation failed:", err);
    res.status(500).json({ error: "Failed to generate PPT outline" });
  }
});

// Helper: broadcast new or deleted comment
function broadcastComment(bookId, type, payload) {
  io.to(bookId.toString()).emit("commentUpdate", { type, payload });
}

// ===============================
// 🧩 SOCKET.IO REAL-TIME USER STATUS
// ===============================
// AFTER (The fixed version)

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Still needed for student dashboard to register
  socket.on("registerUser", (userId) => {
    if (!userId) return;
    socket.userId = userId;
    console.log(`👤 User ${userId} connected with socket ${socket.id}`);
  });

  // Still needed for student dashboard
  socket.on("userLoggedOut", (userId) => {
    console.log(`🚪 User ${userId} logged out`);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// ===============================
// 📊 GET RECENT ACTIVITY LOGS
// ===============================
app.get("/api/activity", async (req, res) => {
  try {
    const logs = await Activity.find().sort({ date: -1 }).lean();
    res.json(logs);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ message: "Failed to load activity logs" });
  }``
});

// ===============================
// 🗑️ DELETE OLD ACTIVITY LOGS (Admin only)
// ===============================
app.delete("/api/activity/prune", authenticateMiddleware, async (req, res) => {
  try {
    // 1. Check for Admin role (no change)
    if (req.user.role !== "admin" && req.user.role !== "librarian") { // ✅ Also allow librarians
      return res.status(403).json({ error: "Forbidden: Admins or Librarians only" });
    }

    // 2. Get the date from the request body (no change)
    const { beforeDate } = req.body;
    if (!beforeDate) {
      return res.status(400).json({ error: "No 'beforeDate' specified" });
    }

    const targetDate = new Date(beforeDate);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    
    // -------------------
    // ▼▼▼ START OF FIX ▼▼▼
    // -------------------
    // ✅ Advance the date by one day.
    // This makes the query delete everything up to the END of the selected day.
    // e.g., if you select Oct 25, this becomes Oct 26 at 00:00:00.
    targetDate.setDate(targetDate.getDate() + 1);
    // -------------------
    // ▲▲▲ END OF FIX ▲▲▲
    // -------------------

    // 3. Perform the deletion
    // { date: { $lt: targetDate } } means "where the date is LESS THAN the targetDate"
    const result = await Activity.deleteMany({ date: { $lt: targetDate } });

    // 4. Log this action (ironically)
    await Activity.create({
      user: "Admin",
      action: "Pruned Activity Logs",
      details: `Deleted ${result.deletedCount} logs created before ${targetDate.toLocaleDateString()}`,
    });

    // 5. Send success response
    res.json({
      message: `Successfully deleted ${result.deletedCount} old logs.`,
      deletedCount: result.deletedCount,
    });

  } catch (err) {
    console.error("Error pruning activity logs:", err);
    res.status(500).json({ message: "Failed to prune activity logs" });
  }
});

// ===============================
// ✅ Start the unified HTTP + Socket.IO server
// ===============================
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});