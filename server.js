require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===============================
// MongoDB Connection
// ===============================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ===============================
// User Schema
// ===============================
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  collegeYear: String,
});

const User = mongoose.model("User", userSchema);

// ===============================
// Book Schema
// ===============================
// Book Schema
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  publisher: { type: String, required: true },
  year: { type: Number, required: true },
  category: { type: String, required: true },
  img: { type: String, default: "img/default-book.png" },
});

const Book = mongoose.model("Book", bookSchema);


// ===============================
// API Routes
// ===============================
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, collegeYear } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      collegeYear,
    });
    await newUser.save();

    res.json({ message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- Check if librarian ---
    if (email === "forlibrarianuse@gmail.com" && password === "librarian12345") {
      const token = jwt.sign(
        { role: "librarian", email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.json({
        message: "Login successful",
        token,
        role: "librarian",
        email,
      });
    }

    // --- Otherwise, check student in DB ---
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: "student" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
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
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ message: "Access granted", user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// ===============================
// Book API Routes
// ===============================

app.post("/api/books", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "librarian") {
      return res.status(403).json({ error: "Forbidden: Only librarians can add books" });
    }

    const { title, author, publisher, year, category } = req.body;

    // Validate all required fields
    if (!title || !author || !publisher || !year || !category) {
      return res.status(400).json({ error: "All fields including description are required" });
    }

    const newBook = new Book({
      title: title.trim(),
      author: author.trim(),
      publisher: publisher.trim(),
      year: Number(year),
      category: category.trim(),
    });

    
console.log("💾 Book object to save:", newBook);

    await newBook.save();

    res.status(201).json(newBook);
  } catch (err) {
    console.error("❌ Error creating book:", err);
    res.status(500).json({ error: "Failed to create book: " + err.message });
  }
});

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
// Serve Frontend (intro.html + css + js)
// ===============================
app.use(express.static(path.join(__dirname, "public")));

// Catch-all for frontend routes
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
});

// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
