document.addEventListener("DOMContentLoaded", () => {
  const API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://openark2-0.onrender.com";

  // --- Element References ---
  const userTab = document.getElementById("userTab");
  const booksTab = document.getElementById("booksTab");
  const reportsTab = document.getElementById("reportsTab");
  const usersSection = document.getElementById("usersSection");
  const booksSection = document.getElementById("booksSection");
  const reportsSection = document.getElementById("reportsSection");
  const userTableBody = document.getElementById("userTableBody");
  const popup = document.getElementById("popup");
  const totalUsers = document.getElementById("totalUsers");
  const activeUsers = document.getElementById("activeUsers");
  const inactiveUsers = document.getElementById("inactiveUsers");
  const activityTableBody = document.getElementById("activityTableBody");
  const activitySort = document.getElementById("activitySort"); // ✅ new reference

  // ✅ Redirect non-admins away
  if (localStorage.getItem("role") !== "admin") {
    window.location.href = "intro.html";
    return;
  }

  // --- Popup ---
  function showPopup(message) {
    popup.textContent = message;
    popup.classList.add("show");
    setTimeout(() => popup.classList.remove("show"), 3000);
  }

  // ===============================
  // 👤 USER TAB LOGIC
  // ===============================
  userTab.addEventListener("click", (e) => {
    e.preventDefault();
    userTab.classList.add("active");
    booksTab.classList.remove("active");
    reportsTab.classList.remove("active");

    usersSection.classList.remove("hidden");
    booksSection.classList.add("hidden");
    reportsSection.classList.add("hidden");
  });

  booksTab.addEventListener("click", (e) => {
    e.preventDefault();
    booksTab.classList.add("active");
    userTab.classList.remove("active");
    reportsTab.classList.remove("active");

    usersSection.classList.add("hidden");
    booksSection.classList.remove("hidden");
    reportsSection.classList.add("hidden");

    loadBooks();
  });

  // --- Render Users (STATIC ACTIVE) ---
  function renderUsers(users) {
    userTableBody.innerHTML = "";

    if (!Array.isArray(users) || users.length === 0) {
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>No users found.</td></tr>";
      return;
    }

    users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${u.profilePic || 'assets/default-pfp.png'}" alt="pfp"></td>
        <td>${u.username || "N/A"}</td>
        <td>${u.email || "N/A"}</td>
        <td>${u.role || "student"}</td>
        <td><span class="status active">Active</span></td>
        <td>
          <button class="action-btn delete" data-id="${u._id}">Delete Account</button>
        </td>
      `;
      userTableBody.appendChild(tr);
    });

    totalUsers.textContent = users.length;
    activeUsers.textContent = users.length;
    inactiveUsers.textContent = 0;

    attachDeleteEvents();
  }

  // --- Load Users ---
  async function loadUsers() {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load users");
      const users = await res.json();
      renderUsers(users);
    } catch (err) {
      console.error("Error loading users:", err);
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>Failed to load users.</td></tr>";
    }
  }

  // --- Delete User Modal ---
  function attachDeleteEvents() {
    const modal = document.getElementById("deleteModal");
    const confirmBtn = document.getElementById("confirmDelete");
    const cancelBtn = document.getElementById("cancelDelete");
    let targetUserId = null;

    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        targetUserId = btn.dataset.id;
        modal.classList.add("show");
      });
    });

    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("show");
      targetUserId = null;
    });

    confirmBtn.addEventListener("click", async () => {
      if (!targetUserId) return;
      const token = sessionStorage.getItem("token");

      try {
        const res = await fetch(`${API_URL}/api/users/${targetUserId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        showPopup(data.message || "User deleted");
        modal.classList.remove("show");
        loadUsers();
      } catch (err) {
        console.error("Delete failed:", err);
        showPopup("Failed to delete user");
        modal.classList.remove("show");
      }
    });
  }

  // --- Logout ---
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        await fetch(`${API_URL}/api/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    sessionStorage.removeItem("token");
    localStorage.clear();
    window.location.href = "intro.html";
  });

  // --- Initial Load ---
  loadUsers();

  // ===============================
  // 📚 BOOK MANAGEMENT TAB LOGIC
  // ===============================
  const bookTableBody = document.getElementById("bookTableBody");
  const totalBooks = document.getElementById("totalBooks");
  const recentBooks = document.getElementById("recentBooks");
  const deletedBooks = document.getElementById("deletedBooks");
  const bookSearch = document.getElementById("bookSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  let allBooks = [];
  let deletedCount = 0;

  async function loadBooks() {
    try {
      const res = await fetch(`${API_URL}/api/books`);
      const books = await res.json();
      allBooks = books;
      renderBooks(books);
      updateBookStats(books);
      populateCategories(books);
    } catch (err) {
      console.error("Error loading books:", err);
      bookTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>Failed to load books.</td></tr>";
    }
  }

  function renderBooks(books) {
    bookTableBody.innerHTML = "";
    if (books.length === 0) {
      bookTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>No books found.</td></tr>";
      return;
    }

    books.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${b.img}" alt="${b.title}" style="width:45px;height:60px;border-radius:6px;object-fit:cover;"></td>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${Array.isArray(b.category) ? b.category.join(", ") : b.category}</td>
        <td>${b.publisher || "N/A"}</td>
        <td>${b.year}</td>
        <td>
          <button class="action-btn view" data-id="${b._id}">View</button>
          <button class="action-btn delete" data-id="${b._id}">Delete</button>
        </td>
      `;
      bookTableBody.appendChild(tr);
    });

    attachBookEvents();
  }

  function updateBookStats(books) {
    totalBooks.textContent = books.length;
    recentBooks.textContent = books.slice(-5).length;
    deletedBooks.textContent = deletedCount;
  }

  function populateCategories(books) {
    const categories = new Set();
    books.forEach((b) => {
      if (Array.isArray(b.category)) b.category.forEach((c) => categories.add(c));
      else if (b.category) categories.add(b.category);
    });
    categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  }

  function attachBookEvents() {
    document.querySelectorAll(".action-btn.view").forEach((btn) => {
      btn.addEventListener("click", () => openBookModal(btn.dataset.id));
    });

document.querySelectorAll("#booksSection .action-btn.delete").forEach(btn => {
  btn.addEventListener("click", () => {
    const bookId = btn.dataset.id;
    const modal = document.getElementById("bookDeleteModal");
    const confirmBtn = document.getElementById("confirmBookDelete");
    const cancelBtn = document.getElementById("cancelBookDelete");

    modal.classList.add("show");

    cancelBtn.onclick = () => {
      modal.classList.remove("show");
    };

    confirmBtn.onclick = async () => {
      const token = sessionStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/books/${bookId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        showPopup(data.message || "Book deleted successfully");
        modal.classList.remove("show");
        deletedCount++;
        loadBooks();
      } catch (err) {
        console.error("Delete book failed:", err);
        showPopup("Failed to delete book. Please try again.");
        modal.classList.remove("show");
      }
    };
  });
});

  }

  // --- Modal Logic ---
  const bookModal = document.getElementById("bookModal");
  const closeBookModal = document.getElementById("closeBookModal");
  const deleteBookBtn = document.getElementById("deleteBookBtn");

  async function openBookModal(id) {
    const book = allBooks.find((b) => b._id === id);
    if (!book) return;

    document.getElementById("modalBookTitle").textContent = book.title;
    document.getElementById("modalBookAuthor").textContent = book.author;
    document.getElementById("modalBookCategory").textContent = Array.isArray(book.category)
      ? book.category.join(", ")
      : book.category;
    document.getElementById("modalBookYear").textContent = book.year;
    document.getElementById("modalCover").src = book.img || "img/default-book.png";
    deleteBookBtn.dataset.id = book._id;

    bookModal.classList.add("show");
  }

  closeBookModal.addEventListener("click", () => {
    bookModal.classList.remove("show");
  });

  deleteBookBtn.addEventListener("click", async () => {
    const id = deleteBookBtn.dataset.id;
    const token = sessionStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/books/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    showPopup(data.message || "Book deleted");
    deletedCount++;
    bookModal.classList.remove("show");
    loadBooks();
  });

  // --- Search + Filter ---
  bookSearch.addEventListener("input", () => {
    const query = bookSearch.value.toLowerCase();
    const filtered = allBooks.filter((b) => {
      const title = (b.title || "").toLowerCase();
      const author = (b.author || "").toLowerCase();
      const publisher = (b.publisher || "").toLowerCase();
      const year = String(b.year || "").toLowerCase();
      return (
        title.includes(query) ||
        author.includes(query) ||
        publisher.includes(query) ||
        year.includes(query)
      );
    });
    renderBooks(filtered);
  });

  categoryFilter.addEventListener("change", () => {
    const value = categoryFilter.value;
    if (value === "all") renderBooks(allBooks);
    else renderBooks(allBooks.filter((b) => b.category.includes(value)));
  });

  booksTab.addEventListener("click", loadBooks);

  // ===============================
  // 📊 REPORTS TAB LOGIC
  // ===============================
  const reportTotalUsers = document.getElementById("reportTotalUsers");
  const reportTotalBooks = document.getElementById("reportTotalBooks");
  const reportTopCategory = document.getElementById("reportTopCategory");
  const reportTopBook = document.getElementById("reportTopBook");

  let allActivities = [];

  reportsTab.addEventListener("click", async (e) => {
    e.preventDefault();
    userTab.classList.remove("active");
    booksTab.classList.remove("active");
    reportsTab.classList.add("active");

    usersSection.classList.add("hidden");
    booksSection.classList.add("hidden");
    reportsSection.classList.remove("hidden");

    await loadReports();
  });

  async function loadReports() {
    try {
      const token = sessionStorage.getItem("token");

      // Summary
      const reportRes = await fetch(`${API_URL}/api/report-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const report = await reportRes.json();

      reportTotalUsers.textContent = report.totalUsers || 0;
      reportTotalBooks.textContent = report.totalBooks || 0;
      reportTopCategory.textContent = report.topCategory || "N/A";
      reportTopBook.textContent = report.topBook || "N/A";

      // Activities
      const activityRes = await fetch(`${API_URL}/api/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      allActivities = await activityRes.json();

      renderActivities();
    } catch (err) {
      console.error("Error loading reports:", err);
      activityTableBody.innerHTML =
        "<tr><td colspan='4' style='text-align:center;'>Failed to load report data.</td></tr>";
    }
  }

  // ✅ Sorting + Rendering for Activities
  function renderActivities() {
    if (!Array.isArray(allActivities) || allActivities.length === 0) {
      activityTableBody.innerHTML = `<tr><td colspan='4' style='text-align:center;'>No recent activity found.</td></tr>`;
      return;
    }

    let sorted = [...allActivities];
    switch (activitySort?.value) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "user":
        sorted.sort((a, b) => (a.user || "").localeCompare(b.user || ""));
        break;
      case "action":
        sorted.sort((a, b) => (a.action || "").localeCompare(b.action || ""));
        break;
      default:
        sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    activityTableBody.innerHTML = sorted
      .slice(0, 10)
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
  }

  if (activitySort) activitySort.addEventListener("change", renderActivities);

// ✅ Filter Activities by Month + Year
const monthFilter = document.getElementById("monthFilter");

if (monthFilter) {
  monthFilter.addEventListener("change", () => {
    const monthValue = monthFilter.value; // e.g. "2025-10"
    if (!monthValue) {
      renderActivities(); // show all if no month picked
      return;
    }

    const [year, month] = monthValue.split("-").map(Number);

    // ✅ Filter activities by selected month
    const filtered = allActivities.filter(a => {
      const d = new Date(a.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    // ✅ Apply sorting again
    let sorted = [...filtered];
    switch (activitySort?.value) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "user":
        sorted.sort((a, b) => (a.user || "").localeCompare(b.user || ""));
        break;
      case "action":
        sorted.sort((a, b) => (a.action || "").localeCompare(b.action || ""));
        break;
      default:
        sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // ✅ Render results
    activityTableBody.innerHTML = sorted.length
      ? sorted
          .map(a => `
            <tr>
              <td>${new Date(a.date).toLocaleString()}</td>
              <td>${a.user || "Unknown"}</td>
              <td>${a.action || "N/A"}</td>
              <td>${a.details || ""}</td>
            </tr>
          `)
          .join("")
      : `<tr><td colspan='4' style='text-align:center;'>No activity found for this month.</td></tr>`;
  });
}

// ===============================
// 📤 EXPORT RECENT ACTIVITY (FIXED)
// ===============================
const exportPNG = document.getElementById("exportPNG");
const exportPDF = document.getElementById("exportPDF");
const exportExcel = document.getElementById("exportExcel");

if (exportPNG || exportPDF || exportExcel) {
  // 🖼️ Export as PNG
  exportPNG?.addEventListener("click", async () => {
    const table = document.querySelector("#reportsSection table.user-table");
    if (!table) return alert("No activity table found!");
    const canvas = await html2canvas(table, { scale: 2 });
    const link = document.createElement("a");
    link.download = "Recent_Activity.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  // 📄 Export as PDF (same as PNG view)
  exportPDF?.addEventListener("click", async () => {
    const table = document.querySelector("#reportsSection table.user-table");
    if (!table) return alert("No activity table found!");

    // Render visible table as image
    const canvas = await html2canvas(table, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Recent Activity Report", pageWidth / 2, 20, { align: "center" });

    pdf.addImage(imgData, "PNG", 10, 30, imgWidth, imgHeight);
    pdf.save("Recent_Activity_Report.pdf");
  });

  // 📊 Export as Excel
  exportExcel?.addEventListener("click", () => {
    const table = document.querySelector("#reportsSection table.user-table");
    if (!table) return alert("No activity table found!");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Recent Activity" });
    XLSX.writeFile(wb, "Recent_Activity.xlsx");
  });
}



});
