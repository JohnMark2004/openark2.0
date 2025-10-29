document.addEventListener("DOMContentLoaded", () => {
  let bookToDelete = null;
  let bookData = {};
  let allBooks = []; // ✅ Add this near your other global variables


  // --- Popup/Toast Notification Function ---
  function showPopup(message, type = "success") {
    const popup = document.getElementById("popup");
    if (!popup) return;
    popup.textContent = message;
    popup.className = `popup ${type} show`;
    setTimeout(() => popup.classList.remove("show"), 3000);
  }
  // ✅ ADD THIS BLOCK
  // --- Show Welcome Message on Login ---
  if (sessionStorage.getItem("justLoggedIn") === "true") {
    const username = localStorage.getItem("username") || "User";
    showPopup(`Welcome ${username} to OpenArk!`, "success");
    sessionStorage.removeItem("justLoggedIn"); // Clear the flag
  }

  // API BASE URL
  // ✅ Auto-detect local vs deployed environment
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://openark2-0.onrender.com";


  // --- Auth Check ---
  if (!sessionStorage.getItem("token")) {
    window.location.href = "intro.html";
    return;
  }

  // ----- WebSocket Setup -----
const socket = io(API_URL.replace("/api", ""), {
  transports: ["websocket"],
});


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

// 🔧 Universal Loader Controls
function showLoader(id = "globalLoader") {
  const loader = document.getElementById(id);
  if (loader) loader.classList.remove("hidden");
}

function hideLoader(id = "globalLoader") {
  const loader = document.getElementById(id);
  if (loader) loader.classList.add("hidden");
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
// --- Role-based Conversion Access ---
const conversionTab = document.getElementById("conversionTab");
const conversionMenu = document.querySelector(".nav-dropdown-menu");
const conversionLink = document.querySelector("nav a:nth-child(2)");
const role = localStorage.getItem("role") || "student";
// ✅ Get Reports Tab
const reportsTab = document.getElementById("reportsTab");
// ✅ Hide conversion features completely for students
if (role !== "librarian") {
  if (conversionTab) conversionTab.style.display = "none";
  if (conversionMenu) conversionMenu.classList.add("hidden");
  if (conversionLink) conversionLink.style.display = "none";
  if (conversionSection) conversionSection.classList.add("hidden");
  if (reportsTab) reportsTab.style.display = "none";
} else {
  // ✅ Librarian: enable normal dropdown
  if (conversionTab && conversionMenu) {
    conversionTab.addEventListener("click", (e) => {
      e.preventDefault();
      conversionMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!conversionMenu.contains(e.target) && e.target !== conversionTab) {
        conversionMenu.classList.add("hidden");
      }
    });
  }
}


document.querySelectorAll(".nav-option").forEach(option => {
  option.addEventListener("click", async () => {
    const value = option.dataset.value;
    conversionMenu.classList.add("hidden");

    if (value === "organization") {
      openAddBookForm();
    } else if (value === "project") {
  // ✅ Hide the Add Book steps if they were open
  bookCreationSection.classList.add("hidden");

  // Show only the Books section
  conversionSection.classList.remove("hidden");
  homeSection.classList.add("hidden");
  browseSection.classList.add("hidden");
  bookDetailsSection.classList.add("hidden");
  bookReaderSection.classList.add("hidden");
  bookmarksSection.classList.add("hidden");
  reportsSection.classList.add("hidden");

  // ✅ Show the container
  const conversionBooks = document.getElementById("conversionBooks");
  conversionBooks.classList.remove("hidden");

  // ✅ Load books with delete buttons
    // ✅ Load books with delete buttons
  await loadBooksForDeletion();  // ✅ Correct function name


  // ✅ Remove the "+ Add Book" card
  const addBookCard = document.getElementById("addBookBtn");
  if (addBookCard) addBookCard.remove();
}
  });
});

  const browseTab = document.getElementById("browseTab");

  // --- Role-based UI ---
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

if (addPageBtn) {
  addPageBtn.addEventListener("click", async () => {
    const file = pageUpload.files[0];
    if (!file) {
      showPopup("⚠️ Please choose a page file first", "error");
      return;
    }

    const ocrSpinner = document.getElementById("ocrSpinner");
    ocrSpinner.classList.remove("hidden"); // 👈 show spinner

    async function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    showPopup("Scanning Page... This may take a moment.", "info");
    try {
      const base64 = await fileToBase64(file);

      const res = await fetch(`${API_URL}/api/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
        }),
      });

// ✅ Call res.json() only ONCE
      const data = await res.json();

      // ✅ Check if the response is OK AND if text was actually extracted
      if (res.ok && data.text && data.text.trim() !== "") {
          const text = data.text;
          if (!bookData.pageFiles) bookData.pageFiles = [];
          bookData.pageFiles.push({ file, text }); // Only add if text exists

          // ... (preview rendering logic) ...
          const div = document.createElement("div");
          div.className = "page-preview";
          div.innerHTML = `
            <span>${file.name} - OCR successful</span>
            <button class="remove-page-btn">Remove</button>
          `;
          div.querySelector(".remove-page-btn").addEventListener("click", () => {
             const indexToRemove = bookData.pageFiles.findIndex(p => p.file === file);
             if (indexToRemove > -1) {
                 bookData.pageFiles.splice(indexToRemove, 1);
             }
            pageList.removeChild(div);
          });
          pageList.appendChild(div);

          pageUpload.value = ""; // Clear file input
          pageFileName.textContent = "No file chosen";
          showPopup("Scan complete! Text extracted.", "success");

      } else {
          // Handle cases where OCR returned empty text or fetch failed
          showPopup("⚠️ Scan complete, but no text detected on page.", "warning");

          // Still add the page but without text
          if (!bookData.pageFiles) bookData.pageFiles = [];
           bookData.pageFiles.push({ file, text: "" }); // Add with empty text

           // Render preview indicating no text
           const div = document.createElement("div");
             div.className = "page-preview no-text";
             div.innerHTML = `
               <span>${file.name} - No text found</span>
               <button class="remove-page-btn">Remove</button>
             `;
           div.querySelector(".remove-page-btn").addEventListener("click", () => {
             const indexToRemove = bookData.pageFiles.findIndex(p => p.file === file);
             if (indexToRemove > -1) bookData.pageFiles.splice(indexToRemove, 1);
             pageList.removeChild(div);
           });
           pageList.appendChild(div);

           pageUpload.value = "";
           pageFileName.textContent = "No file chosen";

           // Log the actual error if the fetch itself failed
           if (!res.ok) {
               console.error("OCR API call failed:", data.error || `Status ${res.status}`);
           }
      }
    // Note: The 'catch' block wasn't included in your paste, but make sure it's still there
    } catch (err) {
      console.error("OCR error during fetch or processing:", err); // More specific catch message
      showPopup("⚠️ OCR failed due to an error. Page saved without text.", "error"); // Adjusted catch popup
      // Still add page with empty text on error, as per original logic
      if (!bookData.pageFiles) bookData.pageFiles = [];
      bookData.pageFiles.push({ file, text: "" });
       // You might want to add preview rendering here too for consistency on error
    } finally {
      ocrSpinner.classList.add("hidden"); // 👈 hide spinner
    }
  }); // End of addPageBtn listener
} // End of if(addPageBtn)

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
      bookmarksSection.classList.add("hidden");
      reportsSection.classList.add("hidden");
    });
  }

function openAddBookForm() {
  // Hide all sections except book creation
  document.getElementById("homeSection").classList.add("hidden");
  document.getElementById("conversionSection").classList.add("hidden");
  document.getElementById("browseSection").classList.add("hidden");
  document.getElementById("bookDetailsSection").classList.add("hidden");
  document.getElementById("bookReaderSection").classList.add("hidden");
  document.getElementById("bookCreationSection").classList.remove("hidden");
  document.getElementById("reportsSection")?.classList.add("hidden");

  // ✅ Remove this line (no such element anymore)
  // document.getElementById("conversionDropdown").value = "";

  // ✅ Always reset wizard to Step 1
  document.querySelectorAll(".creation-step").forEach((s) =>
    s.classList.add("hidden")
  );
  const firstStep = document.getElementById("step1");
  if (firstStep) firstStep.classList.remove("hidden");

  // ✅ Reset form + file names + page list
  document.getElementById("bookMetaForm").reset();
  document.getElementById("coverFileName").textContent = "No file chosen";
  document.getElementById("pageFileName").textContent = "No file chosen";
  document.getElementById("pageList").innerHTML = "";

  // Clear stored bookData
  bookData = {};
}

// Load books with delete buttons
async function loadBooksForDeletion() {
  const loadingSpinner = document.getElementById("loadingSpinnerConversion");
  if (loadingSpinner) loadingSpinner.classList.remove("hidden");

  try {
    const res = await fetch(`${API_URL}/api/books`);
    const books = await res.json();

    const container = document.getElementById("conversionBooks");
    container.innerHTML = "";

    books.forEach((book) => {
      const div = document.createElement("div");
      div.className = "book";
      div.innerHTML = `
        <img src="${book.img}" alt="${book.title}">
        <h4>${book.title}</h4>
        <p class="genre-label">(${book.category[0] || "N/A"})</p>
        <button class="btn btn-delete" data-id="${book._id}">Delete</button>
      `;

      // ✅ Make entire card clickable (except the delete button)
      div.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-delete")) return; // ignore delete button clicks
        showBookDetails(book, conversionSection);
      });

      container.appendChild(div);
    });

// --- Delete button logic (with modal) ---
document.querySelectorAll(".btn-delete").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    const bookCard = btn.closest(".book");
    const title = bookCard.querySelector("h4")?.textContent || "this book";

    // update modal text
    document.getElementById("deleteModalMessage").textContent =
      `Are you sure you want to delete “${title}”?`;

    // show modal
    const modal = document.getElementById("deleteModal");
    modal.classList.remove("hidden");

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");

    // remove old event listeners (prevent duplicates)
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    // cancel action
    newCancel.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    // confirm delete
    newConfirm.addEventListener("click", async () => {
      const token = sessionStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/books/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok) {
          showPopup(`Deleted “${title}” successfully`, "success");
          await loadBooksForDeletion();
        } else {
          showPopup(`❌ ${data.error || "Failed to delete"}`, "error");
        }
      } catch (err) {
        console.error("Delete error:", err);
        showPopup("❌ Failed to delete book", "error");
      } finally {
        modal.classList.add("hidden");
      }
    });
  });
});

  } catch (err) {
    console.error("Failed to load books:", err);
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
  }
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
      bookmarksSection.classList.add("hidden");
      reportsSection.classList.add("hidden");
      loadBrowseBooks();
    });
  }

// --- Profile Dropdown Logic ---
const navProfileImg = document.getElementById("navProfileImg");
const dropdown = document.getElementById("profileDropdown");
const dropdownProfileImg = document.getElementById("dropdownProfileImg");
const dropdownUsername = document.getElementById("dropdownUsername");
const dropdownEmail = document.getElementById("dropdownEmail");

if (navProfileImg && dropdown) {
  // Populate user info
  const username = localStorage.getItem("username") || "User";
let pfp = localStorage.getItem("pfp") || "assets/default-pfp.png";

// 🧩 If librarian, assign default local PNGs
const email = localStorage.getItem("email");
if (email?.includes("librarian")) {
  const num = email.match(/\d+/)?.[0] || "1";
  pfp = `assets/librarian${num}.png`;
  localStorage.setItem("pfp", pfp);
}


  dropdownUsername.textContent = username;
  dropdownEmail.textContent = email;
  navProfileImg.src = pfp;
  dropdownProfileImg.src = pfp;

  // Toggle dropdown on click
  navProfileImg.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
  });

  // Close dropdown if clicked outside
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== navProfileImg) {
      dropdown.classList.add("hidden");
    }
  });
}

  // --- Load Books for Home ---
  const featuredBookContainer = document.getElementById("featuredBook");

  // --- Book Creation: Category Button Single-Select ---
const categoriesContainer = document.getElementById("categoriesButtons");

if (categoriesContainer) {
  categoriesContainer.addEventListener("click", (event) => {
    // Ensure we clicked a button
    const clickedBtn = event.target.closest(".genre-btn");
    if (!clickedBtn) return; // Didn't click a button

    // 1. Remove 'active' from all other buttons in this container
    categoriesContainer.querySelectorAll(".genre-btn").forEach(button => {
        button.classList.remove("active");
    });

    // 2. Add 'active' class ONLY to the clicked button
    clickedBtn.classList.add("active");
  });
}


// ✅ Genre Filter Handler (Single Select for Browse)
const browseGenreContainer = document.getElementById("genreFilters");

if (browseGenreContainer) {
    browseGenreContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains("genre-btn")) {
            const clickedBtn = event.target;

            // 1. Remove 'active' from all buttons within this specific container
            browseGenreContainer.querySelectorAll(".genre-btn").forEach(button => {
                button.classList.remove("active");
            });

            // 2. Add 'active' only to the clicked button
            clickedBtn.classList.add("active");

            // 3. Trigger filtering
            gatherAllFilterValuesAndRun(); // ✅ FIXED

            // 4. Update "Showing: ..." title
            const genre = clickedBtn.dataset.genre;
            const genreTitle = document.getElementById("currentGenreTitle");
            if (genreTitle) {
                const label = genre === "all" ? "All Books" : genre;
                genreTitle.textContent = `Showing: ${label}`;
            }
        }
    });
}

// 📚 Load Recently Added Books (Home Section)
async function loadBooks() {
  showLoader("loadingSpinnerHome");
  const dashboardBooks = document.getElementById("dashboardBooks");
  const loadingSpinner = document.getElementById("loadingSpinner");
  if (!dashboardBooks || !loadingSpinner) return;

  try {
    // 🔄 Show spinner while loading
    loadingSpinner.classList.remove("hidden");
    dashboardBooks.innerHTML = "";

    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    // ✅ Hide spinner after load
    loadingSpinner.classList.add("hidden");

    // Sort newest → oldest
    books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 📘 Only show 6 newest
    const recentBooks = books.slice(0, 6);

    // Build cards
    recentBooks.forEach(book => {
      const div = document.createElement("div");
      div.className = "book";

      const firstGenre = Array.isArray(book.category)
        ? book.category[0]
        : (book.category?.split(",")[0] || "Unknown");

      div.innerHTML = `
        <img src="${book.img}" alt="${book.title}">
        <h4>${book.title}</h4>
        <p class="genre-label">${firstGenre.trim()}</p>
      `;

      div.addEventListener("click", () => showBookDetails(book, homeSection));
      dashboardBooks.appendChild(div);
    });

  } catch (err) {
    console.error("❌ Error loading books:", err);
    loadingSpinner.classList.add("hidden");
    dashboardBooks.innerHTML = `<p style="opacity:0.7;text-align:center;">Failed to load books.</p>`;
  }
  hideLoader("loadingSpinnerHome");
}

async function saveLastRead(book, lastPage = 1) {
  const token = sessionStorage.getItem("token");
  if (!token) return;

  try {
    await fetch(`${API_URL}/api/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookId: book._id, lastPage }),
    });
  } catch (err) {
    console.error("❌ Failed to save progress:", err);
  }
}

async function loadContinueReading() {
  
  const token = sessionStorage.getItem("token");
  const container = document.getElementById("continueReadingGrid");
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}/api/continue`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const books = await res.json();

    container.innerHTML = "";
    if (books.length === 0) {
      container.innerHTML = `<p style="opacity:0.7;">No recent reads yet.</p>`;
      return;
    }

    books.forEach(book => {
      const div = document.createElement("div");
      div.className = "book";
const firstGenre = Array.isArray(book.category)
  ? book.category[0]
  : (book.category?.split(",")[0] || "Unknown");

div.innerHTML = `
  <img src="${book.img}" alt="${book.title}">
  <h4>${book.title}</h4>
  <p class="genre-label">${firstGenre.trim()}</p>
`;
      div.addEventListener("click", async () => {
try {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API_URL}/api/books/${book._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const fullBook = res.ok ? await res.json() : book;
  showBookDetails(fullBook, document.getElementById("homeSection"));
} catch (err) {
  console.error("❌ Failed to fetch full book info:", err);
  showBookDetails(book, document.getElementById("homeSection"));
}
});

      container.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Failed to load continue reading:", err);
  }
}

// 🎞️ BOOK SLIDESHOW (Home Banner) — smooth + spam-proof
async function loadBookSlideshow() {
  showLoader("loadingSpinnerSlide");
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    const slideshow = document.getElementById("bookSlideshow");
    if (!slideshow) return;

    if (!books || books.length === 0) {
      slideshow.innerHTML = `<p class="no-books" style="padding:12px;opacity:0.8;">No books available.</p>`;
      return;
    }

    // clone first and last slides for looping
    const firstClone = { ...books[0] };
    const lastClone = { ...books[books.length - 1] };
    const fullList = [lastClone, ...books, firstClone];

    slideshow.innerHTML = fullList.map(book => `
      <div class="book-slide">
        <img src="${book.img}" alt="${book.title}">
        <div class="slide-info">
<h3 class="book-title">${book.title}</h3>
<p class="book-meta">
    <strong>Category:</strong> ${Array.isArray(book.category) ? book.category.join(", ") : book.category || "Uncategorized"}
<strong>•</strong> <strong>Author:</strong> ${book.author}
  <strong>•</strong> <strong>Year:</strong> ${book.year}
</p>
<p class="book-desc"><strong>Description</strong></p>
<p class="book-desc-p">${book.description || "No description available."}</p>

          <button class="btn btn-read-slide" data-id="${book._id}">Read</button>
        </div>
      </div>
    `).join("");

    const slides = slideshow.querySelectorAll(".book-slide");
    const total = slides.length;
    let current = 1;
    let isTransitioning = false;

    slideshow.style.transform = `translateX(-${current * 100}%)`;
    slideshow.style.transition = "transform 0.6s ease";

    function goToSlide(index) {
      if (isTransitioning) return; // 🚫 prevent spam clicks
      isTransitioning = true;
      current = index;
      slideshow.style.transition = "transform 0.6s ease";
      slideshow.style.transform = `translateX(-${current * 100}%)`;
    }

    slideshow.addEventListener("transitionend", () => {
      // seamless looping logic
      if (current === 0) {
        slideshow.style.transition = "none";
        current = total - 2;
        slideshow.style.transform = `translateX(-${current * 100}%)`;
      } else if (current === total - 1) {
        slideshow.style.transition = "none";
        current = 1;
        slideshow.style.transform = `translateX(-${current * 100}%)`;
      }
      // small timeout to re-enable clicks after transition
      setTimeout(() => (isTransitioning = false), 100);
    });

    // Navigation
    const nextBtn = document.getElementById("nextSlide");
    const prevBtn = document.getElementById("prevSlide");

    if (nextBtn)
      nextBtn.onclick = () => goToSlide(current + 1);
    if (prevBtn)
      prevBtn.onclick = () => goToSlide(current - 1);

    // Auto-play every 7 seconds
    let interval = setInterval(() => goToSlide(current + 1), 7000);

    // Pause on hover
    slideshow.addEventListener("mouseenter", () => clearInterval(interval));
    slideshow.addEventListener("mouseleave", () => {
      interval = setInterval(() => goToSlide(current + 1), 7000);
    });

    // “Read” button inside slides
    slideshow.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-read-slide");
      if (!btn) return;
      const bookId = btn.dataset.id;
      const selected = books.find(b => b._id === bookId);
      if (selected) showBookDetails(selected, document.getElementById("homeSection"));
    });

  } catch (err) {
    console.error("❌ Slideshow error:", err);
  }
  hideLoader("loadingSpinnerSlide");
}

// initial call (keep this)
loadBookSlideshow();

  // --- Load Books for Conversion (Librarian) ---
  async function loadConversionBooks() {
    showLoader("loadingSpinnerConversion");
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
        // addBookCard.innerHTML = `<span>＋</span><p>Add Book</p>`;
        conversionBooks.appendChild(addBookCard);

        // Book cards
        books.forEach((book) => {
          const div = document.createElement("div");
          div.className = "book";
const firstGenre = Array.isArray(book.category)
  ? book.category[0]
  : (book.category?.split(",")[0] || "Unknown");

div.innerHTML = `
  <img src="${book.img}" alt="${book.title}">
  <h4>${book.title}</h4>
  <p class="genre-label">${firstGenre.trim()}</p>
              <button class="delete-btn">Delete</button>
`;


          div.querySelector("img").addEventListener("click", () =>
            showBookDetails(book, conversionSection)
          );

div.querySelector(".delete-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const modal = document.getElementById("deleteModal");
  const msg = document.getElementById("deleteModalMessage");
  const confirmBtn = document.getElementById("confirmDeleteBtn");
  const cancelBtn = document.getElementById("cancelDeleteBtn");

  // set book to delete
  bookToDelete = book;
  msg.textContent = `Are you sure you want to delete “${book.title}”?`;

  // show modal
  modal.classList.remove("hidden");

  // remove old listeners (avoid stacking)
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  // cancel
  newCancel.addEventListener("click", () => {
    modal.classList.add("hidden");
    bookToDelete = null;
  });

  // confirm delete
  newConfirm.addEventListener("click", async () => {
    const token = sessionStorage.getItem("token");
    if (!bookToDelete) return;

    try {
      const res = await fetch(`${API_URL}/api/books/${bookToDelete._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        showPopup(`Deleted “${bookToDelete.title}” successfully`, "success");
        await loadConversionBooks();
      } else {
        showPopup(`❌ ${data.error || "Failed to delete"}`, "error");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showPopup("❌ Failed to delete book", "error");
    } finally {
      modal.classList.add("hidden");
      bookToDelete = null;
    }
  });
});


          conversionBooks.appendChild(div);
        });

