// ===============================
// server.js (Merged: Multer + Users + Static Librarian)
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
const fs = require("fs");   // ✅ add this

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
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }]
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

// 🔒 Static librarian account
if (email === "forlibrarianuse@gmail.com" && password === "librarian12345") {
  // ensure librarian user exists in DB
  let librarianUser = await User.findOne({ email });
  if (!librarianUser) {
    librarianUser = new User({
      username: "Librarian",
      email,
      password: await bcrypt.hash(password, 10),
      role: "librarian",
      collegeYear: "N/A",
    });
    await librarianUser.save();
  }

  const token = jwt.sign(
    { id: librarianUser._id, role: "librarian", email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.json({
    message: "Login successful",
    token,
    role: "librarian",
    email,
    username: librarianUser.username,
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
// Start Server
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
