/* ==========================================================================
   ADMIN & WARDEN AUTHENTICATION LOGIC
   ========================================================================== */

import { auth, db, isFirebaseConfigured } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { notify } from "./notifications.js";
import { validateEmail } from "./utils.js";
import { getUserProfile } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();

  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleAdminLogin);
  }

  const forgotForm = document.getElementById("admin-forgot-password-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", handleAdminForgotPassword);
  }
});

function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll(".password-toggle-btn");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      } else {
        input.type = "password";
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    });
  });
}

/**
 * Handle Admin Login
 */
async function handleAdminLogin(e) {
  e.preventDefault();

  if (!isFirebaseConfigured()) {
    notify.error("Please configure your Firebase credentials first.");
    return;
  }

  const emailInput = document.getElementById("admin-email");
  const pwInput = document.getElementById("admin-password");
  const submitBtn = document.getElementById("btn-admin-login-submit");

  const email = emailInput.value.trim();
  const password = pwInput.value;

  if (!email || !password) {
    notify.error("Please enter admin credentials.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Verifying Credentials...`;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(cred.user.uid);

    // Strict role verification: role MUST be "admin"
    if (!profile || profile.role !== "admin") {
      // Force sign-out immediately to prevent unauthorized session
      await signOut(auth);
      notify.error("Access Denied: This account does not possess administrator or warden privileges.");
      return;
    }

    notify.success("Admin access granted. Loading Warden Console...");
    setTimeout(() => {
      window.location.href = "admin-dashboard.html";
    }, 800);

  } catch (error) {
    console.error("Admin login error:", error);
    let msg = "Invalid admin credentials.";
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      msg = "Authentication failed. Check your admin email and password.";
    } else if (error.code === "auth/too-many-requests") {
      msg = "Too many attempts. Account locked temporarily for security.";
    }
    notify.error(msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Access Admin Portal`;
  }
}

/**
 * Handle Admin Password Reset
 */
async function handleAdminForgotPassword(e) {
  e.preventDefault();
  const emailInput = document.getElementById("admin-forgot-email");
  const submitBtn = document.getElementById("btn-admin-forgot-submit");
  const email = emailInput.value.trim();

  if (!email || !validateEmail(email)) {
    notify.error("Please enter a valid administrative email.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Sending...`;

  try {
    await sendPasswordResetEmail(auth, email);
    notify.success("Admin password reset link sent to your registered email.");
    const modal = document.getElementById("admin-forgot-modal");
    if (modal) modal.classList.remove("active");
  } catch (err) {
    notify.error("Failed to send reset link: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Send Reset Link`;
  }
}

