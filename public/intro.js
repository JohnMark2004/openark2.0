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


// ✅ Initialize socket connection (only needed if comments/real-time features added later)
// const socket = io(API_URL); // You might not need this if intro page has no real-time elements

// --- Typewriter Effect ---
const input = document.getElementById("searchInput");
const phrases = ["Filipiniana","General Education","Accountancy","Computer Studies","Criminology","Education","Engineering","Commerce","Maritime","Mass Communication","Political Science", "Psychology", "Aviation", "Fiction", "Reference", "Senior High School"];
let phraseIndex = 0, charIndex = 0, deleting = false;

function typeAnimation() {
  // Guard against null input if element doesn't exist
  if (!input) return;
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
// Start animation only if input exists
if (input) {
    typeAnimation();
}


// ===============================
// MODAL LOGIC (Login / Signup)
// ===============================
const getStartedBtn = document.querySelector(".btn-login");
const loginModal = document.getElementById("loginModal");
const signupModal = document.getElementById("signupModal");

// ✅ ADD THESE
const otpModal = document.getElementById("otpModal");
const otpBackToLoginLink = document.getElementById("otpBackToLoginLink");
let userEmailForVerification = ""; // To store email between steps

const forgotPasswordModal = document.getElementById("forgotPasswordModal");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const backToLoginLink = document.getElementById("backToLoginLink");

// Check if modals exist before adding listeners
if (loginModal && signupModal) {
    const toSignupLink = loginModal.querySelector(".signup-link a");
    const toLoginLink = signupModal.querySelector(".login-link a");

    function openModal(modal) {
        if (modal) modal.classList.remove("hidden");
    }

    function closeModal(modal) {
        if (modal) modal.classList.add("hidden");
    }

    if (getStartedBtn) {
        getStartedBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openModal(loginModal);
        });
    }

    if (toSignupLink) {
        toSignupLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal(loginModal);
            openModal(signupModal);
        });
    }

    if (toLoginLink) {
        toLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal(signupModal);
            openModal(loginModal);
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal(loginModal);
            openModal(forgotPasswordModal);
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal(forgotPasswordModal);
            openModal(loginModal);
        });
    }

    // ✅ ADD THIS
    if (otpBackToLoginLink) {
        otpBackToLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal(otpModal);
            openModal(loginModal);
        });
    }

    // Close modal when clicking outside container
    [loginModal, signupModal, forgotPasswordModal, otpModal].forEach((modal) =>{
        if (modal) {
            modal.addEventListener("click", (e) => {
                const container = modal.querySelector(".login-container, .signup-container");
                // Check if container exists and click was outside
                if (container && !container.contains(e.target)) {
                    closeModal(modal);
                }
            });
        }
    });
}


// ===============================
// FORM HANDLING (Signup / Login)
// ===============================

// SIGNUP FORM HANDLER
const signupForm = document.querySelector(".signup-form");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = e.target[0].value.trim();
        const email = e.target[1].value.trim();
        const password = e.target[2].value;
        const confirmPassword = e.target[3].value;
        const collegeYear = e.target[4].value;

// ✅ NEW: Student Email validation
// ✅ NEW: Gmail Email validation
        const requiredDomain = "@gmail.com";
        if (!email.toLowerCase().endsWith(requiredDomain)) {
            showPopup("❌ Signups are only for @gmail.com accounts", "error");
            return;
        }
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

        // Show "Processing" toast right away
        showPopup("Submitting signup request...", "info"); // Changed message slightly

        try {
            const res = await fetch(`${API_URL}/api/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, collegeYear }),
            });

            const data = await res.json();
            console.log("Signup response:", data);

if (res.ok) {
                // ✅ NEW: Show OTP message
                showPopup(data.message || "Signup successful! Check your email.", "success");

                // Store email for verification step
                userEmailForVerification = email; 
                
                // Update and open OTP modal
                document.getElementById("otpEmailDisplay").textContent = email;
                closeModal(signupModal);
                openModal(otpModal);

            } else {
                // Server returned an error
                showPopup(data.error || "Signup failed", "error");
            }
        } catch (err) {
            console.error("Signup failed:", err);
            showPopup("Signup request failed. Please try again later.", "error");
        }
    });
}


// Login FORM HANDLER
const loginForm = document.querySelector(".login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = e.target[0].value.toLowerCase();
        const password = e.target[1].value;

// ✅ NEW: Gmail validation
        const requiredDomain = "@gmail.com";
        if (!email.endsWith(requiredDomain)) {
            showPopup("❌ Please use a @gmail.com email to log in", "error");
            return;
        }

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

                const userId = data._id || data.id || data.userId || data.user?._id || "";
                localStorage.setItem("userId", userId);

                // ✅ ADDED THIS LINE
                sessionStorage.setItem("justLoggedIn", "true"); // Signal for welcome message

                closeModal(loginModal);

                // No need to emit 'registerUser' here unless dashboard needs immediate confirmation
                // if (userId && data.role !== "admin" && typeof io !== 'undefined') {
                //   socket.emit("registerUser", userId);
                //   console.log(`🟢 ${data.role} registered for real-time updates:`, userId);
                // }

                // Redirect by role
                if (data.role === "admin") {
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
}

// ✅ ADD THIS ENTIRE NEW BLOCK
// OTP VERIFICATION FORM HANDLER
const otpForm = document.querySelector(".otp-form");
if (otpForm) {
    otpForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const otp = document.getElementById("otpInput").value;
        const btn = document.getElementById("verifyOtpBtn");
        
        if (!userEmailForVerification) {
            showPopup("Error: Email not found. Please sign up again.", "error");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Verifying...";

        try {
            const res = await fetch(`${API_URL}/api/signup/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userEmailForVerification, otp }),
            });

            const data = await res.json();

            if (res.ok) {
                showPopup(data.message, "success");
                userEmailForVerification = ""; // Clear temp email
                
                // Switch to login modal
                setTimeout(() => {
                    closeModal(otpModal);
                    openModal(loginModal);
                }, 2000);
            } else {
                showPopup(data.error || "Verification failed", "error");
            }

        } catch (err) {
            console.error("OTP verification error:", err);
            showPopup("An error occurred. Please try again.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Verify Account";
        }
    });
}

