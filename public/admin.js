import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const db = window.db; // from admin.html script
  const userTableBody = document.getElementById("userTableBody");
  const totalUsers = document.getElementById("totalUsers");
  const activeUsers = document.getElementById("activeUsers");
  const inactiveUsers = document.getElementById("inactiveUsers");
  const popup = document.getElementById("popup");

  const totalBooks = document.getElementById("totalBooks");
  const recentBooks = document.getElementById("recentBooks");
  const deletedBooks = document.getElementById("deletedBooks");
  const bookTableBody = document.getElementById("bookTableBody");

  const reportTotalUsers = document.getElementById("reportTotalUsers");
  const reportTotalBooks = document.getElementById("reportTotalBooks");
  const reportTopCategory = document.getElementById("reportTopCategory");
  const reportTopBook = document.getElementById("reportTopBook");

  // --- Popup helper ---
  function showPopup(message) {
    popup.textContent = message;
    popup.classList.add("show");
    setTimeout(() => popup.classList.remove("show"), 3000);
  }

  // ===============================
  // 👤 USERS (Firestore)
  // ===============================
  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderUsers(users);
    } catch (err) {
      console.error("Error loading users:", err);
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>Failed to load users.</td></tr>";
    }
  }

  function renderUsers(users) {
    userTableBody.innerHTML = "";
    if (users.length === 0) {
      userTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>No users found.</td></tr>";
      return;
    }

    users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${u.profilePic || "img/default-pfp.png"}" alt="pfp" style="width:45px;height:45px;border-radius:50%;"></td>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td>${u.role || "student"}</td>
        <td><span class="status ${u.active ? "active" : "inactive"}">
          ${u.active ? "Active" : "Pending"}
        </span></td>
        <td>
          ${
            u.active
              ? `<button class="action-btn delete" data-id="${u.id}">Delete</button>`
              : `
                <button class="action-btn approve" data-id="${u.id}">Approve</button>
                <button class="action-btn delete" data-id="${u.id}">Delete</button>
              `
          }
        </td>
      `;
      userTableBody.appendChild(tr);
    });

    totalUsers.textContent = users.length;
    activeUsers.textContent = users.filter((u) => u.active).length;
    inactiveUsers.textContent = users.filter((u) => !u.active).length;

    attachUserActions();
  }

  function attachUserActions() {
    document.querySelectorAll(".action-btn.approve").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.id;
        try {
          await updateDoc(doc(db, "users", userId), { active: true });
          showPopup("User approved!");
          loadUsers();
        } catch (err) {
          console.error(err);
          showPopup("Failed to approve user");
        }
      });
    });

    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.dataset.id;
        try {
          await deleteDoc(doc(db, "users", userId));
          showPopup("User deleted!");
          loadUsers();
        } catch (err) {
          console.error(err);
          showPopup("Failed to delete user");
        }
      });
    });
  }

  // ===============================
  // 📚 BOOKS (Firestore)
  // ===============================
  async function loadBooks() {
    try {
      const snapshot = await getDocs(collection(db, "books"));
      const books = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBooks(books);
    } catch (err) {
      console.error("Error loading books:", err);
      bookTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>Failed to load books.</td></tr>";
    }
  }

  function renderBooks(books) {
    bookTableBody.innerHTML = "";
    if (books.length === 0) {
      bookTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>No books found.</td></tr>";
      return;
    }

    books.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${b.img || "img/default-book.png"}" alt="${b.title}" style="width:45px;height:60px;border-radius:6px;object-fit:cover;"></td>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${Array.isArray(b.category) ? b.category.join(", ") : b.category}</td>
        <td>${b.publisher || "N/A"}</td>
        <td>${b.year || "-"}</td>
        <td><button class="action-btn delete" data-id="${b.id}">Delete</button></td>
      `;
      bookTableBody.appendChild(tr);
    });

    totalBooks.textContent = books.length;
    recentBooks.textContent = books.slice(-5).length;
    deletedBooks.textContent = "0"; // session placeholder

    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "books", btn.dataset.id));
          showPopup("Book deleted!");
          loadBooks();
        } catch (err) {
          console.error(err);
          showPopup("Failed to delete book");
        }
      });
    });
  }

  // ===============================
  // 📊 REPORTS (Firestore)
  // ===============================
  async function loadReports() {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const booksSnap = await getDocs(collection(db, "books"));

      const totalUsersCount = usersSnap.size;
      const totalBooksCount = booksSnap.size;

      const categoryCount = {};
      booksSnap.docs.forEach((d) => {
        const cats = Array.isArray(d.data().category)
          ? d.data().category
          : [d.data().category];
        cats.forEach((c) => {
          if (c) categoryCount[c] = (categoryCount[c] || 0) + 1;
        });
      });

      const topCategory =
        Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "N/A";
      let topBook = "N/A";
      if (!booksSnap.empty) {
        let max = null;
        booksSnap.docs.forEach((d) => {
          const data = d.data();
          if (!max || (data.pages || []).length > (max.pages || []).length)
            max = data;
        });
        if (max) topBook = `${max.title} (${(max.pages || []).length} pages)`;
      }

      reportTotalUsers.textContent = totalUsersCount;
      reportTotalBooks.textContent = totalBooksCount;
      reportTopCategory.textContent = topCategory;
      reportTopBook.textContent = topBook;
    } catch (err) {
      console.error("Error loading reports:", err);
    }
  }

  // ===============================
  // 🚪 LOGOUT
  // ===============================
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "intro.html";
  });

  // ===============================
  // 🔁 Real-time updates
  // ===============================
  onSnapshot(collection(db, "users"), () => loadUsers());
  onSnapshot(collection(db, "books"), () => {
    loadBooks();
    loadReports();
  });

  // ===============================
  // INITIAL LOAD
  // ===============================
  loadUsers();
  loadBooks();
  loadReports();
});