// --- Delete Modal actions (Safe) ---
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", () => {
    bookToDelete = null;
    document.getElementById("deleteModal").classList.add("hidden");
  });
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!bookToDelete) return;
    try {
      const token = sessionStorage.getItem("token");
      const bookId = bookToDelete._id;
      if (!bookId) throw new Error("No valid _id found for book");

      const res = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        // throw new Error(errText || "Failed to delete book");
      }

      await res.json().catch(() => {});
      showPopup("Book deleted successfully", "success");

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
}


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
    // ✅ Force remove Add Book button if it ever exists
const leftoverAddBook = document.getElementById("addBookBtn");
if (leftoverAddBook) leftoverAddBook.remove();

        hideLoader("loadingSpinnerConversion");
  }

// --- Browse Tab logic ---
async function loadBrowseBooks({ search = "", sort = "newest", genre = "all" } = {}) {
  showLoader("loadingSpinnerBrowse");
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    allBooks = books;

    let filtered = books;

    // 🔹 Filter by genre
    if (genre && genre !== "all") {
      filtered = filtered.filter((book) =>
        Array.isArray(book.category)
          ? book.category.includes(genre)
          : (book.category || "").toLowerCase().includes(genre.toLowerCase())
      );
    }

// 🔹 Filter by search (Title)
if (search) {
  const query = search.toLowerCase();
  filtered = filtered.filter(book =>
    book.title?.toLowerCase().includes(query)
  );
}


    // 🔹 Sort
    if (sort === "az") filtered.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "za") filtered.sort((a, b) => b.title.localeCompare(a.title));
    else if (sort === "newest") filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === "oldest") filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // 🔹 Display results
    const browseBooks = document.getElementById("browseBooks");
    browseBooks.innerHTML = "";

    if (filtered.length === 0) {
      browseBooks.innerHTML = `<p>No books found for this genre.</p>`;
      return;
    }

    filtered.forEach((book) => {
      const div = document.createElement("div");
      div.className = "book";
const firstGenre = Array.isArray(book.category)
  ? book.category[0]
  : (book.category?.split(",")[0] || "Unknown");

div.innerHTML = `
  <img src="${book.img}" alt="${book.title}">
  <h4>${book.title}</h4>
  <p class="genre-label">${firstGenre.trim()}</p>
`;

      div.addEventListener("click", () => showBookDetails(book, browseSection));
      browseBooks.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Error loading browse books:", err);
  }
  hideLoader("loadingSpinnerBrowse");
}

