document.addEventListener("DOMContentLoaded", () => {
  let bookToDelete = null;
  let bookData = {};

  // --- Popup/Toast Notification Function ---
  function showPopup(message, type = "success") {
    const popup = document.getElementById("popup");
    if (!popup) return;
    popup.textContent = message;
    popup.className = `popup ${type} show`;
    setTimeout(() => popup.classList.remove("show"), 3000);
  }

  // API BASE URL
  const API_URL = "https://openark2-0.onrender.com";

  // --- Auth Check ---
  if (!sessionStorage.getItem("token")) {
    window.location.href = "intro.html";
    return;
  }


function formatGenres(cat) {
  if (Array.isArray(cat)) {
    return cat.filter(c => c && c.trim() !== "").join(", ") || "N/A";
  }
  if (typeof cat === "string") {
    try {
      const parsed = JSON.parse(cat);
      if (Array.isArray(parsed)) {
        return parsed.filter(c => c && c.trim() !== "").join(", ") || "N/A";
      }
    } catch {
      return cat
        .replace(/^\[|\]$/g, "")
        .replace(/"/g, "")
        .split(",")
        .map(s => s.trim())
        .filter(s => s !== "")
        .join(", ") || "N/A";
    }
    return cat.trim() || "N/A";
  }
  return "N/A";
}

  // --- Sections / Elements ---
  const homeSection = document.getElementById("homeSection");
  const conversionSection = document.getElementById("conversionSection");
  const browseSection = document.getElementById("browseSection");
  const bookDetailsSection = document.getElementById("bookDetailsSection");
  const bookCreationSection = document.getElementById("bookCreationSection");
  const bookReaderSection = document.getElementById("bookReaderSection");

  // --- Nav Tabs ---
  const homeTab = document.getElementById("homeTab");
  const conversionTab = document.getElementById("conversionTab");
  const browseTab = document.getElementById("browseTab");

  // --- Role-based UI ---
  const role = localStorage.getItem("role") || "student";
  const conversionLink = document.querySelector("nav a:nth-child(2)");
  if (role !== "librarian" && conversionLink) {
    conversionLink.style.display = "none";
  }

  // --- Logout ---
  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("token");
    window.location.href = "intro.html";
  });

  const coverUpload = document.getElementById("coverUpload");
const coverFileName = document.getElementById("coverFileName");

if (coverUpload && coverFileName) {
  coverUpload.addEventListener("change", () => {
    if (coverUpload.files.length > 0) {
      coverFileName.textContent = coverUpload.files[0].name;
    } else {
      coverFileName.textContent = "No file chosen";
    }
  });
}

// --- Step 2: Add Page logic ---
const pageUpload = document.getElementById("pageUpload");
const pageFileName = document.getElementById("pageFileName");
const addPageBtn = document.getElementById("addPageBtn");
const pageList = document.getElementById("pageList");

// update "No file chosen" when selecting a file
if (pageUpload && pageFileName) {
  pageUpload.addEventListener("change", () => {
    pageFileName.textContent = pageUpload.files.length > 0
      ? pageUpload.files[0].name
      : "No file chosen";
  });
}

// handle add page button
if (addPageBtn) {
  addPageBtn.addEventListener("click", () => {
    const file = pageUpload.files[0];
    if (!file) {
      showPopup("⚠️ Please choose a page file first", "error");
      return;
    }

    // Run OCR with Tesseract
    Tesseract.recognize(file, "eng")
      .then(({ data: { text } }) => {
        if (!bookData.pageFiles) bookData.pageFiles = [];
        bookData.pageFiles.push({ file, text });

        // Show preview
        const div = document.createElement("div");
        div.className = "page-preview";
        div.innerHTML = `
          <span>${file.name} OCR ready</span>
          <button class="remove-page-btn">Remove</button>
        `;

        div.querySelector(".remove-page-btn").addEventListener("click", () => {
          bookData.pageFiles = bookData.pageFiles.filter(p => p.file !== file);
          pageList.removeChild(div);
        });

        pageList.appendChild(div);

        pageUpload.value = "";
        pageFileName.textContent = "No file chosen";
      })
      .catch(err => {
        console.error("OCR error:", err);
        showPopup("⚠️ OCR failed, page saved without text", "error");
        if (!bookData.pageFiles) bookData.pageFiles = [];
        bookData.pageFiles.push({ file, text: "" });
      });
  });
}

  // --- Tab Switching ---
  if (homeTab) {
    homeTab.addEventListener("click", (e) => {
      e.preventDefault();
      homeSection.classList.remove("hidden");
      conversionSection.classList.add("hidden");
      browseSection.classList.add("hidden");
      bookDetailsSection.classList.add("hidden");
      bookCreationSection.classList.add("hidden");
      bookReaderSection.classList.add("hidden");
    });
  }

  if (conversionTab) {
    conversionTab.addEventListener("click", (e) => {
      e.preventDefault();
      conversionSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
      browseSection.classList.add("hidden");
      bookDetailsSection.classList.add("hidden");
      bookCreationSection.classList.add("hidden");
      bookReaderSection.classList.add("hidden");
    });
  }

  if (browseTab) {
    browseTab.addEventListener("click", (e) => {
      e.preventDefault();
      browseSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
      conversionSection.classList.add("hidden");
      bookDetailsSection.classList.add("hidden");
      bookCreationSection.classList.add("hidden");
      bookReaderSection.classList.add("hidden");
      loadBrowseBooks();
    });
  }

  // --- Profile Modal ---
  const profileLink = document.getElementById("profileBtn");
  const profileModal = document.getElementById("profileModal");
  const closeProfileBtn = document.getElementById("closeProfileBtn");

  if (profileLink && profileModal && closeProfileBtn) {
    profileLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("profile-username").textContent =
        localStorage.getItem("username") || "User";
      document.getElementById("profile-email").textContent =
        localStorage.getItem("email") || "user@email.com";
      document.getElementById("profile-year").textContent =
        localStorage.getItem("collegeYear") || "N/A";
      profileModal.classList.remove("hidden");
    });

    closeProfileBtn.addEventListener("click", () =>
      profileModal.classList.add("hidden")
    );

    profileModal.addEventListener("click", (e) => {
      const container = profileModal.querySelector(".profile-container");
      if (!container.contains(e.target)) {
        profileModal.classList.add("hidden");
      }
    });
  }

  // --- Load Books for Home ---
  const featuredBookContainer = document.getElementById("featuredBook");

  async function loadGenres() {
  try {
    const res = await fetch(`${API_URL}/api/genres`);
    if (!res.ok) throw new Error("Failed to fetch genres");
    const genres = await res.json();

    const genreContainer = document.getElementById("categoriesButtons");
    genreContainer.innerHTML = "";

    // Add "All" button
    const allBtn = document.createElement("button");
    allBtn.textContent = "All";
    allBtn.classList.add("genre-btn", "active");
    allBtn.dataset.genre = "all";
    genreContainer.appendChild(allBtn);

    // Add genres from DB
    genres.forEach((g) => {
      const btn = document.createElement("button");
      btn.textContent = g;
      btn.classList.add("genre-btn");
      btn.dataset.genre = g;
      genreContainer.appendChild(btn);
    });

    // Bind events
    document.querySelectorAll(".genre-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".genre-btn").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");

        const search = document.getElementById("browseSearch").value.trim();
        const sort = document.getElementById("browseSort").value;
        const genre = btn.dataset.genre;
        loadBrowseBooks({ search, sort, genre });
      });
    });
  } catch (err) {
    console.error("❌ Error loading genres:", err);
  }
}



  async function loadBooks() {
    try {
      const res = await fetch(`${API_URL}/api/books`);
      if (!res.ok) throw new Error("Failed to fetch books");
      const books = await res.json();

      // Featured Slideshow
      if (featuredBookContainer && books.length > 0) {
        featuredBookContainer.innerHTML = `
          <img src="${books[0].img}" alt="${books[0].title}">
          <div class="info">
            <h3>${books[0].title}</h3>
<p><strong>${books[0].author}</strong> — ${books[0].publisher}, ${books[0].year}</p>

          </div>
        `;

        let current = 0;
        setInterval(() => {
          current = (current + 1) % books.length;
          const book = books[current];
          const img = featuredBookContainer.querySelector("img");
          const title = featuredBookContainer.querySelector("h3");
          const desc = featuredBookContainer.querySelector("p:last-child");

          img.classList.add("fade-out");
          title.classList.add("fade-out");
          desc.classList.add("fade-out");

          setTimeout(() => {
            img.src = book.img;
            img.alt = book.title;
            title.textContent = book.title;
desc.textContent = `${book.author} — ${book.publisher}, ${book.year}`;
            img.classList.remove("fade-out");
            title.classList.remove("fade-out");
            desc.classList.remove("fade-out");
          }, 500);
        }, 5000);
      }

      // All Books Grid (Home)
      const dashboardBooks = document.getElementById("dashboardBooks");
      if (dashboardBooks) {
        dashboardBooks.innerHTML = "";
books.forEach((book) => {
  const genres = Array.isArray(book.category)
    ? book.category.join(", ")
    : typeof book.category === "string"
      ? book.category
          .replace(/^\[|\]$/g, "")  // remove []
          .replace(/"/g, "")        // remove quotes
          .split(",")
          .map((s) => s.trim())
          .join(", ")
      : "N/A";

  const div = document.createElement("div");
  div.className = "book";
div.innerHTML = `
  <img src="${book.img}" alt="${book.title}">
  <h4>${book.title}</h4>
`;
div.addEventListener("click", () =>
  showBookDetails(book, homeSection)
);

  dashboardBooks.appendChild(div);
});

      }
    } catch (err) {
      console.error("❌ Error loading books:", err);
    }
  }

  // --- Load Books for Conversion (Librarian) ---
  async function loadConversionBooks() {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/books`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch books");
      const books = await res.json();

      const conversionBooks = document.getElementById("conversionBooks");
      if (conversionBooks) {
        conversionBooks.innerHTML = "";

        // Add Book Card
        const addBookCard = document.createElement("div");
        addBookCard.className = "book add-book";
        addBookCard.id = "addBookBtn";
        addBookCard.innerHTML = `<span>＋</span><p>Add Book</p>`;
        conversionBooks.appendChild(addBookCard);

        // Book cards
        books.forEach((book) => {
          const div = document.createElement("div");
          div.className = "book";
          div.innerHTML = `
            <img src="${book.img}" alt="${book.title}">
            <h4>${book.title}</h4>
            <button class="delete-btn">Delete</button>
          `;

          div.querySelector("img").addEventListener("click", () =>
            showBookDetails(book, conversionSection)
          );

          div.querySelector(".delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            bookToDelete = book;
            document.getElementById(
              "deleteModalMessage"
            ).textContent = `Are you sure you want to delete "${book.title}"?`;
            document.getElementById("deleteModal").classList.remove("hidden");
          });

          conversionBooks.appendChild(div);
        });

        // Delete Modal actions
        document
          .getElementById("cancelDeleteBtn")
          .addEventListener("click", () => {
            bookToDelete = null;
            document.getElementById("deleteModal").classList.add("hidden");
          });

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!bookToDelete) return;
  try {
    const token = sessionStorage.getItem("token");

    // ✅ must use Mongo _id
    const bookId = bookToDelete._id;
    if (!bookId) throw new Error("No valid _id found for book");

    const res = await fetch(`${API_URL}/api/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Failed to delete book");
    }

    await res.json().catch(() => {});
    showPopup("✅ Book deleted successfully", "success");

    // refresh after delete
    await loadConversionBooks();
    await loadBooks();
    await loadBrowseBooks();

  } catch (err) {
    console.error("❌ Delete failed:", err);
    showPopup("❌ Failed to delete book", "error");
  } finally {
    bookToDelete = null;
    document.getElementById("deleteModal").classList.add("hidden");
  }
});


        // Add Book button
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

