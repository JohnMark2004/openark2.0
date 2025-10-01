  document.addEventListener('DOMContentLoaded', () => {

    // API BASE URL
  const API_URL = "https://openark2-0.onrender.com";

    // --- Auth Check ---
    if (!sessionStorage.getItem('token')) {
      window.location.href = 'intro.html';
      return;
    }

    // --- Role-based UI ---
    const role = localStorage.getItem("role") || "student";
    const conversionLink = document.querySelector('nav a:nth-child(2)');
    if (role !== "librarian" && conversionLink) {
      conversionLink.style.display = "none";
    }

    // --- Logout functionality ---
    document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem('token');
      window.location.href = 'intro.html';
    });

    const homeTab = document.getElementById("homeTab");
    const conversionTab = document.getElementById("conversionTab");
    const homeSection = document.getElementById("homeSection");
    const conversionSection = document.getElementById("conversionSection");
    const bookCreationSection = document.getElementById("bookCreationSection");

    if (homeTab && conversionTab && homeSection && conversionSection) {
homeTab.addEventListener("click", (e) => {
  e.preventDefault();
  homeSection.classList.remove("hidden");
  conversionSection.classList.add("hidden");

  // ✅ Hide wizard if it was open
  document.getElementById("bookCreationSection").classList.add("hidden");

  // ✅ Reset wizard to step 1
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");

  // ✅ Hide book details
  document.getElementById("bookDetailsSection").classList.add("hidden");
});

conversionTab.addEventListener("click", (e) => {
  e.preventDefault();
  conversionSection.classList.remove("hidden");
  homeSection.classList.add("hidden");

  // ✅ Hide wizard if it was open
  document.getElementById("bookCreationSection").classList.add("hidden");

  // ✅ Reset wizard to step 1
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");

  // ✅ Hide book details
  document.getElementById("bookDetailsSection").classList.add("hidden");
});

conversionTab.addEventListener("click", (e) => {
  e.preventDefault();
  // Show conversion section
  conversionSection.classList.remove("hidden");
  homeSection.classList.add("hidden");

  // ✅ Hide wizard if it was open
  document.getElementById("bookCreationSection").classList.add("hidden");

  // ✅ Reset wizard to step 1
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");
});

// Show selected file name for Cover
document.getElementById("coverUpload").addEventListener("change", function () {
  const fileName = this.files.length > 0 ? this.files[0].name : "No file chosen";
  document.getElementById("coverFileName").textContent = fileName;
});

// Show selected file name for Page
document.getElementById("pageUpload").addEventListener("change", function () {
  const fileName = this.files.length > 0 ? this.files[0].name : "No file chosen";
  document.getElementById("pageFileName").textContent = fileName;
});


        }



    // --- Profile Modal ---
    const profileLink = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');

    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('profile-username').textContent = localStorage.getItem('username') || 'User';
      document.getElementById('profile-email').textContent = localStorage.getItem('email') || 'user@email.com';
      document.getElementById('profile-year').textContent = localStorage.getItem('collegeYear') || 'N/A';
      profileModal.classList.remove('hidden');
    });

    closeProfileBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
    });

    profileModal.addEventListener('click', (e) => {
      const container = profileModal.querySelector('.profile-container');
      if (!container.contains(e.target)) {
        profileModal.classList.add('hidden');
      }
    });

// --- Available Books Slideshow ---
const featuredBookContainer = document.getElementById("featuredBook");