// Browse filters events
const browseSearch = document.getElementById("browseSearch");
if (browseSearch) {
  browseSearch.addEventListener("input", gatherAllFilterValuesAndRun);
}


const browseSort = document.getElementById("browseSort");
if (browseSort) {
  browseSort.addEventListener("change", () => {
    const search = document.getElementById("browseSearch")?.value.trim() || "";
    const sort = browseSort.value;
    const genre = document.querySelector(".genre-btn.active")?.dataset.genre || "all";
    loadBrowseBooks({ search, sort, genre });
  });
}

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
    Author: <strong>${book.author}</strong>
    &nbsp;&nbsp; Publisher: <span class="value">${book.publisher}</span>
    &nbsp;&nbsp; Year: <span class="value">${book.year}</span>
  `;
  document.getElementById("detailCategory").textContent = genres;
  document.getElementById("detailCategoryStat").textContent = genres;
  document.getElementById("detailDescription").textContent =
    book.description || "No description available.";
  document.getElementById("disclaimer").textContent =
    "Disclaimer: This book is from the library...";
  document.getElementById("detailChapters").textContent =
    book.pages && book.pages.length > 0
      ? `${book.pages.length} Pages`
      : "N/A";

  window.currentBook = book;
}

// ===============================
// LIBRARIAN: ADD MORE PAGES (Simplified - Uses Backend OCR)
// ===============================
const addMorePagesBtn = document.getElementById("addMorePagesBtn");

function enableAddMorePages(book) {
  if (!addMorePagesBtn || !book || !book._id) return;

  // Only librarians can see this button
  if (role === "librarian") {
    addMorePagesBtn.classList.remove("hidden");

    // Remove previous listener to prevent stacking if function is called multiple times
    addMorePagesBtn.onclick = null; // Clear previous handler

    addMorePagesBtn.onclick = () => { // Assign new handler
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;

      fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files);
        if (files.length === 0) return;

        // Show immediate feedback
        showPopup(`⏳ Uploading ${files.length} page(s) for OCR...`, "info");
        addMorePagesBtn.disabled = true; // Disable button during upload

        const formData = new FormData();
        files.forEach(f => formData.append("pages", f));
        // NO need to send pageTexts - backend will do the OCR

        const token = sessionStorage.getItem("token");
        try {
          const res = await fetch(`${API_URL}/api/books/${book._id}/add-pages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }, // Content-Type is set automatically for FormData
            body: formData,
          });

          const data = await res.json();
          if (res.ok) {
            showPopup(`${files.length} page(s) added successfully!`, "success");

            // Update page count in UI immediately
            if (!currentBook.pages) currentBook.pages = [];
             // Ensure currentBook is updated if 'book' param might be stale
             currentBook.pages.push(...(data.pages || []));
            document.getElementById("detailChapters").textContent =
              `${currentBook.pages.length} Pages`;

          } else {
             // Extract backend error, including specific Gemini failures
             let errorMessage = data.error || "Failed to add pages";
             if (data.details && data.details.includes("OCR failed")) {
                 errorMessage += ". OCR processing failed on the server.";
             }
            showPopup(`❌ ${errorMessage}`, "error");
          }
        } catch (err) {
            console.error("❌ Add pages upload/OCR failed:", err);
            showPopup("❌ Network error or server issue adding pages.", "error");
        } finally {
            addMorePagesBtn.disabled = false; // Re-enable button
        }
      }); // End fileInput change listener

      fileInput.click(); // Trigger file selection
    }; // End addMorePagesBtn onclick assignment

  } else {
    addMorePagesBtn.classList.add("hidden");
  }
}

