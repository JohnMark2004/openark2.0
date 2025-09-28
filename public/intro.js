// ===============================
// TYPEWRITER EFFECT FOR SEARCH BAR
// ===============================
const input = document.getElementById("searchInput");

const phrases = [
  "Novels",
  "Mangas",
  "Comics",
  "Textbooks",
  "Magazines",
  "Research Papers",
  "Biographies",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Romance",
];

let phraseIndex = 0;
let charIndex = 0;
let deleting = false;

function typeAnimation() {
  const currentPhrase = phrases[phraseIndex];

  if (!deleting) {
    input.value = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    if (charIndex === currentPhrase.length) {
      deleting = true;
      setTimeout(typeAnimation, 1500);
      return;
    }
  } else {
    input.setAttribute("placeholder", currentPhrase.substring(0, charIndex - 1));
    charIndex--;
    if (charIndex === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
    }
  }
  setTimeout(typeAnimation, deleting ? 60 : 100);
}

typeAnimation();

// ===============================
// POPUP NOTIFICATIONS
// ===============================
function showPopup(message, type = "success") {
  const popup = document.getElementById("popup");
  popup.textContent = message;
  popup.className = `popup ${type} show`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    popup.classList.remove("show");
  }, 3000);
}

// ===============================
// MODAL LOGIC (Login / Signup)
// ===============================
const getStartedBtn = document.querySelector(".btn-login");
const loginModal = document.getElementById("loginModal");
const signupModal = document.getElementById("signupModal");
const toSignupLink = loginModal.querySelector(".signup-link a");
const toLoginLink = signupModal.querySelector(".login-link a");

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

getStartedBtn.addEventListener("click", (e) => {
  e.preventDefault();
  openModal(loginModal);
});

toSignupLink.addEventListener("click", (e) => {
  e.preventDefault();
  closeModal(loginModal);
  openModal(signupModal);
});

toLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  closeModal(signupModal);
  openModal(loginModal);
});

// Close modal when clicking outside container
[loginModal, signupModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    const container = modal.querySelector(".login-container, .signup-container");
    if (!container.contains(e.target)) {
      closeModal(modal);
    }
  });
});

// ===============================
// FORM HANDLING (Signup / Login)
// ===============================

// Signup
// Signup
document.querySelector(".signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = e.target[0].value;
  const email = e.target[1].value;
  const password = e.target[2].value;
  const confirmPassword = e.target[3].value;
  const collegeYear = e.target[4].value;

  if (password !== confirmPassword) {
    showPopup("Passwords do not match", "error");
    return;
  }

  try {
    const res = await fetch("https://openark2-0.onrender.com/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, collegeYear }),
    });

    const data = await res.json();
    showPopup(data.message || data.error, res.ok ? "success" : "error");

    if (res.ok) {
      // Save user info for later use
      localStorage.setItem("username", data.username || username);
      localStorage.setItem("email", data.email || email);
      localStorage.setItem("collegeYear", data.collegeYear || collegeYear);

      closeModal(signupModal);
      openModal(loginModal); // Go to login after signup
    }
  } catch (err) {
    console.error("Signup failed:", err);
    showPopup("Signup request failed", "error");
  }
});


// Login
document.querySelector(".login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target[0].value;
  const password = e.target[1].value;

  try {
    const res = await fetch("https://openark2-0.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    showPopup(data.message || data.error, res.ok ? "success" : "error");

    if (res.ok) {
      // Save JWT token in session storage
      sessionStorage.setItem("token", data.token);

      // Save user info (fallback to localStorage if API doesn’t send it)
      localStorage.setItem("username", data.username || localStorage.getItem("username") || "User");
      localStorage.setItem("email", data.email || email);
      localStorage.setItem("collegeYear", data.collegeYear || localStorage.getItem("collegeYear") || "N/A");

      closeModal(loginModal);
      window.location.href = "dashboard.html";
    }
  } catch (err) {
    console.error("Login failed:", err);
    showPopup("Login request failed", "error");
  }
});



// ===============================
// POPULATE INTRO SLIDESHOW
// ===============================
const bookTrack = document.getElementById("introBookTrack");
if (bookTrack && typeof books !== "undefined") {
  // First set
  books.forEach((book) => {
    const img = document.createElement("img");
    img.src = book.img;
    img.alt = book.title;
    img.className = "book";
    bookTrack.appendChild(img);
  });

  // Duplicate set for seamless loop
  books.forEach((book) => {
    const img = document.createElement("img");
    img.src = book.img;
    img.alt = book.title;
    img.className = "book";
    bookTrack.appendChild(img);
  });
}

// ===============================
// SHOW AVAILABLE BOOK COUNT
// ===============================
const bookCountElement = document.getElementById("bookCount");
if (bookCountElement && typeof books !== "undefined") {
  bookCountElement.textContent = `Available Books: ${books.length}`;
}


// ===============================
// CHECK LOGIN STATUS (optional)
// ===============================
(function checkAuth() {
  const token = sessionStorage.getItem("token");
  if (token) {
    console.log("✅ User already logged in, JWT found in sessionStorage");
  }
})();