async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    // --- Featured Slideshow ---
    if (featuredBookContainer && books.length > 0) {
      featuredBookContainer.innerHTML = `
        <img src="${books[0].img}" alt="${books[0].title}">
        <div class="info">
          <h3>${books[0].title}</h3>
          <p><strong>${books[0].author}</strong> — ${books[0].year}</p>
        </div>
      `;

      let current = 0;
      function showBook(index) {
        const img = featuredBookContainer.querySelector("img");
        const title = featuredBookContainer.querySelector("h3");
        const desc = featuredBookContainer.querySelector("p:last-child");

        img.classList.add("fade-out");
        title.classList.add("fade-out");
        desc.classList.add("fade-out");

        setTimeout(() => {
          img.src = books[index].img;
          img.alt = books[index].title;
          title.textContent = books[index].title;
          desc.textContent = books[index].description || "No description available.";

          img.classList.remove("fade-out");
          title.classList.remove("fade-out");
          desc.classList.remove("fade-out");
        }, 500);
      }

      setInterval(() => {
        current = (current + 1) % books.length;
        showBook(current);
      }, 5000);
    }

// --- Populate All Books Grid ---
const dashboardBooks = document.getElementById("dashboardBooks");
if (dashboardBooks) {
  dashboardBooks.innerHTML = "";
  books.forEach((book) => {
    const div = document.createElement("div");
    div.className = "book";
    div.innerHTML = `
      <img src="${book.img}" alt="${book.title}">
      <h4>${book.title}</h4>
    `;
    
    // ✅ Click handler to open details view
div.addEventListener("click", () => {
  document.getElementById("homeSection").classList.add("hidden");
  document.getElementById("bookDetailsSection").classList.remove("hidden");

  document.getElementById("detailCover").src = book.img;
  document.getElementById("detailTitle").textContent = book.title;
  document.getElementById("detailAuthor").textContent = book.author;
  document.getElementById("detailPublisher").textContent = book.publisher;
  document.getElementById("detailYear").textContent = book.year;
  document.getElementById("detailCategory").textContent = book.category;
  document.getElementById("detailDescription").textContent =
    book.description || "No description available.";

  // ✅ Show OCR pages
  const pageContainer = document.getElementById("pageContainer");
  pageContainer.innerHTML = "";
  if (book.pages && book.pages.length > 0) {
    book.pages.forEach((page, idx) => {
      const div = document.createElement("div");
      div.className = "page";
      div.innerHTML = `
        <img src="${page.img}" alt="Page ${idx+1}">
        <div class="ocr-text">${page.text || "No text detected."}</div>
      `;
      pageContainer.appendChild(div);
    });
  } else {
    pageContainer.innerHTML = "<p>No pages available.</p>";
  }
});

    dashboardBooks.appendChild(div);
  });
}

document.getElementById("backToConversion").addEventListener("click", () => {
  document.getElementById("bookCreationSection").classList.add("hidden");
  document.getElementById("conversionSection").classList.remove("hidden");
});


// ✅ Back button handler
document.getElementById("backToHomeBtn").addEventListener("click", () => {
  document.getElementById("bookDetailsSection").classList.add("hidden");
  document.getElementById("homeSection").classList.remove("hidden");
});

  } catch (err) {
    console.error("❌ Error loading books:", err);
  }
}