// ===============================
// ✅ LIBRARIAN: IN-LINE DESCRIPTION EDITOR
// ===============================
function setupDescriptionEditor(book) {
    const role = localStorage.getItem("role");
    const editBtn = document.getElementById("editDescriptionBtn");
    const descriptionP = document.getElementById("detailDescription");
    const editForm = document.getElementById("editDescriptionForm");
    const textarea = document.getElementById("editDescriptionTextarea");
    const saveBtn = document.getElementById("saveDescriptionBtn");
    const cancelBtn = document.getElementById("cancelEditDescriptionBtn");

    // Hide everything by default, show based on role
    editForm.classList.add('hidden');
    descriptionP.classList.remove('hidden');

    if (role === 'librarian') {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
        return; // Stop here if not a librarian
    }

    // --- Event Listeners ---

    // EDIT button: Show the form
    editBtn.onclick = () => {
        textarea.value = descriptionP.textContent; // Pre-fill with current text
        descriptionP.classList.add('hidden');
        editForm.classList.remove('hidden');
        editBtn.classList.add('hidden');
    };

    // CANCEL button: Hide form and restore text view
    cancelBtn.onclick = () => {
        descriptionP.classList.remove('hidden');
        editForm.classList.add('hidden');
        editBtn.classList.remove('hidden');
    };

    // SAVE button: Send update to server
    saveBtn.onclick = async () => {
        const newDescription = textarea.value;
        const token = sessionStorage.getItem("token");
        saveBtn.disabled = true; // Prevent double-clicks

        try {
            const res = await fetch(`${API_URL}/api/books/${book._id}/description`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newDescription })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save description');
            }

            showPopup('Description updated successfully!', 'success');
            descriptionP.textContent = newDescription; // Update UI text
            window.currentBook.description = newDescription; // Update temp state

            // Restore view
            descriptionP.classList.remove('hidden');
            editForm.classList.add('hidden');
            editBtn.classList.remove('hidden');

        } catch (err) {
            console.error("Save description error:", err);
            showPopup(err.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    };
}

// ===============================
// BOOKMARK TOGGLE LOGIC
// ===============================

// helper to fetch current bookmarks
async function getBookmarks() {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return [];
    const res = await fetch(`${API_URL}/api/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch bookmarks");
    return await res.json();
  } catch (err) {
    console.error("❌ Error fetching bookmarks:", err);
    return [];
  }
}

// override existing showBookDetails to include button toggle
const originalShowBookDetails = showBookDetails;
showBookDetails = async function (book, fromSection) {
  // call original
  originalShowBookDetails(book, fromSection);
  enableAddMorePages(book);
  setupDescriptionEditor(book);

  const token = sessionStorage.getItem("token");
  const addBookmarkBtn = document.querySelector(".btn-add-bookmark");
  if (!addBookmarkBtn) return;

  // check current bookmarks
  const bookmarks = await getBookmarks();
  let isBookmarked = bookmarks.some((b) => b._id === book._id);

  // update button label + style
  addBookmarkBtn.textContent = isBookmarked
    ? "REMOVE BOOKMARK"
    : "+ ADD TO BOOKMARK";
  addBookmarkBtn.classList.toggle("bookmarked", isBookmarked);

  // add click toggle
  addBookmarkBtn.onclick = async () => {
    try {
      const method = isBookmarked ? "DELETE" : "POST";
      const res = await fetch(`${API_URL}/api/bookmarks/${book._id}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      showPopup(data.message, "success");

      // flip state
      isBookmarked = !isBookmarked;
      addBookmarkBtn.textContent = isBookmarked
        ? "REMOVE BOOKMARK"
        : "+ ADD TO BOOKMARK";
      addBookmarkBtn.classList.toggle("bookmarked", isBookmarked);
    } catch (err) {
      console.error("❌ Toggle bookmark failed:", err);
      showPopup("Failed to update bookmark", "error");
    }
  };
};

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

    const title = fd.get("title")?.trim();
    const author = fd.get("author")?.trim();
    const publisher = fd.get("publisher")?.trim();
    const year = fd.get("year")?.trim();
    const description = fd.get("description")?.trim();
    const categories = Array.from(
      document.querySelectorAll("#categoriesButtons button.active")
    ).map(btn => btn.dataset.genre);

    if (!title || !author || !publisher || !year || categories.length === 0) {
      showPopup("⚠️ Please fill out all required fields", "error");
      return;
    }

    bookData = {
      title,
      author,
      publisher,
      year: Number(year),
      categories,
      description,
      pages: [],
      pageFiles: [],
      coverFile: document.getElementById("coverUpload").files[0] || null
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
    const spinner = document.getElementById("ocrSpinner"); // ✅ reuse Step 2 loader
    try {
      // ✅ Show spinner + disable button
      if (spinner) spinner.classList.remove("hidden");
      publishBookBtn.disabled = true;

      const fd = new FormData();

      // --- Required fields ---
      fd.append("title", bookData.title || "");
      fd.append("author", bookData.author || "");
      fd.append("publisher", bookData.publisher || "");
      fd.append("year", bookData.year || "");
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

      for (let pair of fd.entries()) {
        console.log(pair[0], pair[1]);
      }

      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const errMsg = await res.text();
        throw new Error(`Failed to publish book: ${errMsg}`);
      }

      showPopup("Book published successfully");

      // ✅ Hide creation form
      bookCreationSection.classList.add("hidden");

      // ✅ Show the books list again
      conversionSection.classList.remove("hidden");
      document.getElementById("conversionBooks").classList.remove("hidden");

      // ✅ Reset forms
      bookData = {};
      document.getElementById("bookMetaForm").reset();
      document.getElementById("coverFileName").textContent = "No file chosen";
      document.getElementById("pageFileName").textContent = "No file chosen";
      document.getElementById("pageList").innerHTML = "";

      // ✅ Refresh UI
      await loadConversionBooks();
      await loadBooks();
      await loadBrowseBooks();

    } catch (err) {
      console.error("❌ Publish failed:", err);
      showPopup("❌ Failed to publish book", "error");
    } finally {
      // ✅ Hide spinner + re-enable button
      if (spinner) spinner.classList.add("hidden");
      publishBookBtn.disabled = false;
    }
  });
}

  // --- Back buttons ---
document.getElementById("backToHomeBtn").addEventListener("click", () => {
    document.querySelectorAll(".ppt-outline-section").forEach(el => el.remove());
  bookDetailsSection.classList.add("hidden");

  // ✅ return to last section (Browse or Home)
  if (window.lastSection) {
    window.lastSection.classList.remove("hidden");
  } else {
    homeSection.classList.remove("hidden"); // fallback
  }
});

  document.getElementById("backToDetailsBtn").addEventListener("click", () => {
      document.querySelectorAll(".ppt-outline-section").forEach(el => el.remove());
    bookReaderSection.classList.add("hidden");
    bookDetailsSection.classList.remove("hidden");
  });

