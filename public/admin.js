document.addEventListener("DOMContentLoaded", () => {
  const API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://openark2-0.onrender.com";

  // --- Element References ---
  const userTab = document.getElementById("userTab");
  const booksTab = document.getElementById("booksTab");
  const usersSection = document.getElementById("usersSection");
  const booksSection = document.getElementById("booksSection");
  const userTableBody = document.getElementById("userTableBody");
  const popup = document.getElementById("popup");
  const totalUsers = document.getElementById("totalUsers");
  const activeUsers = document.getElementById("activeUsers");
  const inactiveUsers = document.getElementById("inactiveUsers");

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

  // --- Tab switching ---
  userTab.addEventListener("click", (e) => {
    e.preventDefault();
    userTab.classList.add("active");
    booksTab.classList.remove("active");
    usersSection.classList.remove("hidden");
    booksSection.classList.add("hidden");
  });

  booksTab.addEventListener("click", (e) => {
    e.preventDefault();
    userTab.classList.remove("active");
    booksTab.classList.add("active");
    usersSection.classList.add("hidden");
    booksSection.classList.remove("hidden");
  });

  // --- Render Users ---
  function renderUsers(users) {
    userTableBody.innerHTML = "";

    if (!Array.isArray(users) || users.length === 0) {
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;opacity:0.7;'>No users found.</td></tr>";
      return;
    }

    let activeCount = 0;
    let inactiveCount = 0;

    users.forEach((u) => {
      const status = u.active;
      if (status) activeCount++;
      else inactiveCount++;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${u.profilePic || 'assets/default-pfp.png'}" alt="pfp"></td>
        <td>${u.username || "N/A"}</td>
        <td>${u.email || "N/A"}</td>
        <td>${u.role || "student"}</td>
        <td><span class="status ${status ? "active" : "inactive"}">${status ? "Active" : "Inactive"}</span></td>
        <td>
          <button class="action-btn delete" data-id="${u._id}">Delete Account</button>
        </td>
      `;
      userTableBody.appendChild(tr);
    });

    totalUsers.textContent = users.length;
    activeUsers.textContent = activeCount;
    inactiveUsers.textContent = inactiveCount;

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

    // open modal
    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        targetUserId = btn.dataset.id;
        modal.classList.add("show");
      });
    });

    // cancel
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("show");
      targetUserId = null;
    });

    // confirm delete
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

  // --- Filters ---
  function applyFilters() {
    const searchValue = document.getElementById("searchInput").value.toLowerCase();
    const selectedRole = document.getElementById("roleFilter").value.toLowerCase();
    const selectedStatus = document.getElementById("statusFilter").value.toLowerCase();

    document.querySelectorAll("#userTableBody tr").forEach((row) => {
      const name = row.children[1]?.textContent.toLowerCase() || "";
      const email = row.children[2]?.textContent.toLowerCase() || "";
      const role = row.children[3]?.textContent.toLowerCase() || "";
      const status = row.children[4]?.textContent.toLowerCase() || "";

      const matchesSearch = name.includes(searchValue) || email.includes(searchValue);
      const matchesRole = selectedRole === "all" || role === selectedRole;
      const matchesStatus = selectedStatus === "all" || status === selectedStatus;

      row.style.display = matchesSearch && matchesRole && matchesStatus ? "" : "none";
    });
  }

  document.getElementById("searchInput")?.addEventListener("input", applyFilters);
  document.getElementById("roleFilter")?.addEventListener("change", applyFilters);
  document.getElementById("statusFilter")?.addEventListener("change", applyFilters);

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
});