// --- Conversion Tab Books ---
async function loadConversionBooks() {
  try {
    const token = sessionStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/books`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    const conversionBooks = document.getElementById("conversionBooks");
    if (conversionBooks) {
      conversionBooks.innerHTML = "";

      // Add "Add Book" card
      const addBookCard = document.createElement("div");
      addBookCard.className = "book add-book";
      addBookCard.id = "addBookBtn";
      addBookCard.innerHTML = `<span>＋</span><p>Add Book</p>`;
      conversionBooks.appendChild(addBookCard);

      // Populate DB books
      books.forEach((book) => {
        const div = document.createElement("div");
        div.className = "book";
        div.innerHTML = `
          <img src="${book.img}" alt="${book.title}">
          <h4>${book.title}</h4>
        `;
        conversionBooks.appendChild(div);
      });

      // Re-bind Add Book button
      const addBookBtn = document.getElementById("addBookBtn");
if (addBookBtn) {
  addBookBtn.addEventListener("click", () => {
    conversionSection.classList.add("hidden");
    bookCreationSection.classList.remove("hidden");
  });
}

    }
  } catch (err) {
    console.error("❌ Error loading conversion books:", err);
  }
}

// ===============================
// 📚 Book Creation Wizard Logic (Multer version)
// ===============================
let bookData = { pages: [], pageFiles: [] };

// Show selected file name for Cover
const coverUploadEl = document.getElementById("coverUpload");
if (coverUploadEl) {
  coverUploadEl.addEventListener("change", function () {
    const file = this.files[0];
    document.getElementById("coverFileName").textContent = file ? file.name : "No file chosen";
  });
}

// Show selected file name for Page
document.getElementById("pageUpload").addEventListener("change", function () {
  const fileName = this.files.length > 0 ? this.files[0].name : "No file chosen";
  document.getElementById("pageFileName").textContent = fileName;
});

// Open Book Creation
document.addEventListener("click", (e) => {
  if (e.target.id === "addBookBtn") {
    conversionSection.classList.add("hidden");
    bookCreationSection.classList.remove("hidden");
  }
});

// Step 1 -> Step 2
document.getElementById("nextToStep2").addEventListener("click", () => {
  const form = document.getElementById("bookMetaForm");
  const fd = new FormData(form);

  bookData = {
    title: fd.get("title"),
    author: fd.get("author"),
    publisher: fd.get("publisher"),
    year: Number(fd.get("year")),
    category: fd.get("category"),
    description: fd.get("description"),
    pages: [],
    pageFiles: []
  };

  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");
});

// Step 2 -> Add Page + OCR
document.getElementById("addPageBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("pageUpload");
  if (!fileInput.files[0]) return;

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async () => {
    const imgData = reader.result;

    const result = await Tesseract.recognize(imgData, "eng");
    const text = result.data.text;

    bookData.pageFiles.push(file);   // ✅ keep file for Multer
    bookData.pages.push({ text });   // ✅ store OCR text

    const div = document.createElement("div");
    div.innerHTML = `<p>📄 Page ${bookData.pages.length} added: ${file.name}</p>`;
    document.getElementById("pageList").appendChild(div);

    // reset input
    fileInput.value = "";
    document.getElementById("pageFileName").textContent = "No file chosen";
  };
  reader.readAsDataURL(file);
});


// Navigation
document.getElementById("nextToStep3").addEventListener("click", () => {
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.remove("hidden");
});
document.getElementById("backToStep1").addEventListener("click", () => {
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step1").classList.remove("hidden");
});
document.getElementById("backToStep2").addEventListener("click", () => {
  document.getElementById("step3").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");
});
document.getElementById("backToConversion").addEventListener("click", () => {
  bookCreationSection.classList.add("hidden");
  conversionSection.classList.remove("hidden");
});

// ===============================
// 📤 Publish (send with Multer)
// ===============================
// ===============================
// 📚 Publish Book (Final Step)
// ===============================
document.getElementById("publishBookBtn").addEventListener("click", async () => {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("❌ Not authorized");
      return;
    }

    const fd = new FormData();
    fd.append("title", bookData.title || "");
    fd.append("author", bookData.author || "");
    fd.append("publisher", bookData.publisher || "");
    fd.append("year", bookData.year || "");
    fd.append("category", bookData.category || "");
    fd.append("description", bookData.description || "");

    const coverFile = document.getElementById("coverUpload").files[0];
    if (coverFile) fd.append("cover", coverFile);

    bookData.pageFiles.forEach((file) => fd.append("pages", file));
    fd.append("pageTexts", JSON.stringify(bookData.pages.map((p) => p.text)));

    const res = await fetch(`${API_URL}/api/books`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    // ✅ only parse once
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error("Server returned non-JSON: " + text.slice(0, 100));
    }

    if (!res.ok) {
      throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
    }

    alert("✅ Book published successfully!");
    console.log("✅ Book saved:", data);
    window.location.reload();
  } catch (err) {
    console.error("❌ Failed to publish book:", err);
    alert("❌ Failed to publish book: " + err.message);
  }
});

  // Run on page load
  loadBooks();
  loadConversionBooks();
  });
