window.showPopup = function (message, type = "success") {
  const popup = document.getElementById("popup");
  popup.textContent = message;
  popup.className = `popup ${type} show`;

  setTimeout(() => {
    popup.classList.remove("show");
  }, 3000);
};

// API BASE URL
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://openark2-0.onrender.com";


// ✅ Initialize socket connection for real-time updates
const socket = io(API_URL);

// --- Typewriter Effect (placeholder only) ---
const input = document.getElementById("searchInput");
const phrases = ["Novels","Mangas","Comics","Textbooks","Magazines","Research Papers","Biographies","Science Fiction","Fantasy","Mystery","Romance"];
let phraseIndex = 0, charIndex = 0, deleting = false;

function typeAnimation() {
  const currentPhrase = phrases[phraseIndex];
  if (!deleting) {
    input.setAttribute("placeholder", currentPhrase.substring(0, charIndex + 1));
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

// ===============================
// SIGNUP FORM HANDLER
// ===============================
document.querySelector(".signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = e.target[0].value.trim();
  const email = e.target[1].value.trim();
  const password = e.target[2].value;
  const confirmPassword = e.target[3].value;
  const collegeYear = e.target[4].value;

  // Password validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

  if (password !== confirmPassword) {
    showPopup("❌ Passwords do not match", "error");
    return;
  }

  if (!passwordRegex.test(password)) {
    showPopup(
      "⚠️ Password must be at least 6 characters and include uppercase, lowercase, and a number.",
      "error"
    );
    return;
  }

  // 🚀 Show "Processing" toast right away
        setTimeout(() => {
        showPopup("Signup request submitted! Please wait for admin approval.", "info");
      }, 1500);

  try {
    const res = await fetch(`${API_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, collegeYear }),
    });

    const data = await res.json();
    console.log("Signup response:", data);

    if (res.ok) {
      // ✅ Success: show pending approval toasts
      showPopup("✅ Signup successful!", "success");

      setTimeout(() => {
        showPopup("Your account request is pending admin approval.", "info");
      }, 1500);

      // Save info (not logged in yet)
      localStorage.setItem("username", username);
      localStorage.setItem("email", email);
      localStorage.setItem("collegeYear", collegeYear);
      localStorage.setItem("role", "student");

      // Switch modals after short delay
      setTimeout(() => {
        closeModal(signupModal);
        openModal(loginModal);
      }, 3500);
    } else {
      // ❌ Server returned an error
      showPopup(data.error || "Signup failed", "error");
    }
  } catch (err) {
    console.error("Signup failed:", err);
    showPopup("Signup request failed. Please try again later.", "error");
  }
});

// Login
document.querySelector(".login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target[0].value;
  const password = e.target[1].value;

  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    showPopup(data.message || data.error, res.ok ? "success" : "error");

if (res.ok) {
  sessionStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role || "student");
  localStorage.setItem("username", data.username || "User");
  localStorage.setItem("email", data.email || email);
  localStorage.setItem("collegeYear", data.collegeYear || "N/A");
  localStorage.setItem("pfp", data.profilePic || "assets/default-pfp.png");

  // ✅ Always use the correct userId
  const userId = data._id || data.id || data.userId || data.user?._id || "";
  localStorage.setItem("userId", userId);

  closeModal(loginModal);

  // ✅ Register all roles except admin
  if (userId && data.role !== "admin") {
    socket.emit("registerUser", userId);
    console.log(`🟢 ${data.role} registered for real-time updates:`, userId);
  }

  // ✅ Redirect by role
  if (data.role === "admin") {
  sessionStorage.setItem("token", data.token);
  localStorage.setItem("role", "admin");
  localStorage.setItem("username", data.username);
  window.location.href = "admin.html";
  } else {
    window.location.href = "dashboard.html"; // librarians & students share dashboard
  }

    }
  } catch (err) {
    console.error("Login failed:", err);
    showPopup("Login request failed", "error");
  }
});

// Toggle show/hide password (using eye icons)
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("toggle-password")) {
    const inputId = e.target.dataset.target;
    const input = document.getElementById(inputId);
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    e.target.src = isHidden ? "img/eye-password-show-svgrepo-com.svg" : "img/eye-password-hide-svgrepo-com.svg";
  }
});
// ===============================
// POPULATE INTRO SLIDESHOW & COUNT (Auto-Scrolling Carousel with Adjustable Speed)
// ===============================
async function loadIntroBooks() {
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    const track = document.getElementById("introBookTrack");
    const countEl = document.getElementById("bookCount");
    if (!track) return;

    // Clear old content
    track.innerHTML = "";

    // If no books available
    if (!Array.isArray(books) || books.length === 0) {
      track.innerHTML = `<p class="no-books">No books available yet.</p>`;
      if (countEl) countEl.textContent = "Available Books: 0";
      return;
    }

    // ✅ Duplicate once for seamless infinite scroll
    const allBooks = [...books, ...books];

    allBooks.forEach((book) => {
      const img = document.createElement("img");
      img.src = book.img || "img/default-book.png";
      img.alt = book.title || "Untitled";
      img.className = "book";
      img.title = book.title || "Unknown";
      track.appendChild(img);
    });

    // ✅ Update count
    if (countEl) countEl.textContent = `Available Books: ${books.length}`;

    // ✅ Smooth continuous scroll animation
    let position = 0;
    const speed = 10; // 🔧 adjust this value (lower = slower, higher = faster)

    function animate() {
      position -= speed;
      if (Math.abs(position) >= track.scrollWidth / 2) {
        position = 0; // reset halfway for seamless loop
      }
      track.style.transform = `translateX(${position}px)`;
      requestAnimationFrame(animate);
    }

    // ✅ Style
    track.style.display = "flex";
    track.style.gap = "20px";
    track.style.transition = "none";
    track.style.willChange = "transform";
    track.style.overflow = "hidden";

    requestAnimationFrame(animate);
  } catch (err) {
    console.error("❌ Error loading intro books:", err);
  }
}

// ✅ Run on load
document.addEventListener("DOMContentLoaded", loadIntroBooks);

// ===============================
// CHECK LOGIN STATUS (optional)
// ===============================
(function checkAuth() {
const token = sessionStorage.getItem("token");
if (token) {
console.log("✅ User already logged in, JWT found in sessionStorage");
}
})();

// ✅ Real-time: Mark user inactive when leaving
window.addEventListener("beforeunload", () => {
  const userId = localStorage.getItem("userId");
  if (userId) socket.emit("userLoggedOut", userId);
});