// --- Browse Tab logic ---
async function loadBrowseBooks(filters = {}) {
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    let books = await res.json();

    // Apply filters
    if (filters.search) {
      books = books.filter((b) =>
        b.title.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

// ✅ Inclusive Genre Filtering
if (filters.genre && filters.genre !== "all") {
  books = books.filter((b) => {
    // Normalize categories into a clean array
    let categories = [];
    if (Array.isArray(b.category)) {
      categories = b.category;
    } else if (typeof b.category === "string") {
      try {
        const parsed = JSON.parse(b.category);
        categories = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        categories = b.category.split(",").map(c => c.trim());
      }
    }

    // ✅ Inclusive check: book is kept if at least ONE category matches selected genre
    return categories.some(
      (c) => c.trim().toLowerCase() === filters.genre.trim().toLowerCase()
    );
  });
}

    // Sorting
// Sorting
if (filters.sort === "latest") {
  books.sort((a, b) => (b.year || 0) - (a.year || 0));
} else if (filters.sort === "oldest") {
  books.sort((a, b) => (a.year || 0) - (b.year || 0));
}


    // ✅ Render using correct `category` field
    const browseBooks = document.getElementById("browseBooks");
    browseBooks.innerHTML = "";
books.forEach((book) => {
  const genres = Array.isArray(book.category)
    ? book.category.join(", ")
    : book.category || "N/A";

  const div = document.createElement("div");
  div.className = "book";
  div.innerHTML = `
    <img src="${book.img}" alt="${book.title}">
    <h4>${book.title}</h4>
  `;
  div.addEventListener("click", () => showBookDetails(book, browseSection));
  browseBooks.appendChild(div);
});

  } catch (err) {
    console.error("❌ Error loading browse books:", err);
  }
}

  // Browse filters events
  document.getElementById("browseSearch").addEventListener("input", () => {
    const search = document.getElementById("browseSearch").value.trim();
    const sort = document.getElementById("browseSort").value;
    const genre = document.querySelector(".genre-btn.active").dataset.genre;
    loadBrowseBooks({ search, sort, genre });
  });

  document.getElementById("browseSort").addEventListener("change", () => {
    const search = document.getElementById("browseSearch").value.trim();
    const sort = document.getElementById("browseSort").value;
    const genre = document.querySelector(".genre-btn.active").dataset.genre;
    loadBrowseBooks({ search, sort, genre });
  });

  document.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".genre-btn").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      const search = document.getElementById("browseSearch").value.trim();
      const sort = document.getElementById("browseSort").value;
      const genre = btn.dataset.genre;
      loadBrowseBooks({ search, sort, genre });
    });
  });

