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
  const addBookBtn = document.getElementById("addBookBtn");
  const addBookModal = document.getElementById("addBookModal");
  const closeAddBookBtn = document.getElementById("closeAddBookBtn");
  const addBookForm = document.getElementById("addBookForm");
  const conversionBooks = document.getElementById("conversionBooks");

  if (homeTab && conversionTab && homeSection && conversionSection) {
    homeTab.addEventListener("click", (e) => {
      e.preventDefault();
      homeSection.classList.remove("hidden");
      conversionSection.classList.add("hidden");
    });

    conversionTab.addEventListener("click", (e) => {
      e.preventDefault();
      conversionSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
    });
      }

      if (addBookBtn && addBookModal && closeAddBookBtn && addBookForm) {
  addBookBtn.addEventListener("click", () => {
    addBookModal.classList.remove("hidden");
  });

  closeAddBookBtn.addEventListener("click", () => {
    addBookModal.classList.add("hidden");
  });

  addBookModal.addEventListener("click", (e) => {
    const container = addBookModal.querySelector(".profile-container");
    if (!container.contains(e.target)) {
      addBookModal.classList.add("hidden");
    }
  });

  addBookForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(addBookForm);
    const newBook = {
      title: formData.get("title"),
      author: formData.get("author"),
      publisher: formData.get("publisher"),
      year: formData.get("year"),
      category: formData.get("category")
    };

    // --- Add to backend (API) ---
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newBook)
      });
      if (!res.ok) throw new Error("Failed to add book");

      // --- Add to UI ---
      const div = document.createElement("div");
      div.className = "book";
      div.innerHTML = `
        <img src="img/default-book.png" alt="${newBook.title}">
        <p>${newBook.title}</p>
      `;
      conversionBooks.insertBefore(div, addBookBtn);

      addBookForm.reset();
      addBookModal.classList.add("hidden");
      alert("✅ Book added successfully!");
    } catch (err) {
      alert("❌ " + err.message);
    }
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
  if (featuredBookContainer && books.length > 0) {
    featuredBookContainer.innerHTML = `
      <img src="${books[0].img}" alt="${books[0].title}">
      <div class="info">
        <h3>${books[0].title}</h3>
        <p>${books[0].desc || "No description available."}</p>
      </div>
    `;

    let current = 0;
    function showBook(index) {
      const img = featuredBookContainer.querySelector("img");
      const title = featuredBookContainer.querySelector("h3");
      const desc = featuredBookContainer.querySelector("p");

      img.classList.add("fade-out");
      title.classList.add("fade-out");
      desc.classList.add("fade-out");

      setTimeout(() => {
        img.src = books[index].img;
        img.alt = books[index].title;
        title.textContent = books[index].title;
        desc.textContent = books[index].desc || "No description available.";

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
    books.forEach((book) => {
      const div = document.createElement("div");
      div.className = "book";
      div.innerHTML = `
        <img src="${book.img}" alt="${book.title}">
        <p>${book.title}</p>
      `;
      dashboardBooks.appendChild(div);
    });
  }
});
