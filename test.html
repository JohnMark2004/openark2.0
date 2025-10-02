// ===============================
// server.js (Multer Updated)
// ===============================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// Serve static files
// ===============================

// Serve uploaded files from multer
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve frontend files (HTML, CSS, JS) from /public
app.use(express.static(path.join(__dirname, "public")));

// Default route → open dashboard.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
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
const pageSchema = new mongoose.Schema({
  img: String,  // stored path like /uploads/page123.png
  text: String, // OCR result
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
// Routes
// ===============================

// --- LOGIN (Update expiresIn here) ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ error: "Invalid credentials" });

    // ✅ Extended token lifetime here
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }   // was "1h"
    );

    res.json({ token, role: user.role, username: user.username, email: user.email });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// GET all books
app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// ===============================
// POST new book (with Multer)
// ===============================
app.post(
  "/api/books",
  upload.fields([{ name: "cover", maxCount: 1 }, { name: "pages" }]),
  async (req, res) => {
    try {
      console.log("📥 req.body:", req.body);
      console.log("📥 req.files:", req.files);

      const title = req.body?.title || "";
      const author = req.body?.author || "";
      const publisher = req.body?.publisher || "";
      const year = req.body?.year || "";
      const category = req.body?.category || "";
      const description = req.body?.description || "";
      const pageTexts = req.body?.pageTexts || "[]";

      if (!title || !author || !publisher || !year || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const coverFile = req.files?.cover ? req.files.cover[0] : null;
      const pageFiles = req.files?.pages || [];

      let texts = [];
      try {
        texts = JSON.parse(pageTexts);
      } catch {
        texts = [];
      }

      const pages = pageFiles.map((file, idx) => ({
        img: `/uploads/${file.filename}`,
        text: texts[idx] || ""
      }));

      const newBook = new Book({
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        year: Number(year),
        category: category.trim(),
        description: description.trim(),
        img: coverFile ? `/uploads/${coverFile.filename}` : undefined,
        pages
      });

      await newBook.save();
      res.status(201).json(newBook);
    } catch (err) {
      console.error("❌ Error creating book:", err);
      res.status(500).json({ error: "Failed to create book: " + err.message });
    }
  }
);


// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
