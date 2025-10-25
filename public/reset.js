document.addEventListener("DOMContentLoaded", () => {
  // --- Global elements ---
  const resetForm = document.querySelector(".reset-password-form");
  const setNewPasswordBtn = document.getElementById("setNewPasswordBtn");
  const passwordInput = document.getElementById("resetPassword");
  const confirmPasswordInput = document.getElementById("resetConfirmPassword");
  const messageEl = document.getElementById("resetMessage");
  const backToLoginContainer = document.getElementById("backToLoginContainer");

  // --- API URL (same as intro.js) ---
  const API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://openark2-0.onrender.com";

  // --- Popup Function (same as intro.js) ---
  function showPopup(message, type = "success") {
    const popup = document.getElementById("popup");
    if (!popup) return;
    popup.textContent = message;
    popup.className = `popup ${type} show`;
    setTimeout(() => popup.classList.remove("show"), 3000);
  }

  // --- Get token from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    messageEl.textContent = "Invalid or missing reset token.";
    messageEl.style.color = "var(--maroon)";
    setNewPasswordBtn.disabled = true;
  }

  // --- Form submission ---
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token) return;

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // --- Validation (same as signup) ---
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
    // --- End Validation ---

    setNewPasswordBtn.disabled = true;
    setNewPasswordBtn.textContent = "Resetting...";

    try {
      const res = await fetch(`${API_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        showPopup(data.message, "success");
        messageEl.textContent = "Password reset successfully!";
        messageEl.style.color = "#0b6623"; // Success green
        resetForm.reset();
        // Hide form fields and button, show "Back to Login"
        passwordInput.style.display = "none";
        confirmPasswordInput.style.display = "none";
        setNewPasswordBtn.style.display = "none";
        backToLoginContainer.style.display = "block";
      } else {
        // Show server error (e.g., "token expired")
        showPopup(data.error || "Failed to reset password", "error");
        setNewPasswordBtn.disabled = false;
        setNewPasswordBtn.textContent = "Set New Password";
      }
    } catch (err) {
      console.error("Reset password error:", err);
      showPopup("An error occurred. Please try again.", "error");
      setNewPasswordBtn.disabled = false;
      setNewPasswordBtn.textContent = "Set New Password";
    }
  });

  // --- Toggle Password Visibility ---
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("toggle-password")) {
      const inputId = e.target.dataset.target;
      const input = document.getElementById(inputId);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      e.target.src = isHidden
        ? "img/eye-password-show-svgrepo-com.svg"
        : "img/eye-password-hide-svgrepo-com.svg";
    }
  });
});