function showBookDetails(book, fromSection) {
  if (fromSection) {
    fromSection.classList.add("hidden");
    window.lastSection = fromSection; 
  }
  bookDetailsSection.classList.remove("hidden");

  const genres = Array.isArray(book.category)
    ? book.category.join(", ")
    : typeof book.category === "string"
      ? book.category
          .replace(/^\[|\]$/g, "")
          .replace(/"/g, "")
          .split(",")
          .map((s) => s.trim())
          .join(", ")
      : "N/A";

  document.getElementById("detailCover").src = book.img;
  document.getElementById("detailTitle").textContent = book.title;
  document.getElementById("detailTitle").dataset.bookId = book._id;  // ✅ critical line
  document.getElementById("detailTitleBreadcrumb").textContent = book.title;
  document.getElementById("detailAuthor").innerHTML = `
    <strong>${book.author}</strong>
    &nbsp;&nbsp; Publisher: <span class="value">${book.publisher}</span>
    &nbsp;&nbsp; Year: <span class="value">${book.year}</span>
  `;
  document.getElementById("detailCategory").textContent = genres;
  document.getElementById("detailCategoryStat").textContent = genres;
  document.getElementById("detailDescription").textContent =
    book.description || "No description available.";
  document.getElementById("disclaimer").textContent =
    "Disclaimer: This book is from the library. We do not own it; we only use it with permission for thesis purposes.";
  document.getElementById("detailChapters").textContent =
    book.pages && book.pages.length > 0
      ? `${book.pages.length} Pages`
      : "N/A";

  window.currentBook = book;
}

    // --- Genre Button Toggle (move this near the top) ---
  const genreButtons = document.querySelectorAll("#categoriesButtons button");
  genreButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });

  // --- Book Creation Wizard ---
  const bookMetaForm = document.getElementById("bookMetaForm");
  const nextToStep2 = document.getElementById("nextToStep2");
  const backToStep1 = document.getElementById("backToStep1");
  const nextToStep3 = document.getElementById("nextToStep3");
  const backToStep2 = document.getElementById("backToStep2");
  const publishBookBtn = document.getElementById("publishBookBtn");