document.getElementById("backToConversion").addEventListener("click", () => {
    document.querySelectorAll(".ppt-outline-section").forEach(el => el.remove());
  // Hide whatever was open
  bookCreationSection.classList.add("hidden");
  browseSection.classList.add("hidden");
  bookDetailsSection.classList.add("hidden");
  bookReaderSection.classList.add("hidden");
  conversionSection.classList.add("hidden");

  // ✅ Always return to Home
  homeSection.classList.remove("hidden");
});


// --- Reader ---
const readBookBtn = document.getElementById("readBookBtn");
if (readBookBtn) {
  readBookBtn.addEventListener("click", () => {
    if (!window.currentBook) return;

    saveLastRead(window.currentBook);
    bookDetailsSection.classList.add("hidden");
    bookReaderSection.classList.remove("hidden");
    document.getElementById("readerBookTitle").textContent =
      window.currentBook.title;

    const readerContent = document.getElementById("readerContent");
    readerContent.innerHTML = "";
// Clean previous outline section (if still there)
document.querySelectorAll(".ppt-outline-section").forEach(el => el.remove());

// Insert new one
readerContent.insertAdjacentElement("afterend", outlineSection);

    const role = localStorage.getItem("role") || "student";

    if (window.currentBook.pages && window.currentBook.pages.length > 0) {
      window.currentBook.pages.forEach((page, idx) => {
        const div = document.createElement("div");
        div.className = "page";
        div.innerHTML = `
          <div class="page-header">
            <h4 class="page-label">Page ${idx + 1}</h4>
            ${
              role === "librarian"
                ? `<button class="edit-page-btn" data-index="${idx}">Edit Page</button>`
                : ""
            }
            <button class="tts-btn" data-index="${idx}">🔊 Read Aloud</button>
          </div>
          <div class="ocr-text" id="ocr-text-${idx}">
            ${page.text || "No text detected."}
          </div>
        `;
        readerContent.appendChild(div);
      });

document.querySelectorAll(".tts-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const idx = btn.dataset.index;
    const textDiv = document.getElementById(`ocr-text-${idx}`);
    const text = textDiv.textContent.trim();
    if (!text) {
      showPopup("⚠️ No text found on this page", "error");
      return;
    }

    showPopup("🎧 Generating voice...");
    try {
      const res = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        showPopup("❌ TTS failed", "error");
        return;
      }

// 🧠 Stop any currently playing audio before starting a new one
if (window.activeTTS && !window.activeTTS.paused) {
  window.activeTTS.pause();
}

const audio = new Audio(data.url);
window.activeTTS = audio;
audio.play();
showPopup("🔊 Reading aloud!");


      // 🎛️ Create control buttons (Pause / Restart)
      let controlsDiv = document.getElementById(`tts-controls-${idx}`);
      if (!controlsDiv) {
        controlsDiv = document.createElement("div");
        controlsDiv.id = `tts-controls-${idx}`;
        controlsDiv.className = "tts-controls";
        controlsDiv.innerHTML = `
          <button class="tts-pause-btn">⏸ Pause</button>
          <button class="tts-restart-btn">🔁 Restart</button>
        `;
btn.insertAdjacentElement("afterend", controlsDiv);

      }

      // 🧭 Pause button
      const pauseBtn = controlsDiv.querySelector(".tts-pause-btn");
      pauseBtn.onclick = () => {
        if (audio.paused) {
          audio.play();
          pauseBtn.textContent = "⏸ Pause";
        } else {
          audio.pause();
          pauseBtn.textContent = "▶ Resume";
        }
      };

      // 🔄 Restart button
      const restartBtn = controlsDiv.querySelector(".tts-restart-btn");
      restartBtn.onclick = () => {
        audio.currentTime = 0;
        audio.play();
        pauseBtn.textContent = "⏸ Pause";
      };

      // 🎧 Auto-reset buttons when finished
      audio.addEventListener("ended", () => {
        pauseBtn.textContent = "▶ Play Again";
      });

    } catch (err) {
      console.error("TTS error:", err);
      showPopup("❌ Could not generate voice", "error");
    }
  });
});

      // 🧾 Librarian: Edit Page feature
      if (role === "librarian") {
        document.querySelectorAll(".edit-page-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const idx = btn.dataset.index;
            const textDiv = document.getElementById(`ocr-text-${idx}`);
            const oldText = textDiv.textContent.trim();

            textDiv.innerHTML = `
              <textarea id="edit-textarea-${idx}" class="edit-textarea">${oldText}</textarea>
              <div class="edit-controls">
                <button id="save-text-${idx}" class="save-page-btn">Save Changes</button>
                <button id="cancel-edit-${idx}" class="cancel-page-btn">Cancel</button>
              </div>
            `;

            document.getElementById(`save-text-${idx}`).addEventListener("click", async () => {
              const newText = document.getElementById(`edit-textarea-${idx}`).value;
              const token = sessionStorage.getItem("token");
              try {
                const res = await fetch(`${API_URL}/api/books/${window.currentBook._id}/pages/${idx}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ newText }),
                });

                const data = await res.json();
                if (res.ok) {
                  showPopup("Page text updated successfully", "success");
                  window.currentBook.pages[idx].text = newText;
                  textDiv.innerHTML = newText;
                } else {
                  showPopup(`❌ ${data.error}`, "error");
                }
              } catch (err) {
                console.error("❌ Save failed:", err);
                showPopup("Failed to update page text", "error");
              }
            });

            document.getElementById(`cancel-edit-${idx}`).addEventListener("click", () => {
              textDiv.innerHTML = oldText;
            });
          });
        });
      }

    } else {
      readerContent.innerHTML = "<p>No pages available for this book.</p>";
    }
  });
}

// ===============================
// 🧠 Gemini PPT Outline Feature
// ===============================
const outlineSection = document.createElement("div");
outlineSection.className = "ppt-outline-section";
outlineSection.innerHTML = `
  <div class="ppt-outline-box">
    <p>
      <strong>Want an outline for a PPT presentation?</strong><br>
      Just click <b>Yes</b> if you want.<br>
      <small style="color: red; font-weight: 600;">(Note: AI-generated)</small>
    </p>
    <button id="generateOutlineBtn" class="btn">Yes</button>
    <div id="outlineLoader" class="spinner hidden"></div>
    <div id="outlineResult" class="outline-result"></div>
  </div>
`;

readerContent.insertAdjacentElement("afterend", outlineSection);

// 🎯 Event: Generate Outline
document.getElementById("generateOutlineBtn").addEventListener("click", async () => {
  const outlineBtn = document.getElementById("generateOutlineBtn");
  const outlineLoader = document.getElementById("outlineLoader");
  const outlineResult = document.getElementById("outlineResult");

  outlineBtn.disabled = true;
  outlineLoader.classList.remove("hidden");
  outlineResult.innerHTML = "";

  try {
    // Combine all OCR text from book pages
    const fullText = (window.currentBook.pages || [])
      .map(p => p.text || "")
      .join("\n\n");

    if (!fullText.trim()) {
      showPopup("⚠️ No OCR text found in this book", "error");
      return;
    }

    const res = await fetch(`${API_URL}/api/gemini-outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fullText }),
    });

    const data = await res.json();
if (res.ok && data.outline) {
      outlineResult.innerHTML = `
        <h4>📋 Suggested PPT Outline</h4>
        <pre>${data.outline}</pre>
        
        <div class="outline-actions" style="margin-top: 1rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          
          <button id="copyOutlineBtn" class="btn btn-back" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            <img src="img/copy-svgrepo-com.svg" alt="Copy" style="width: 16px; height: 16px;">
            <span>Copy Text</span>
          </button>

<button id="downloadOutlinePdfBtn" class="btn" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            <span>Download PDF</span>
          </button>

        </div>
      `;

      // --- Add listener for Copy Button ---
      document.getElementById("copyOutlineBtn").addEventListener("click", () => {
        try {
          // Use data.outline to get the raw, unformatted text
          navigator.clipboard.writeText(data.outline);
          showPopup("✅ Outline copied to clipboard!", "success");
        } catch (copyErr) {
          console.error("Copy failed:", copyErr);
          showPopup("❌ Failed to copy text", "error");
        }
      });

      // --- Add listener for PDF Button ---
      document.getElementById("downloadOutlinePdfBtn").addEventListener("click", () => {
        try {
          // Check if jsPDF library is loaded
          if (typeof window.jspdf === 'undefined') {
            showPopup("❌ PDF library (jsPDF) is not loaded.", "error");
            console.error("jsPDF is not loaded. Make sure the script tag is in dashboard.html");
            return;
          }
          
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          const bookTitle = window.currentBook?.title || "Book Outline";
          
          // Set font style
          doc.setFont("helvetica", "normal");

          // Add Title
          doc.setFontSize(18);
          doc.text(`PPT Outline: ${bookTitle}`, 10, 15);

          // Add Outline Text
          doc.setFontSize(10);
          // 'splitTextToSize' handles automatic line wrapping for long text
          const lines = doc.splitTextToSize(data.outline, 180); // 180mm width
          doc.text(lines, 10, 30); // Start text at y=30
          
          // Save the PDF
          doc.save(`OpenArk_Outline_${bookTitle.replace(/\s+/g, '_')}.pdf`);
          showPopup("✅ Downloading PDF...", "success");

        } catch (pdfErr) {
          console.error("PDF generation failed:", pdfErr);
          showPopup("❌ Failed to generate PDF", "error");
        }
      });

    } else {
      showPopup("❌ Failed to generate outline", "error");
    }
  } catch (err) {
    console.error("❌ Outline generation failed:", err);
    showPopup("Failed to generate outline", "error");
  } finally {
    outlineBtn.disabled = false;
    outlineLoader.classList.add("hidden");
  }
});