// ✅ ADD THIS ENTIRE BLOCK
// FORGOT PASSWORD FORM HANDLER
const forgotPasswordForm = document.querySelector(".forgot-password-form");
if (forgotPasswordForm) {
forgotPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgotEmail").value.toLowerCase(); // ✅ Make lowercase

// ✅ NEW: Gmail validation
        const requiredDomain = "@gmail.com";
        if (!email.endsWith(requiredDomain)) {
            showPopup("❌ Please use a @gmail.com email", "error");
            return;
        }
        
        const btn = document.getElementById("sendResetLinkBtn");
        btn.disabled = true;
        btn.textContent = "Sending...";

        try {
            const res = await fetch(`${API_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            
            // We always show a generic success message for security
            // to avoid confirming if an email exists or not.
            const data = await res.json();
            showPopup(data.message || "If a user with that email exists, a reset link has been sent.", "info");

            setTimeout(() => {
                closeModal(forgotPasswordModal);
                openModal(loginModal);
            }, 2500);

        } catch (err) {
            console.error("Forgot password error:", err);
            showPopup("An error occurred. Please try again.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Send Reset Link";
        }
    });
}

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
// POPULATE INTRO SLIDESHOW & COUNT
// ===============================
async function loadIntroBooks() {
  try {
    const res = await fetch(`${API_URL}/api/books`);
    if (!res.ok) throw new Error("Failed to fetch books");
    const books = await res.json();

    const track = document.getElementById("introBookTrack");
    const countEl = document.getElementById("bookCount");
    if (!track) return; // Exit if track element not found

    track.innerHTML = ""; // Clear previous content

    if (!Array.isArray(books) || books.length === 0) {
      track.innerHTML = `<p class="no-books">No books available yet.</p>`;
      if (countEl) countEl.textContent = "Available Books: 0";
      return;
    }

    // Show each book only once
    books.forEach((book) => {
      const img = document.createElement("img");
      img.src = book.img || "img/default-book.png";
      img.alt = book.title || "Untitled";
      img.className = "book";
      img.title = book.title || "Unknown";
      track.appendChild(img);
    });

    // Update count
    if (countEl) countEl.textContent = `Available Books: ${books.length}`;

// Continuous loop animation (if track has content)
    if (books.length > 0) {
        // Clone track content for seamless loop
        const originalHTML = track.innerHTML; // Store the original books
        const trackWidth = track.scrollWidth;
        const clones = Math.ceil(window.innerWidth / trackWidth) + 1; // Calculate clones needed
        
        for (let i = 0; i < clones; i++) {
            track.innerHTML += originalHTML; // Append only the *original* set
        }

        // Apply styles needed for the CSS animation
        track.style.display = "flex";
        track.style.gap = "20px";
    }

  } catch (err) {
    console.error("❌ Error loading intro books:", err);
    // Optionally display an error message to the user in the track element
    const track = document.getElementById("introBookTrack");
    if (track) track.innerHTML = `<p class="no-books error">Could not load books.</p>`;
  }
}


// ===============================
// 📈 Load real report stats (with animation)
// ===============================
// ✅ Removed duplicate loadStats function
// ✅ Renamed function to avoid conflict if used elsewhere
// ✅ Added checks for element existence
async function loadIntroStats() {
    // These elements might not exist in intro.html, so check first
    const booksStat = document.getElementById("booksStat");
    const usersStat = document.getElementById("usersStat");

    // Only fetch if elements exist
    if (!booksStat && !usersStat) {
        console.log("Stats elements not found on this page.");
        return;
    }

    try {
        // ✅ Use the correct endpoint
        const res = await fetch(`${API_URL}/api/report-summary`);
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();

        if (booksStat) animateValue(booksStat, 0, data.totalBooks || 0, 2000);
        if (usersStat) animateValue(usersStat, 0, data.totalUsers || 0, 2000);
    } catch (err) {
        console.error("❌ Error loading stats:", err);
        // Display fallback text if elements exist but fetch failed
        if (booksStat) booksStat.textContent = '-';
        if (usersStat) usersStat.textContent = '-';
    }
}


function animateValue(element, start, end, duration) {
  let startTime = null;
  function step(currentTime) {
    if (!startTime) startTime = currentTime;
    const progress = Math.min((currentTime - startTime) / duration, 1);
    element.textContent = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
        requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}


// ===============================
// CHECK LOGIN STATUS (optional)
// ===============================
(function checkAuth() {
    const token = sessionStorage.getItem("token");
    if (token) {
        console.log("User already logged in, JWT found in sessionStorage");
        // Optional: Redirect if already logged in?
        // const role = localStorage.getItem("role");
        // if (role === 'admin') window.location.href = 'admin.html';
        // else window.location.href = 'dashboard.html';
    }
})();

// ===============================
// ✅ SINGLE DOMContentLoaded Listener
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    loadIntroBooks();
    loadIntroStats(); // Use the corrected function name
});