if (nextToStep2) {
  nextToStep2.addEventListener("click", () => {
    const fd = new FormData(bookMetaForm);

    // Save metadata + genres
    bookData = {
      title: fd.get("title"),
      author: fd.get("author"),
      publisher: fd.get("publisher"),
      year: Number(fd.get("year")),
      categories: Array.from(
        document.querySelectorAll("#categoriesButtons button.active")
      ).map(btn => btn.dataset.genre),
      description: fd.get("description"),
      pages: [],
      pageFiles: [],
      coverFile: document.getElementById("coverUpload").files[0] || null // ✅ store cover
    };

    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
  });
}


  if (backToStep1) {
    backToStep1.addEventListener("click", () => {
      document.getElementById("step2").classList.add("hidden");
      document.getElementById("step1").classList.remove("hidden");
    });
  }

  if (nextToStep3) {
    nextToStep3.addEventListener("click", () => {
      document.getElementById("step2").classList.add("hidden");
      document.getElementById("step3").classList.remove("hidden");
    });
  }

  if (backToStep2) {
    backToStep2.addEventListener("click", () => {
      document.getElementById("step3").classList.add("hidden");
      document.getElementById("step2").classList.remove("hidden");
    });
  }

if (publishBookBtn) {
  publishBookBtn.addEventListener("click", async () => {
    try {
      const fd = new FormData();

      // --- Required fields ---
      fd.append("title", bookData.title || "");
      fd.append("author", bookData.author || "");
      fd.append("publisher", bookData.publisher || "");
      fd.append("year", bookData.year || "");
      // join multiple selected genres into a single string
if (bookData.categories && bookData.categories.length > 0) {
  bookData.categories.forEach(c => fd.append("category", c));
} else {
  fd.append("category", "");
}

      fd.append("description", bookData.description || "");

      // --- Cover file ---
      if (bookData.coverFile) {
        fd.append("cover", bookData.coverFile);
      }

      // --- Page files ---
if (bookData.pageFiles && bookData.pageFiles.length > 0) {
  const texts = [];
  bookData.pageFiles.forEach((p) => {
    fd.append("pages", p.file);
    texts.push(p.text || "");
  });
  fd.append("pageTexts", JSON.stringify(texts));
}

      // --- Debug log (optional) ---
      for (let pair of fd.entries()) {
        console.log(pair[0], pair[1]);
      }

      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // ✅ only auth header, no content-type
        body: fd,
      });

      if (!res.ok) {
        const errMsg = await res.text();
        throw new Error(`Failed to publish book: ${errMsg}`);
      }

showPopup("✅ Book published successfully");
bookCreationSection.classList.add("hidden");
conversionSection.classList.remove("hidden");

// ✅ clear bookData + reset form
bookData = {};
document.getElementById("bookMetaForm").reset();
document.getElementById("coverFileName").textContent = "No file chosen";
document.getElementById("pageFileName").textContent = "No file chosen";
document.getElementById("pageList").innerHTML = "";

// refresh all book views
await loadConversionBooks();
await loadBooks();
await loadBrowseBooks();

    } catch (err) {
      console.error("❌ Publish failed:", err);
      showPopup("❌ Failed to publish book", "error");
    }
  });
}

  // --- Back buttons ---