// ✅ Move these to the TOP of the block, before you use them anywhere
const bookmarksTab = document.getElementById("bookmarksTab");
const bookmarksSection = document.getElementById("bookmarksSection");
const bookmarksGrid = document.getElementById("bookmarksGrid");
const viewAllBookmarksBtn = document.getElementById("viewAllBookmarksBtn");

if (bookmarksTab) {
  bookmarksTab.addEventListener("click", async (e) => {
    e.preventDefault();

    // Hide all other sections
    homeSection.classList.add("hidden");
    browseSection.classList.add("hidden");
    conversionSection.classList.add("hidden");
    bookDetailsSection.classList.add("hidden");
    bookCreationSection.classList.add("hidden");
    bookReaderSection.classList.add("hidden");
    reportsSection.classList.add("hidden");

    // Show bookmarks
    bookmarksSection.classList.remove("hidden");

    await loadBookmarks();
  });
}

const token = sessionStorage.getItem("token");
const profilePicInput = document.getElementById("profilePicInput");
const saveProfilePicBtn = document.getElementById("saveProfilePicBtn");
const uploadTriggerBtn = document.getElementById("uploadTriggerBtn");

if (uploadTriggerBtn && profilePicInput) {
  uploadTriggerBtn.addEventListener("click", () => profilePicInput.click());
}

if (profilePicInput) {
  profilePicInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewURL = URL.createObjectURL(file);
      dropdownProfileImg.src = previewURL;
      navProfileImg.src = previewURL;
    }
  });
}

if (saveProfilePicBtn) {
  saveProfilePicBtn.addEventListener("click", async () => {
    const file = profilePicInput.files[0];
    if (!file) return showPopup("Please select a picture first", "error");

    const formData = new FormData();
    formData.append("profilePic", file);

    try {
      const res = await fetch(`${API_URL}/api/upload-profile-pic`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("pfp", data.profilePic);
        dropdownProfileImg.src = data.profilePic;
        navProfileImg.src = data.profilePic;
        showPopup("✅ Profile picture updated!", "success");
      } else {
        showPopup(data.error || "Upload failed", "error");
      }
    } catch (err) {
      console.error("❌ Upload error:", err);
      showPopup("Upload failed", "error");
    }
  });
}


// ---------- Comments feature ----------
const commentsListEl = document.getElementById("commentsList");
const commentFormEl = document.getElementById("commentForm");
const commentLoginPrompt = document.getElementById("commentLoginPrompt");
const commentTextEl = document.getElementById("commentText");
const postCommentBtn = document.getElementById("postCommentBtn");
const commenterPfpSmall = document.getElementById("commenterPfpSmall");

