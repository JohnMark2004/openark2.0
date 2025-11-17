document.addEventListener("DOMContentLoaded", () => {
  const API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://openark2-0.onrender.com";

  // --- Element References ---
  const userTab = document.getElementById("userTab");
  const booksTab = document.getElementById("booksTab");
  const reportsTab = document.getElementById("reportsTab");
  const archiveTab = document.getElementById("archiveTab");
  const usersSection = document.getElementById("usersSection");
  const booksSection = document.getElementById("booksSection");
  const reportsSection = document.getElementById("reportsSection");
  const archiveSection = document.getElementById("archiveSection");
  const userTableBody = document.getElementById("userTableBody");
  const popup = document.getElementById("popup");
  const totalUsers = document.getElementById("totalUsers");
  const activeUsers = document.getElementById("activeUsers");
  const inactiveUsers = document.getElementById("inactiveUsers");
  const activityTableBody = document.getElementById("activityTableBody");
  const activitySort = document.getElementById("activitySort");
  const activityBackBtn = document.getElementById("activityBackBtn");
  const activityNextBtn = document.getElementById("activityNextBtn");
  const activityPageInfo = document.getElementById("activityPageInfo");
  const monthFilter = document.getElementById("monthFilter"); // We need this
  const pruneDateInput = document.getElementById("pruneDate");
  const pruneLogsBtn = document.getElementById("pruneLogsBtn");
  const pruneLogsModal = document.getElementById("pruneLogsModal");
  const cancelPruneLogs = document.getElementById("cancelPruneLogs");
  const confirmPruneLogs = document.getElementById("confirmPruneLogs");
  const pruneDateConfirm = document.getElementById("pruneDateConfirm");

  // ✅ ADD ALL THESE
  const archiveTableBody = document.getElementById("archiveTableBody");
  const archiveSearch = document.getElementById("archiveSearch");
  const archivedBooks = document.getElementById("archivedBooks"); // Stat
  
  const archiveModal = document.getElementById("archiveModal");
  const cancelArchive = document.getElementById("cancelArchive");
  const confirmArchive = document.getElementById("confirmArchive");
  
  const bookPermanentDeleteModal = document.getElementById("bookPermanentDeleteModal");
  const cancelPermanentDelete = document.getElementById("cancelPermanentDelete");
  const confirmPermanentDelete = document.getElementById("confirmPermanentDelete");

  // --- Global State ---
  let allUsers = []; // ✅ For efficient filtering
  let allBooks = [];
  let allArchivedBooks = [];
  let deletedBookCount = 0;
  let targetBookId = null; // ✅ For delete modal
  let targetArchiveBookId = null;
  let allActivities = []; // Holds all fetched activities
  let sortedActivities = []; // Holds filtered and sorted activities
  let activityCurrentPage = 1;
  const activityItemsPerPage = 10;

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

  // ✅ ADD THIS BLOCK
  // --- Show Welcome Message on Login ---
  if (sessionStorage.getItem("justLoggedIn") === "true") {
    const username = localStorage.getItem("username") || "Admin"; // Default to Admin
    showPopup(`Welcome ${username} to OpenArk!`, "success");
    sessionStorage.removeItem("justLoggedIn"); // Clear the flag
  }

  // ===============================
  // 🔘 TAB SWITCHING LOGIC
  // ===============================
userTab.addEventListener("click", (e) => {
    e.preventDefault();
    userTab.classList.add("active");
    booksTab.classList.remove("active");
    reportsTab.classList.remove("active");
    archiveTab.classList.remove("active"); // ✅ ADD

    usersSection.classList.remove("hidden");
    booksSection.classList.add("hidden");
    reportsSection.classList.add("hidden");
    archiveSection.classList.add("hidden"); // ✅ ADD
  });

  booksTab.addEventListener("click", (e) => {
    e.preventDefault();
    booksTab.classList.add("active");
    userTab.classList.remove("active");
    reportsTab.classList.remove("active");
    archiveTab.classList.remove("active"); // ✅ ADD

    usersSection.classList.add("hidden");
    booksSection.classList.remove("hidden");
    reportsSection.classList.add("hidden");
    archiveSection.classList.add("hidden"); // ✅ ADD
    loadBooks();
  });

  // ✅ ADD THIS ENTIRE NEW BLOCK
  archiveTab.addEventListener("click", (e) => {
    e.preventDefault();
    archiveTab.classList.add("active");
    userTab.classList.remove("active");
    booksTab.classList.remove("active");
    reportsTab.classList.remove("active");

    usersSection.classList.add("hidden");
    booksSection.classList.add("hidden");
    reportsSection.classList.add("hidden");
    archiveSection.classList.remove("hidden");
    loadArchivedBooks(); 
  });

reportsTab.addEventListener("click", async (e) => {
    e.preventDefault();
    userTab.classList.remove("active");
    booksTab.classList.remove("active");
    reportsTab.classList.remove("active");
    archiveTab.classList.remove("active"); // ✅ ADD

    usersSection.classList.add("hidden");
    booksSection.classList.add("hidden");
    reportsSection.classList.remove("hidden");
    archiveSection.classList.add("hidden"); // ✅ ADD
    await loadReports();
  });

  // ===============================
  // 👤 USER TAB LOGIC
  // ===============================

  function renderUsers(users) {
    userTableBody.innerHTML = "";
    if (!Array.isArray(users) || users.length === 0) {
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>No users found.</td></tr>";
    }

    // Update stats *before* rendering
    totalUsers.textContent = allUsers.length; // ✅ Use allUsers for total
    activeUsers.textContent = allUsers.filter((u) => u.active).length;
    inactiveUsers.textContent = allUsers.filter((u) => !u.active).length;

    if (users.length === 0) return; // Exit if no users match filter

    users.forEach((u) => {
      const tr = document.createElement("tr");
      const isActive = u.active;
      tr.innerHTML = `
        <td><img src="${u.profilePic || 'assets/default-pfp.png'}" alt="pfp"></td>
        <td>${u.username || "N/A"}</td>
        <td>${u.email || "N/A"}</td>
        <td>${u.role || "student"}</td>
        <td><span class="status ${isActive ? "active" : "inactive"}">
          ${isActive ? "Active" : "Inactive"}
        </span></td>
        <td>
          ${
            isActive
              ? `<button class="action-btn deactivate" data-id="${u._id}">Deactivate</button>`
              : `<button class="action-btn approve" data-id="${u._id}">Approve</button>`
          }
        </td>
      `;
      userTableBody.appendChild(tr);
    });

    // ✅ Re-attach listeners just for the new buttons
    attachUserActionEvents();
  }

  // ✅ Attach listeners to dynamic buttons
  function attachUserActionEvents() {
    // Approve User
    document.querySelectorAll(".action-btn.approve").forEach((btn) => {
      btn.addEventListener("click", handleApproveUser);
    });
    // Deactivate User
    document.querySelectorAll(".action-btn.deactivate").forEach((btn) => {
      btn.addEventListener("click", handleDeactivateUser);
    });
  }

  // ✅ Approve User Handler
  async function handleApproveUser(e) {
    const btn = e.target;
    const token = sessionStorage.getItem("token");
    const userId = btn.dataset.id;
    
    btn.disabled = true;
    btn.textContent = "Approving...";

    try {
      const res = await fetch(`${API_URL}/api/users/approve/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok || data.error?.toLowerCase().includes("already active")) {
        showPopup(data.message || "User approved successfully!");
        // Update global state
        const user = allUsers.find(u => u._id === userId);
        if (user) user.active = true;
        // Re-render the filtered list
        filterAndRenderUsers();
      } else {
        showPopup(data.error || "Failed to approve user.", "error");
        btn.disabled = false;
        btn.textContent = "Approve";
      }
    } catch (err) {
      console.error("Approve failed:", err);
      showPopup("Server error: could not approve user.", "error");
      btn.disabled = false;
      btn.textContent = "Approve";
    }
  }

  // ✅ Deactivate User Handler
  async function handleDeactivateUser(e) {
    const btn = e.target;
    const token = sessionStorage.getItem("token");
    const userId = btn.dataset.id;
    
    btn.disabled = true;
    btn.textContent = "Deactivating...";

    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: false }),
      });
      const data = await res.json();

      if (res.ok) {
        showPopup(data.message || "User deactivated successfully!");
        // Update global state
        const user = allUsers.find(u => u._id === userId);
        if (user) user.active = false;
        // Re-render the filtered list
        filterAndRenderUsers();
      } else {
        showPopup(data.error || "Failed to deactivate user.", "error");
        btn.disabled = false;
        btn.textContent = "Deactivate";
      }
    } catch (err) {
      console.error("Deactivation failed:", err);
      showPopup("Server error: could not deactivate user.", "error");
      btn.disabled = false;
      btn.textContent = "Deactivate";
    }
  }

  // --- Load All Users ---
  async function loadUsers() {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load users");
      allUsers = await res.json(); // ✅ Store in global variable

      // ✅ NEW: Sort by active status (pending first)
      allUsers.sort((a, b) => a.active - b.active);

      filterAndRenderUsers(); // ✅ Render via filter
    } catch (err) {
      console.error("Error loading users:", err);
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>Failed to load users.</td></tr>";
    }
  }

  // ===============================
  // 🔍 USER SEARCH + FILTERS (FIXED)
  // ===============================
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  // ✅ Combined filter function
  function filterAndRenderUsers() {
    const query = searchInput.value.toLowerCase();
    const role = roleFilter.value;
    const status = statusFilter.value;

    const filtered = allUsers.filter((u) => {
      const matchesQuery =
        u.username?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query);
      const matchesRole = role === "all" || u.role === role;
      const matchesStatus =
        status === "all" ||
        (status === "active" && u.active) ||
        (status === "inactive" && !u.active);
      return matchesQuery && matchesRole && matchesStatus;
    });
    renderUsers(filtered);
  }

  // ✅ Add listeners to all filters
  searchInput.addEventListener("input", filterAndRenderUsers);
  roleFilter.addEventListener("change", filterAndRenderUsers);
  statusFilter.addEventListener("change", filterAndRenderUsers);

  // ===============================
  // ⛔️ USER DELETE MODAL (REMOVED)
  // ===============================
  // (All logic for deleteModal, confirmDeleteBtn, and cancelDeleteBtn removed)

  // --- Logout Button ---
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

  // ===============================
  // 📚 BOOK MANAGEMENT TAB LOGIC
  // ===============================
  const bookTableBody = document.getElementById("bookTableBody");
  const totalBooks = document.getElementById("totalBooks");
  const recentBooks = document.getElementById("recentBooks");
  const deletedBooks = document.getElementById("deletedBooks");
  const bookSearch = document.getElementById("bookSearch");
  const categoryFilter = document.getElementById("categoryFilter");

  async function loadBooks() {
    try {
      const res = await fetch(`${API_URL}/api/books`);
      const books = await res.json();
      allBooks = books;

      await loadArchivedBooks(true);

      renderBooks(books);
      updateBookStats();
      populateCategories(books);
    } catch (err) {
      console.error("Error loading books:", err);
      bookTableBody.innerHTML =
        "<tr><td colspan='7' style='text-align:center;opacity:0.7;'>Failed to load books.</td></tr>";
    }
  }

  function renderBooks(books) {
    bookTableBody.innerHTML = "";
    if (books.length === 0) {
      bookTableBody.innerHTML =
        "<tr><td colspan='7' style='text-align:center;opacity:0.7;'>No books found.</td></tr>";
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
          <button class="action-btn archive" data-id="${b._id}">Archive</button>
        </td>
      `;
      bookTableBody.appendChild(tr);
    });
    attachBookEvents();
  }

  function updateBookStats() {
totalBooks.textContent = allBooks.length;
    // ✅ MODIFIED THIS LINE
    archivedBooks.textContent = allArchivedBooks.length;
    // ✅ MODIFIED THIS LINE (removed deletedBookCount)
    recentBooks.textContent = allBooks
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5).length; // Shows count of 5 newest
  }

  function populateCategories(books) {
    const categories = new Set();
    books.forEach((b) => {
      if (Array.isArray(b.category)) b.category.forEach((c) => categories.add(c));
      else if (b.category) categories.add(b.category);
    });
    categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
    [...categories].sort().forEach((c) => { // ✅ Sort categories
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  }

function attachBookEvents() {
    // View book
    document.querySelectorAll("#booksSection .action-btn.view").forEach((btn) => {
      btn.onclick = () => openBookModal(btn.dataset.id);
    });
    // ✅ MODIFIED THIS BLOCK
    // Archive book (opens modal)
    document.querySelectorAll("#booksSection .action-btn.archive").forEach((btn) => {
      btn.onclick = () => {
        targetArchiveBookId = btn.dataset.id; // Use the new variable
        archiveModal.classList.add("show"); // Open the new archive modal
      };
    });
  }

  // --- Book View Modal ---
  const bookModal = document.getElementById("bookModal");
  const closeBookModal = document.getElementById("closeBookModal");
  closeBookModal.addEventListener("click", () => {
    bookModal.classList.remove("show");
  });
  // ✅ Removed buggy delete button from this modal, as it's confusing.
  const deleteBookBtn = document.getElementById("deleteBookBtn");
  if (deleteBookBtn) deleteBookBtn.style.display = "none";

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
    bookModal.classList.add("show");
  }

// --- Book Delete Modal (FIXED) ---
  // ✅ RENAMED ALL THESE VARIABLES
  const confirmPermanentDeleteBtn = document.getElementById("confirmPermanentDelete");
  const cancelPermanentDeleteBtn = document.getElementById("cancelPermanentDelete");

  // ✅ Listeners attached ONCE
  cancelPermanentDeleteBtn.addEventListener("click", () => {
    bookPermanentDeleteModal.classList.remove("show");
    targetBookId = null;
  });

  confirmPermanentDeleteBtn.addEventListener("click", async () => {
    if (!targetBookId) return;
    const token = sessionStorage.getItem("token");
    confirmPermanentDeleteBtn.disabled = true;
    confirmPermanentDeleteBtn.textContent = "Deleting...";

    try {
      const res = await fetch(`${API_URL}/api/books/${targetBookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showPopup(data.message || "Book permanently deleted");
      
      // ✅ MODIFIED THIS LINE
      await loadArchivedBooks(); // Reload the *archive* list
    } catch (err) {
      console.error("Delete book failed:", err);
      showPopup("Failed to delete book. Please try again.");
    } finally {
      bookPermanentDeleteModal.classList.remove("show");
      targetBookId = null;
      confirmPermanentDeleteBtn.disabled = false;
      confirmPermanentDeleteBtn.textContent = "Delete";
    }
  });

  // --- Book Search + Filter (Already efficient) ---
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
    else renderBooks(allBooks.filter((b) => (b.category || []).includes(value)));
  });

  // ===============================
  // 📊 REPORTS TAB LOGIC
  // ===============================
  const reportTotalUsers = document.getElementById("reportTotalUsers");
  const reportTotalBooks = document.getElementById("reportTotalBooks");
  const reportTopCategory = document.getElementById("reportTopCategory");

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

      // ✅ ADD THIS LINE (if you have stats on the reports page)
      // If not, you can skip this, but it's good for consistency
      if(document.getElementById("archivedBooks")) {
         document.getElementById("archivedBooks").textContent = report.totalArchivedBooks || 0;
      }
      
      // Activities
      const activityRes = await fetch(`${API_URL}/api/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      allActivities = await activityRes.json(); // Store in master list
      activityCurrentPage = 1; // Reset to first page
      processAndRenderActivities(); // Call the new processing function
    } catch (err) {
      console.error("Error loading reports:", err);
      activityTableBody.innerHTML =
        "<tr><td colspan='4' style='text-align:center;'>Failed to load report data.</td></tr>";
    }
  }

  // ✅ NEW: This function filters and sorts the master list
  function processAndRenderActivities() {
    // 1. Filter by Month
    const monthValue = monthFilter.value;
    let filtered = [...allActivities];
    if (monthValue) {
      const [year, month] = monthValue.split("-").map(Number);
      filtered = allActivities.filter(a => {
        const d = new Date(a.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }
    
    // 2. Sort
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
    
    sortedActivities = filtered; // Store the processed list
    renderActivitiesPage(); // Render the current page
  }

  // ✅ NEW: This function updates the "Back" / "Next" buttons and page info
  function updatePaginationUI() {
    const totalItems = sortedActivities.length;
    const totalPages = Math.ceil(totalItems / activityItemsPerPage);

    if (totalPages <= 1) {
      // Hide pagination if only one page or no items
      activityBackBtn.style.display = "none";
      activityNextBtn.style.display = "none";
      activityPageInfo.style.display = "none";
    } else {
      // Show pagination and set button states
      activityBackBtn.style.display = "inline-block";
      activityNextBtn.style.display = "inline-block";
      activityPageInfo.style.display = "inline-block";
      
      activityBackBtn.disabled = (activityCurrentPage === 1);
      activityNextBtn.disabled = (activityCurrentPage === totalPages);
      activityPageInfo.textContent = `Page ${activityCurrentPage} of ${totalPages || 1}`;
    }
  }
  
  // ✅ MODIFIED: This function (formerly renderActivities) now just renders the page
  function renderActivitiesPage() {
    if (!Array.isArray(sortedActivities) || sortedActivities.length === 0) {
      activityTableBody.innerHTML = `<tr><td colspan='4' style='text-align:center;'>No recent activity found.</td></tr>`;
      updatePaginationUI(); // Update UI to show 0 pages
      return;
    }
    
    // Calculate page slice
    const startIndex = (activityCurrentPage - 1) * activityItemsPerPage;
    const endIndex = startIndex + activityItemsPerPage;
    const pageItems = sortedActivities.slice(startIndex, endIndex);

    activityTableBody.innerHTML = pageItems
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

// ✅ NEW: Event Listeners for Pagination
  activityNextBtn.addEventListener("click", () => {
    activityCurrentPage++;
    renderActivitiesPage();
  });

  activityBackBtn.addEventListener("click", () => {
    activityCurrentPage--;
    renderActivitiesPage();
  });

if (activitySort) {
    activitySort.addEventListener("change", () => {
      activityCurrentPage = 1; // Reset to page 1 on sort
      processAndRenderActivities();
    });
  }

  // Filter Activities by Month + Year
if (monthFilter) {
    monthFilter.addEventListener("change", () => {
      activityCurrentPage = 1; // Reset to page 1 on filter
      processAndRenderActivities();
    });
  }

  // ===============================
  // 📤 EXPORT RECENT ACTIVITY
  // ===============================
  const exportPNG = document.getElementById("exportPNG");
  const exportPDF = document.getElementById("exportPDF");
  const exportExcel = document.getElementById("exportExcel");

  if (exportPNG) {
    exportPNG.addEventListener("click", async () => {
      const table = document.querySelector("#reportsSection table.user-table");
      if (!table) return alert("No activity table found!");
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
      if (!table) return alert("No activity table found!");
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
  }

  if (exportExcel) {
    exportExcel.addEventListener("click", () => {
      const table = document.querySelector("#reportsSection table.user-table");
      if (!table) return alert("No activity table found!");
      const wb = XLSX.utils.table_to_book(table, { sheet: "Recent Activity" });
      XLSX.writeFile(wb, "Recent_Activity.xlsx");
    });
  }

// ===============================
  // 🗑️ PRUNE (DELETE) OLD LOGS LOGIC
  // ===============================
// ===============================
  // 🗑️ PRUNE (DELETE) OLD LOGS LOGIC
  // ===============================
  let dateToPrune = null;

  // 1. Open the confirmation modal
  pruneLogsBtn.addEventListener("click", () => {
    const selectedDate = pruneDateInput.value;
    if (!selectedDate) {
      showPopup("Please select a date first.", "error");
      return;
    }
    
    // -------------------
    // ▼▼▼ START OF FIX 1.A ▼▼▼
    // -------------------
    // OLD: dateToPrune = new Date(selectedDate);
    dateToPrune = selectedDate; // ✅ Store the string "YYYY-MM-DD"

    // OLD: pruneDateConfirm.textContent = dateToPrune.toLocaleDateString(undefined, {
    // ✅ Wrap in new Date() just for local display in the modal
    pruneDateConfirm.textContent = new Date(dateToPrune).toLocaleDateString(undefined, {
    // -------------------
    // ▲▲▲ END OF FIX 1.A ▲▲▲
    // -------------------
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pruneLogsModal.classList.add("show");
  });

  // 2. Cancel deletion (This is fine, no change)
  cancelPruneLogs.addEventListener("click", () => {
    pruneLogsModal.classList.remove("show");
    dateToPrune = null;
  });

  // 3. Confirm and execute deletion
  confirmPruneLogs.addEventListener("click", async () => {
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
        // ▼▼▼ START OF FIX 1.B ▼▼▼
        // -------------------
        // OLD: body: JSON.stringify({ beforeDate: dateToPrune.toISOString() }),
        body: JSON.stringify({ beforeDate: dateToPrune }), // ✅ Send the raw string
        // -------------------
        // ▲▲▲ END OF FIX 1.B ▲▲▲
        // -------------------
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete logs");
      }

      showPopup(data.message || "Logs deleted successfully!");
      await loadReports(); // Refresh the activity list

    } catch (err) {
      console.error("Prune logs error:", err);
      showPopup(err.message, "error");
    } finally {
      // Reset modal and button
      pruneLogsModal.classList.remove("show");
      confirmPruneLogs.disabled = false;
      confirmPruneLogs.textContent = "Confirm & Delete";
      dateToPrune = null;
      pruneDateInput.value = ""; // Clear the date input
    }
  });

  // ===============================
  // 📚 ARCHIVE TAB LOGIC
  // ===============================

  // ✅ NEW: Logic for new Archive Modal
  cancelArchive.addEventListener("click", () => {
    archiveModal.classList.remove("show");
    targetArchiveBookId = null;
  });

  confirmArchive.addEventListener("click", async () => {
    if (!targetArchiveBookId) return;
    const token = sessionStorage.getItem("token");
    confirmArchive.disabled = true;

    try {
      const res = await fetch(`${API_URL}/api/books/${targetArchiveBookId}/archive`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");

      showPopup(data.message || "Book archived");
      await loadBooks(); // This will reload both lists and update stats
    } catch (err) {
      console.error("Archive failed:", err);
      showPopup("Failed to archive book.", "error");
    } finally {
      archiveModal.classList.remove("show");
      targetArchiveBookId = null;
      confirmArchive.disabled = false;
    }
  });


  // ✅ NEW: Load all archived books
  async function loadArchivedBooks(silent = false) {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/books/archived`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load archived books");
      allArchivedBooks = await res.json();
      
      if (!silent) {
        renderArchivedBooks(allArchivedBooks);
      }
    } catch (err) {
      console.error("Error loading archived books:", err);
      if (!silent) {
        archiveTableBody.innerHTML =
          "<tr><td colspan='5' style='text-align:center;opacity:0.7;'>Failed to load archive.</td></tr>";
      }
    }
  }

  // ✅ NEW: Render archived books to the new table
  function renderArchivedBooks(books) {
    archiveTableBody.innerHTML = "";
    if (books.length === 0) {
      archiveTableBody.innerHTML =
        "<tr><td colspan='5' style='text-align:center;opacity:0.7;'>The archive is empty.</td></tr>";
      return;
    }
    books.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${b.img}" alt="${b.title}" style="width:45px;height:60px;border-radius:6px;object-fit:cover;"></td>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${Array.isArray(b.category) ? b.category.join(", ") : b.category}</td>
        <td>
          <button class="action-btn restore" data-id="${b._id}">Restore</button>
          <button class="action-btn delete" data-id="${b._id}">Delete</button>
        </td>
      `;
      archiveTableBody.appendChild(tr);
    });
    attachArchiveBookEvents();
  }

  // ✅ NEW: Attach listeners for Restore and Permanent Delete
  function attachArchiveBookEvents() {
    // Restore button
    document.querySelectorAll("#archiveSection .action-btn.restore").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const token = sessionStorage.getItem("token");
        btn.disabled = true;
        try {
          const res = await fetch(`${API_URL}/api/books/${id}/restore`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed");

          showPopup(data.message || "Book restored");
          await loadArchivedBooks(); // Reload this tab
          // No need to call loadBooks(), stats will be updated next time user clicks tab
        } catch (err) {
          showPopup("Failed to restore book.", "error");
          btn.disabled = false;
        }
      };
    });
    
    // Permanent Delete button (opens modal)
    document.querySelectorAll("#archiveSection .action-btn.delete").forEach((btn) => {
      btn.onclick = () => {
        targetBookId = btn.dataset.id; // Use the permanent delete variable
        bookPermanentDeleteModal.classList.add("show");
      };
    });
  }

  // ✅ NEW: Search for archive tab
  archiveSearch.addEventListener("input", () => {
    const query = archiveSearch.value.toLowerCase();
    const filtered = allArchivedBooks.filter((b) => {
      return (b.title || "").toLowerCase().includes(query) ||
             (b.author || "").toLowerCase().includes(query);
    });
    renderArchivedBooks(filtered);
  });

  // --- Initial Load ---
  loadUsers();
});