document.getElementById("backToHomeBtn").addEventListener("click", () => {
  bookDetailsSection.classList.add("hidden");

  // ✅ return to last section (Browse or Home)
  if (window.lastSection) {
    window.lastSection.classList.remove("hidden");
  } else {
    homeSection.classList.remove("hidden"); // fallback
  }
});

  document.getElementById("backToDetailsBtn").addEventListener("click", () => {
    bookReaderSection.classList.add("hidden");
    bookDetailsSection.classList.remove("hidden");
  });

  document.getElementById("backToConversion").addEventListener("click", () => {
    bookCreationSection.classList.add("hidden");
    conversionSection.classList.remove("hidden");
  });

  // --- Reader ---
  const readBookBtn = document.getElementById("readBookBtn");
  if (readBookBtn) {
    readBookBtn.addEventListener("click", () => {
      if (!window.currentBook) return;
      bookDetailsSection.classList.add("hidden");
      bookReaderSection.classList.remove("hidden");
      document.getElementById("readerBookTitle").textContent =
        window.currentBook.title;

      const readerContent = document.getElementById("readerContent");
      readerContent.innerHTML = "";
      if (window.currentBook.pages && window.currentBook.pages.length > 0) {
        window.currentBook.pages.forEach((page, idx) => {
          const div = document.createElement("div");
          div.className = "page";
          div.innerHTML = `
            <h4 class="page-label">Page ${idx + 1}</h4>
            <div class="ocr-text">${page.text || "No text detected."}</div>
          `;
          readerContent.appendChild(div);
        });
      } else {
        readerContent.innerHTML = "<p>No pages available for this book.</p>";
      }
    });
  }

  const bookmarksTab = document.getElementById("bookmarksTab");
