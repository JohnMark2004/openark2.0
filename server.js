// ===============================
// server.js (Merged: Multer + Users + Static Librarian)
// ===============================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");   // ✅ add this

// ✅ Ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

const app = express();

// Middleware
app.use(cors());
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
  category: { type: String, required: true },
  img: { type: String, default: "img/default-book.png" },
  description: { type: String, default: "" },
  pages: [pageSchema],
});
const Book = mongoose.model("Book", bookSchema);

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

// --- SIGNUP ---
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

// --- LOGIN ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔒 Static librarian account
    if (email === "forlibrarianuse@gmail.com" && password === "librarian12345") {
      const token = jwt.sign({ role: "librarian", email }, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });
      return res.json({
        message: "Login successful",
        token,
        role: "librarian",
        email,
      });
    }

    // Otherwise check student in DB
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
      role: "student",
      email: user.email,
      username: user.username,
      collegeYear: user.collegeYear,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ===============================
// Book Routes
// ===============================

// Add book (librarian only, requires token)
app.post(
  "/api/books",
  (req, res, next) => {
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "pages" }])(req, res, function (err) {
      if (err) {
        console.error("❌ Multer error:", err);
        return res.status(400).json({ error: "File upload error: " + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log("📥 Incoming book upload");
      console.log("Body:", req.body);
      console.log("Files:", req.files);

      // 🔒 Check token
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
        return res.status(403).json({ error: "Forbidden: Only librarians can add books" });
      }

      const { title, author, publisher, year, category, description, pageTexts } = req.body;
      if (!title || !author || !publisher || !year || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const coverFile = req.files?.cover ? req.files.cover[0] : null;
      const pageFiles = req.files?.pages || [];

      let texts = [];
      try {
        texts = JSON.parse(pageTexts || "[]");
      } catch {
        texts = [];
      }

      const pages = pageFiles.map((file, idx) => ({
        img: `/uploads/${file.filename}`,
        text: texts[idx] || "",
      }));

      const newBook = new Book({
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        year: Number(year),
        category: category.trim(),
        description: description?.trim() || "",
        img: coverFile ? `/uploads/${coverFile.filename}` : undefined,
        pages,
      });

      await newBook.save();
      res.status(201).json(newBook);
    } catch (err) {
      console.error("❌ Error creating book:", err);
      res.status(500).json({ error: "Failed to create book: " + err.message });
    }
  }
);

// Get all books
app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// ===============================
// API Fallback (must come after all /api routes)
// ===============================
// Option 1: Regex (recommended, works in v4 & v5)
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
// Start Server
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