async function loadCommentsForBook(bookId) {
  try {
    const res = await fetch(`${API_URL}/api/books/${bookId}/comments`);
    if (!res.ok) throw new Error("Failed to load comments");
    const comments = await res.json();

    if (!comments || comments.length === 0) {
      commentsListEl.innerHTML = `<p style="opacity:0.7;">No comments yet. Be the first to comment!</p>`;
      return;
    }

    commentsListEl.innerHTML = "";
    comments.forEach(c => {
      const wrapper = document.createElement("div");
      wrapper.className = "comment-item";
      wrapper.style = "display:flex;gap:0.7rem;padding:0.6rem;border-radius:8px;margin-bottom:0.5rem;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);";

      const img = document.createElement("img");
      img.src = c.author.profilePic || "assets/default-pfp.png";
      img.style = "width:44px;height:44px;border-radius:50%;object-fit:cover;";
      img.alt = "pfp";

      const body = document.createElement("div");
      body.style = "flex:1;";

      const header = document.createElement("div");
      header.style = "display:flex;align-items:center;gap:0.6rem;justify-content:space-between;";

      const who = document.createElement("div");
      who.innerHTML = `<strong style="font-size:0.95rem">${c.author.username || 'User'}</strong>
                       <div style="font-size:0.8rem;color:#666;margin-top:2px;">${formatPHDate(c.createdAt)}</div>`;

      const actions = document.createElement("div");

      // show delete only if current user is author or current role is librarian
      const meId = localStorage.getItem("userId") || null;
      const myRole = localStorage.getItem("role") || "student";
      if (myRole === "librarian" || (c.author._id && meId && c.author._id === meId)) {
        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-btn";
        delBtn.style = "font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:8px;";
        delBtn.addEventListener("click", async () => {
// Open delete confirmation modal
const commentToDelete = c;
document.getElementById("deleteCommentMessage").textContent =
  `Are you sure you want to delete this comment by "${c.author.username}"?`;
document.getElementById("deleteCommentModal").classList.remove("hidden");

// Handle confirm
const confirmBtn = document.getElementById("confirmDeleteCommentBtn");
const cancelBtn = document.getElementById("cancelDeleteCommentBtn");

// Remove old listeners to prevent stacking
confirmBtn.replaceWith(confirmBtn.cloneNode(true));
cancelBtn.replaceWith(cancelBtn.cloneNode(true));

const newConfirmBtn = document.getElementById("confirmDeleteCommentBtn");
const newCancelBtn = document.getElementById("cancelDeleteCommentBtn");

newCancelBtn.addEventListener("click", () => {
  document.getElementById("deleteCommentModal").classList.add("hidden");
});

newConfirmBtn.addEventListener("click", async () => {
  try {
    const token = sessionStorage.getItem("token");
    const r = await fetch(`${API_URL}/api/comments/${commentToDelete._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Failed");
    showPopup("Comment deleted", "success");
    loadCommentsForBook(bookId);
  } catch (err) {
    console.error(err);
    showPopup("Failed to delete comment", "error");
  } finally {
    document.getElementById("deleteCommentModal").classList.add("hidden");
  }
});

        });
        actions.appendChild(delBtn);
      }

      header.appendChild(who);
      header.appendChild(actions);

      const textDiv = document.createElement("div");
      textDiv.style = "margin-top:6px;white-space:pre-wrap;";
      textDiv.textContent = c.text;

      body.appendChild(header);
      body.appendChild(textDiv);

      wrapper.appendChild(img);
      wrapper.appendChild(body);

      commentsListEl.appendChild(wrapper);
    });
  } catch (err) {
    console.error("❌ loadCommentsForBook error:", err);
    commentsListEl.innerHTML = `<p style="opacity:0.7;">Failed to load comments</p>`;
  }
}

function formatPHDate(dateStrOrObj) {
  const d = new Date(dateStrOrObj);
  // Format: Oct 9, 2025, 3:45 PM (Asia/Manila)
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch (e) {
    // fallback
    return d.toLocaleString();
  }
}

// Show/hide comment form depending on auth
function updateCommentFormVisibility() {
  const token = sessionStorage.getItem("token");
  if (token) {
    commentFormEl.style.display = "block";
    commentLoginPrompt.style.display = "none";
    commenterPfpSmall.src = localStorage.getItem("pfp") || "assets/default-pfp.png";
    // store user id if server returns it on login — otherwise, you can set it in localStorage at login time
    // localStorage.setItem("userId", "<user-id-from-server>"); // ensure this is set at login
  } else {
    commentFormEl.style.display = "none";
    commentLoginPrompt.style.display = "block";
  }
}

// Post comment
postCommentBtn.addEventListener("click", async () => {
  const token = sessionStorage.getItem("token");
  if (!token) {
    showPopup("Please log in to comment", "error");
    return;
  }
  const txt = (commentTextEl.value || "").trim();
  if (!txt) return showPopup("Please write something", "error");

  const bookId = document.getElementById("detailTitle").dataset.bookId;
  if (!bookId) return showPopup("Book not found", "error");

  try {
    const res = await fetch(`${API_URL}/api/books/${bookId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: txt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to post comment");

    commentTextEl.value = "";
    showPopup("Comment posted", "success");
    loadCommentsForBook(bookId);
  } catch (err) {
    console.error("❌ Post comment error:", err);
    showPopup("Failed to post comment", "error");
  }
});

// Hook showBookDetails to load comments and join room
const originalShowBookDetails2 = showBookDetails;
showBookDetails = async function(book, fromSection) {
  originalShowBookDetails2(book, fromSection);
  updateCommentFormVisibility();
  if (book && book._id) {
    loadCommentsForBook(book._id);
    socket.emit("joinBookRoom", book._id); // join the live room
  }
};

// ----- Realtime comment updates -----
socket.on("commentUpdate", (data) => {
  const currentBook = document.getElementById("detailTitle").dataset.bookId;
  if (!currentBook) return;

  if (data.type === "new" && data.payload && data.payload.author) {
    loadCommentsForBook(currentBook);
  } else if (data.type === "delete") {
    loadCommentsForBook(currentBook);
  }
});
// hook: call updateCommentFormVisibility once on load
updateCommentFormVisibility();

// IMPORTANT: ensure loadCommentsForBook(bookId) is called when opening book details.
// In your showBookDetails override you call originalShowBookDetails(book,...).
// After that call (or within it) call loadCommentsForBook(book._id) and updateCommentFormVisibility().
// Example: (if you already override showBookDetails) add:

if (role === "librarian" && conversionSection) {
  conversionSection.style.display = "";
}

// --- Load bookmarks ---
async function loadBookmarks() {
  showLoader("loadingSpinnerBookmarks");
  try {
    const token = sessionStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch bookmarks");

    const bookmarks = await res.json();
    bookmarksGrid.innerHTML = "";

    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      bookmarksGrid.innerHTML = `
        <p style="text-align:center;opacity:0.7;margin-top:1rem;">
          📚 You haven’t bookmarked any books yet.
        </p>
      `;
      return;
    }

    bookmarks.forEach((book) => {
      const div = document.createElement("div");
      div.className = "book";
      const firstGenre = Array.isArray(book.category)
        ? book.category[0]
        : (book.category?.split(",")[0] || "Unknown");

      div.innerHTML = `
        <img src="${book.img}" alt="${book.title}">
        <h4>${book.title}</h4>
        <p class="genre-label">${firstGenre.trim()}</p>
      `;

      div.addEventListener("click", () =>
        showBookDetails(book, bookmarksSection)
      );
      bookmarksGrid.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Error loading bookmarks:", err);
    bookmarksGrid.innerHTML =
      `<p style="text-align:center;opacity:0.7;">Failed to load bookmarks.</p>`;
  }
  hideLoader("loadingSpinnerBookmarks");
}

const viewAllBtn = document.getElementById("viewAllBtn");
if (viewAllBookmarksBtn) {
  viewAllBookmarksBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // hide all other sections
    bookmarksSection.classList.add("hidden");
    homeSection.classList.add("hidden");
    conversionSection.classList.add("hidden");
    bookDetailsSection.classList.add("hidden");
    bookCreationSection.classList.add("hidden");
    bookReaderSection.classList.add("hidden");

    // show browse
    browseSection.classList.remove("hidden");
    loadBrowseBooks();
  });
}

if (viewAllBtn) {
  viewAllBtn.addEventListener("click", () => {
    const home = document.getElementById("homeSection");
    const browse = document.getElementById("browseSection");
    if (!home || !browse) return;

    home.classList.add("hidden");
    browse.classList.remove("hidden");

    // Optional: set nav active state
    document.getElementById("browseTab")?.classList.add("active");
    document.getElementById("homeTab")?.classList.remove("active");

    // Load content
    loadBrowseBooks();
  });
}

const advancedSearchToggle = document.getElementById("advancedSearchToggle");
const advancedSearchSection = document.getElementById("advancedSearchSection");

if (advancedSearchToggle && advancedSearchSection) {
  advancedSearchToggle.addEventListener("click", () => {
    advancedSearchSection.classList.toggle("open");
  });
}


const keywordSearch = document.getElementById("keywordSearch");
const authorSearch = document.getElementById("authorSearch");
const publisherSearch = document.getElementById("publisherSearch");
const yearSearch = document.getElementById("yearSearch");

[keywordSearch, authorSearch, publisherSearch, yearSearch].forEach(input => {
  if (input) {
    input.addEventListener("input", gatherAllFilterValuesAndRun);
  }
});

// ✅ NEW: Central function to gather all filter values
function gatherAllFilterValuesAndRun() {
  const title = browseSearch?.value.trim().toLowerCase() || "";
  const keyword = keywordSearch?.value.trim().toLowerCase() || "";
  const author = authorSearch?.value.trim().toLowerCase() || "";
  const publisher = publisherSearch?.value.trim().toLowerCase() || "";
  const year = yearSearch?.value.trim() || "";
  const genre =
    document.querySelector("#genreFilters .genre-btn.active")?.dataset.genre || "all";

  filterBooks({ title, keyword, author, publisher, year, genre });
}

function filterBooks({
  title = "",
  keyword = "",
  author = "",
  publisher = "",
  year = "",
  genre = "all"
}) {
  if (!Array.isArray(allBooks)) return;

  let filtered = allBooks.filter(book => {
    const matchesTitle = title
      ? (book.title || "").toLowerCase().includes(title)
      : true;

    const matchesKeyword = keyword
      ? (book.description || "").toLowerCase().includes(keyword)
      : true;

    const matchesAuthor = author
      ? (book.author || "").toLowerCase().includes(author)
      : true;

    const matchesPublisher = publisher
      ? (book.publisher || "").toLowerCase().includes(publisher)
      : true;

    const matchesYear = year
      ? String(book.year).toLowerCase().includes(year.toLowerCase())
      : true;

    const matchesGenre =
      genre === "all" ||
      (Array.isArray(book.category)
        ? book.category.some(c => c.toLowerCase() === genre.toLowerCase())
        : (book.category || "").toLowerCase() === genre.toLowerCase());

    return (
      matchesTitle &&
      matchesKeyword &&
      matchesAuthor &&
      matchesPublisher &&
      matchesYear &&
      matchesGenre
    );
  });

  renderBrowseBooks(filtered);
}

function renderBrowseBooks(books) {
  const browseBooks = document.getElementById("browseBooks");
  browseBooks.innerHTML = "";

  if (!books || books.length === 0) {
    browseBooks.innerHTML = `<p>No books found.</p>`;
    return;
  }

  books.forEach((book) => {
    const div = document.createElement("div");
    div.className = "book";

    const firstGenre = Array.isArray(book.category)
      ? book.category[0]
      : (book.category?.split(",")[0] || "Unknown");

    div.innerHTML = `
      <img src="${book.img}" alt="${book.title}">
      <h4>${book.title}</h4>
      <p class="genre-label">${firstGenre.trim()}</p>
    `;

    div.addEventListener("click", () => showBookDetails(book, browseSection));
    browseBooks.appendChild(div);
  });
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
    bookmarksSection.classList.add("hidden");
    reportsSection.classList.add("hidden");

    loadBrowseBooks();   // ✅ load books
  });
}

  loadBooks();
  loadContinueReading();
  updateCommentFormVisibility();

  // ✅ ADD THIS ENTIRE BLOCK (All Report Logic)
  // ===================================================================
  // 📊 LIBRARIAN-ONLY REPORTS TAB LOGIC (Copied from admin.js)
  // ===================================================================
  if (role === "librarian" && reportsTab) {

    // --- Element References ---
    const reportsSection = document.getElementById("reportsSection");
    const activityTableBody = document.getElementById("activityTableBody");
    const activitySort = document.getElementById("activitySort");
    const activityBackBtn = document.getElementById("activityBackBtn");
    const activityNextBtn = document.getElementById("activityNextBtn");
    const activityPageInfo = document.getElementById("activityPageInfo");
    const monthFilter = document.getElementById("monthFilter");
    const pruneDateInput = document.getElementById("pruneDate");
    const pruneLogsBtn = document.getElementById("pruneLogsBtn");
    const pruneLogsModal = document.getElementById("pruneLogsModal");
    const cancelPruneLogs = document.getElementById("cancelPruneLogs");
    const confirmPruneLogs = document.getElementById("confirmPruneLogs");
    const pruneDateConfirm = document.getElementById("pruneDateConfirm");
    const reportTotalUsers = document.getElementById("reportTotalUsers");
    const reportTotalBooks = document.getElementById("reportTotalBooks");
    const reportTopCategory = document.getElementById("reportTopCategory");
    const exportPNG = document.getElementById("exportPNG");
    const exportPDF = document.getElementById("exportPDF");
    const exportExcel = document.getElementById("exportExcel");

    // --- Global State ---
    let allActivities = [];
    let sortedActivities = [];
    let activityCurrentPage = 1;
    const activityItemsPerPage = 10;
    let dateToPrune = null;

    // --- Tab Switching ---
    reportsTab.addEventListener("click", async (e) => {
      e.preventDefault();
      
      // Hide all other sections
      homeSection.classList.add("hidden");
      conversionSection.classList.add("hidden");
      browseSection.classList.add("hidden");
      bookDetailsSection.classList.add("hidden");
      bookCreationSection.classList.add("hidden");
      bookReaderSection.classList.add("hidden");
      bookmarksSection.classList.add("hidden");

      // Show reports
      reportsSection.classList.remove("hidden");
      await loadReports();
    });

    // --- Load Reports Function ---
    async function loadReports() {
      try {
        const token = sessionStorage.getItem("token");
        // Summary
        const reportRes = await fetch(`${API_URL}/api/report-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const report = await reportRes.json();
        if (reportTotalUsers) reportTotalUsers.textContent = report.totalUsers || 0;
        if (reportTotalBooks) reportTotalBooks.textContent = report.totalBooks || 0;
        if (reportTopCategory) reportTopCategory.textContent = report.topCategory || "N/A";
        
        // Activities
        const activityRes = await fetch(`${API_URL}/api/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        allActivities = await activityRes.json();
        activityCurrentPage = 1;
        processAndRenderActivities();
      } catch (err) {
        console.error("Error loading reports:", err);
        if (activityTableBody) activityTableBody.innerHTML =
          "<tr><td colspan='4' style='text-align:center;'>Failed to load report data.</td></tr>";
      }
    }

    // --- Process & Render Activities ---
    function processAndRenderActivities() {
      const monthValue = monthFilter.value;
      let filtered = [...allActivities];
      if (monthValue) {
        const [year, month] = monthValue.split("-").map(Number);
        filtered = allActivities.filter(a => {
          const d = new Date(a.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        });
      }
      
      switch (activitySort?.value) {
        case "oldest":
          filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
          break;
        case "user":
          filtered.sort((a, b) => (a.user || "").localeCompare(b.user || ""));
          break;
        case "action":
          filtered.sort((a, b) => (a.action || "").localeCompare(b.action || ""));
          break;
        default: // "newest"
          filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      
      sortedActivities = filtered;
      renderActivitiesPage();
    }

    // --- Update Pagination ---
    function updatePaginationUI() {
      const totalItems = sortedActivities.length;
      const totalPages = Math.ceil(totalItems / activityItemsPerPage);

      if (totalPages <= 1) {
        if (activityBackBtn) activityBackBtn.style.display = "none";
        if (activityNextBtn) activityNextBtn.style.display = "none";
        if (activityPageInfo) activityPageInfo.style.display = "none";
      } else {
        if (activityBackBtn) activityBackBtn.style.display = "inline-block";
        if (activityNextBtn) activityNextBtn.style.display = "inline-block";
        if (activityPageInfo) activityPageInfo.style.display = "inline-block";
        
        activityBackBtn.disabled = (activityCurrentPage === 1);
        activityNextBtn.disabled = (activityCurrentPage === totalPages);
        activityPageInfo.textContent = `Page ${activityCurrentPage} of ${totalPages || 1}`;
      }
    }
    
    // --- Render Page ---
    function renderActivitiesPage() {
      if (!Array.isArray(sortedActivities) || sortedActivities.length === 0) {
        if (activityTableBody) activityTableBody.innerHTML = `<tr><td colspan='4' style='text-align:center;'>No recent activity found.</td></tr>`;
        updatePaginationUI();
        return;
      }
      
      const startIndex = (activityCurrentPage - 1) * activityItemsPerPage;
      const endIndex = startIndex + activityItemsPerPage;
      const pageItems = sortedActivities.slice(startIndex, endIndex);

      if (activityTableBody) activityTableBody.innerHTML = pageItems
        .map(
          (a) => `
          <tr>
            <td>${new Date(a.date).toLocaleString()}</td>
            <td>${a.user || "Unknown"}</td>
            <td>${a.action || "N/A"}</td>
            <td>${a.details || ""}</td>
          </tr>`
        )
        .join("");
        
      updatePaginationUI();
    }

    // --- Pagination Listeners ---
    if (activityNextBtn) activityNextBtn.addEventListener("click", () => {
      activityCurrentPage++;
      renderActivitiesPage();
    });

    if (activityBackBtn) activityBackBtn.addEventListener("click", () => {
      activityCurrentPage--;
      renderActivitiesPage();
    });

    if (activitySort) activitySort.addEventListener("change", () => {
      activityCurrentPage = 1;
      processAndRenderActivities();
    });

    if (monthFilter) monthFilter.addEventListener("change", () => {
      activityCurrentPage = 1;
      processAndRenderActivities();
    });

    // --- Export Listeners ---
    if (exportPNG) {
      exportPNG.addEventListener("click", async () => {
        const table = document.querySelector("#reportsSection table.user-table");
        if (!table) return showPopup("No activity table found!", "error");
        const canvas = await html2canvas(table, { scale: 2 });
        const link = document.createElement("a");
        link.download = "Recent_Activity.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    }

    if (exportPDF) {
      exportPDF.addEventListener("click", async () => {
        const table = document.querySelector("#reportsSection table.user-table");
        if (!table) return showPopup("No activity table found!", "error");
        
        // Use window.jspdf
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text("Recent Activity Report", pdf.internal.pageSize.getWidth() / 2, 20, { align: "center" });
        
        // Use jsPDF-AutoTable
        pdf.autoTable({
          html: table,
          startY: 30,
          theme: 'grid',
          headStyles: { fillColor: [154, 63, 63] } // OpenArk Maroon
        });
        
        pdf.save("Recent_Activity_Report.pdf");
      });
    }

    if (exportExcel) {
      exportExcel.addEventListener("click", () => {
        const table = document.querySelector("#reportsSection table.user-table");
        if (!table) return showPopup("No activity table found!", "error");
        const wb = XLSX.utils.table_to_book(table, { sheet: "Recent Activity" });
        XLSX.writeFile(wb, "Recent_Activity.xlsx");
      });
    }

// --- Prune Logs Listeners ---
    if (pruneLogsBtn) pruneLogsBtn.addEventListener("click", () => {
      const selectedDate = pruneDateInput.value;
      if (!selectedDate) {
        showPopup("Please select a date first.", "error");
        return;
      }
      
      // -------------------
      // ▼▼▼ START OF FIX 2.A ▼▼▼
      // -------------------
      // OLD: dateToPrune = new Date(selectedDate);
      dateToPrune = selectedDate; // ✅ Store the string "YYYY-MM-DD"
      
      if (pruneDateConfirm) {
        // OLD: pruneDateConfirm.textContent = dateToPrune.toLocaleDateString(undefined, {
        // ✅ Wrap in new Date() just for local display
        pruneDateConfirm.textContent = new Date(dateToPrune).toLocaleDateString(undefined, {
      // -------------------
      // ▲▲▲ END OF FIX 2.A ▲▲▲
      // -------------------
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      if (pruneLogsModal) pruneLogsModal.classList.remove("hidden");
    });

    if (cancelPruneLogs) { /* ... no change ... */ }

    if (confirmPruneLogs) confirmPruneLogs.addEventListener("click", async () => {
      if (!dateToPrune) return;

      const token = sessionStorage.getItem("token");
      confirmPruneLogs.disabled = true;
      confirmPruneLogs.textContent = "Deleting...";

      try {
        const res = await fetch(`${API_URL}/api/activity/prune`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          // -------------------
          // ▼▼▼ START OF FIX 2.B ▼▼▼
          // -------------------
          // OLD: body: JSON.stringify({ beforeDate: dateToPrune.toISOString() }),
          body: JSON.stringify({ beforeDate: dateToPrune }), // ✅ Send the raw string
          // -------------------
          // ▲▲▲ END OF FIX 2.B ▲▲▲
          // -------------------
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete logs");

        showPopup(data.message || "Logs deleted successfully!", "success");
        await loadReports(); // Refresh the activity list

      } catch (err) {
        console.error("Prune logs error:", err);
        showPopup(err.message, "error");
      } finally {
        if (pruneLogsModal) pruneLogsModal.classList.add("hidden");
        confirmPruneLogs.disabled = false;
        confirmPruneLogs.textContent = "Confirm & Delete";
        dateToPrune = null;
        if (pruneDateInput) pruneDateInput.value = "";
      }
    });

  } // End of if (role === "librarian") block

});