const bookmarksSection = document.getElementById("bookmarksSection");
const bookmarksGrid = document.getElementById("bookmarksGrid");

// --- Nav: Bookmarks ---
if (bookmarksTab) {
  bookmarksTab.addEventListener("click", (e) => {
    e.preventDefault();
    homeSection.classList.add("hidden");
    conversionSection.classList.add("hidden");
    browseSection.classList.add("hidden");
    bookDetailsSection.classList.add("hidden");
    bookCreationSection.classList.add("hidden");
    bookReaderSection.classList.add("hidden");
    bookmarksSection.classList.remove("hidden");
    loadBookmarks();
  });
}

// --- Add to bookmark ---
document.querySelector(".btn-add-bookmark").addEventListener("click", async () => {
  const token = sessionStorage.getItem("token");
  if (!token) return showPopup("Please login first", "error");

  // ✅ read bookId from dataset
  const bookId = document.getElementById("detailTitle").dataset.bookId;
  if (!bookId) {
    showPopup("❌ No book selected", "error");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/bookmarks/${bookId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();
    showPopup(data.message, "success");
  } catch (err) {
    console.error("❌ Add bookmark failed:", err);
    showPopup("Failed to add bookmark", "error");
  }
});

// --- Load bookmarks ---
async function loadBookmarks() {
  try {
    const token = sessionStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch bookmarks");

    const bookmarks = await res.json();
    bookmarksGrid.innerHTML = "";
    bookmarks.forEach((book) => {
      const div = document.createElement("div");
      div.className = "book";
      div.innerHTML = `
        <img src="${book.img}" alt="${book.title}">
        <h4>${book.title}</h4>
      `;
      div.addEventListener("click", () => showBookDetails(book, bookmarksSection));
      bookmarksGrid.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Error loading bookmarks:", err);
  }
}


  // --- Init ---
if (browseTab) {
  browseTab.addEventListener("click", (e) => {
    e.preventDefault();
    browseSection.classList.remove("hidden");
    homeSection.classList.add("hidden");
    conversionSection.classList.add("hidden");
    bookDetailsSection.classList.add("hidden");
    bookCreationSection.classList.add("hidden");
    bookReaderSection.classList.add("hidden");

    loadGenres();        // ✅ load genres dynamically
    loadBrowseBooks();   // ✅ load books
  });
}

  loadBooks();
  loadConversionBooks();
});
