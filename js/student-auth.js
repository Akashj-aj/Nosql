/* ==========================================================================
   STUDENT AUTHENTICATION LOGIC (LOGIN, SIGNUP, GOOGLE AUTH, PASSWORD RESET)
   ========================================================================== */

import { auth, db, isFirebaseConfigured } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { notify } from "./notifications.js";
import { validateEmail, checkPasswordStrength } from "./utils.js";
import { getUserProfile } from "./auth.js";

let pendingGoogleUser = null;

// DOM Ready initialization
document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();
  setupPasswordStrengthMeter();

  const signupForm = document.getElementById("student-signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", handleStudentSignup);
  }

  const loginForm = document.getElementById("student-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleStudentLogin);
  }

  const googleBtn = document.getElementById("btn-google-auth");
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleAuth);
  }

  const forgotPwForm = document.getElementById("forgot-password-form");
  if (forgotPwForm) {
    forgotPwForm.addEventListener("submit", handleForgotPassword);
  }

  // Profile completion form for Google Auth users
  const googleProfileForm = document.getElementById("google-profile-form");
  if (googleProfileForm) {
    googleProfileForm.addEventListener("submit", handleGoogleProfileCompletion);
  }

  // Check if user is already signed in with an incomplete profile (e.g. redirected from dashboard)
  checkIncompleteProfileState();
});

/**
 * Check if the currently signed-in user has an incomplete profile on student-login.html
 */
function checkIncompleteProfileState() {
  if (!auth) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const profile = await getUserProfile(user.uid);
      const isIncomplete = !profile ||
        !profile.usn ||
        profile.usn === "PENDING" ||
        !profile.roomNumber ||
        profile.roomNumber === "N/A";

      if (isIncomplete) {
        pendingGoogleUser = user;
        const modal = document.getElementById("google-profile-modal");
        if (modal) {
          const nameInput = document.getElementById("google-modal-name");
          if (nameInput) nameInput.value = user.displayName || "";
          modal.classList.add("active");
          notify.info("Please provide your USN and room number to complete your profile.");
        }
      }
    } catch (err) {
      console.error("Profile check error:", err);
    }
  });
}

/**
 * Setup password visibility toggle buttons
 */
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
 * Setup live password strength meter on signup
 */
function setupPasswordStrengthMeter() {
  const pwInput = document.getElementById("signup-password");
  const meterWrap = document.getElementById("strength-meter-wrap");
  const strengthLabel = document.getElementById("strength-label-text");

  if (!pwInput || !meterWrap) return;

  pwInput.addEventListener("input", () => {
    const val = pwInput.value;
    if (!val) {
      meterWrap.className = "strength-meter-wrap";
      if (strengthLabel) strengthLabel.textContent = "Enter password";
      return;
    }

    const { label, class: strengthClass } = checkPasswordStrength(val);
    meterWrap.className = `strength-meter-wrap ${strengthClass}`;
    if (strengthLabel) strengthLabel.textContent = `Strength: ${label}`;
  });
}

/**
 * Handle Student Signup Form Submission
 * Uses dedicated usn_index collection for atomic USN uniqueness reservation with cleanup
 */
async function handleStudentSignup(e) {
  e.preventDefault();

  if (!isFirebaseConfigured()) {
    notify.error("Please configure your Firebase credentials first.");
    return;
  }

  const nameInput = document.getElementById("signup-name");
  const usnInput = document.getElementById("signup-usn");
  const emailInput = document.getElementById("signup-email");
  const roomInput = document.getElementById("signup-room");
  const pwInput = document.getElementById("signup-password");
  const confirmPwInput = document.getElementById("signup-confirm-password");
  const submitBtn = document.getElementById("btn-signup-submit");

  const name = nameInput.value.trim();
  const cleanUsn = usnInput.value.trim().toUpperCase();
  const email = emailInput.value.trim();
  const roomNumber = roomInput.value.trim();
  const password = pwInput.value;
  const confirmPassword = confirmPwInput.value;

  // Form Validation
  if (!name || !cleanUsn || !email || !roomNumber || !password || !confirmPassword) {
    notify.error("Please fill in all mandatory fields.");
    return;
  }

  if (!validateEmail(email)) {
    notify.error("Please enter a valid email address.");
    emailInput.focus();
    return;
  }

  if (password.length < 6) {
    notify.error("Password must be at least 6 characters long.");
    pwInput.focus();
    return;
  }

  if (password !== confirmPassword) {
    notify.error("Passwords do not match.");
    confirmPwInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Creating Account...`;

  let createdUser = null;
  let firestoreRegistrationCommitted = false;
  const cleanupIssues = [];

  try {
    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    createdUser = userCredential.user;

    // 2. Reserve USN with a create-only Firestore write.
    const usnDocRef = doc(db, "usn_index", cleanUsn);
    const userDocRef = doc(db, "users", createdUser.uid);
    const userData = {
      uid: createdUser.uid,
      name: name,
      email: email,
      usn: cleanUsn,
      roomNumber: roomNumber,
      role: "student",
      createdAt: serverTimestamp()
    };
    const registrationBatch = writeBatch(db);
    registrationBatch.set(usnDocRef, {
      uid: createdUser.uid,
      createdAt: serverTimestamp()
    });
    registrationBatch.set(userDocRef, userData);
    await registrationBatch.commit();
    firestoreRegistrationCommitted = true;

    // Update Auth display name after the atomic Firestore registration.
    try {
      await updateProfile(createdUser, { displayName: name });
    } catch (profileError) {
      console.error("Could not update Auth display name after registration:", profileError);
    }

    // Send Email Verification
    try {
      await sendEmailVerification(createdUser);
    } catch (e) {
      console.warn("Email verification note:", e);
    }

    notify.success("Registration successful! Redirecting to student dashboard...");
    setTimeout(() => {
      window.location.href = "student-dashboard.html";
    }, 1000);

  } catch (error) {
    console.error("Signup error:", error);

    if (createdUser && !firestoreRegistrationCommitted) {
      try {
        await createdUser.delete();
      } catch (authDelErr) {
        console.error("Could not roll back auth account:", authDelErr);
        cleanupIssues.push("the incomplete account could not be removed");
      }
    }

    let msg = error.message;
    if (error.code === "permission-denied") {
      msg = "This USN is already registered or the registration could not be authorized.";
    }
    if (error.code === "auth/email-already-in-use") {
      msg = "This email is already in use. Please log in instead.";
    } else if (error.code === "auth/invalid-email") {
      msg = "The email address is poorly formatted.";
    } else if (error.code === "auth/weak-password") {
      msg = "Password is too weak. Please use a stronger password.";
    }
    notify.error(cleanupIssues.length ? `${msg} Also, ${cleanupIssues.join(" and ")}.` : msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Create Student Account`;
  }
}

/**
 * Handle Student Login Form Submission
 */
async function handleStudentLogin(e) {
  e.preventDefault();

  if (!isFirebaseConfigured()) {
    notify.error("Please configure your Firebase credentials first.");
    return;
  }

  const emailInput = document.getElementById("login-email");
  const pwInput = document.getElementById("login-password");
  const submitBtn = document.getElementById("btn-login-submit");

  const email = emailInput.value.trim();
  const password = pwInput.value;

  if (!email || !password) {
    notify.error("Please enter both email and password.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Signing In...`;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(cred.user.uid);

    if (profile && profile.role === "admin") {
      notify.info("Admin account detected. Redirecting to Admin Portal...");
      setTimeout(() => {
        window.location.href = "admin-dashboard.html";
      }, 1000);
      return;
    }

    // Check if student profile is incomplete
    const isIncomplete = !profile ||
      !profile.usn ||
      profile.usn === "PENDING" ||
      !profile.roomNumber ||
      profile.roomNumber === "N/A";

    if (isIncomplete) {
      pendingGoogleUser = cred.user;
      const modal = document.getElementById("google-profile-modal");
      if (modal) {
        const nameInput = document.getElementById("google-modal-name");
        if (nameInput) nameInput.value = cred.user.displayName || "";
        modal.classList.add("active");
        notify.info("Please complete your student profile to continue.");
      }
      return;
    }

    notify.success("Login successful! Loading your dashboard...");
    setTimeout(() => {
      window.location.href = "student-dashboard.html";
    }, 800);

  } catch (error) {
    console.error("Login error:", error);
    let msg = "Invalid email or password.";
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      msg = "Invalid email or password. Please verify your credentials.";
    } else if (error.code === "auth/too-many-requests") {
      msg = "Too many failed attempts. Please try again later or reset your password.";
    }
    notify.error(msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Sign In`;
  }
}

/**
 * Handle Google Authentication
 */
async function handleGoogleAuth() {
  if (!isFirebaseConfigured()) {
    notify.error("Please configure your Firebase credentials first.");
    return;
  }

  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const profile = await getUserProfile(user.uid);

    // If profile exists and is complete
    if (profile && profile.usn && profile.usn !== "PENDING" && profile.roomNumber && profile.roomNumber !== "N/A") {
      if (profile.role === "admin") {
        notify.info("Redirecting to Admin Dashboard...");
        window.location.href = "admin-dashboard.html";
      } else {
        notify.success(`Welcome back, ${profile.name || user.displayName}!`);
        window.location.href = "student-dashboard.html";
      }
      return;
    }

    // New Google student or incomplete profile: Must complete USN and Room Number
    pendingGoogleUser = user;
    const modal = document.getElementById("google-profile-modal");
    if (modal) {
      const nameInput = document.getElementById("google-modal-name");
      if (nameInput) nameInput.value = user.displayName || "";
      modal.classList.add("active");
      notify.info("Please enter your USN and Room Number to complete your account.");
    }

  } catch (error) {
    console.error("Google Auth error:", error);
    if (error.code !== "auth/popup-closed-by-user") {
      notify.error("Google sign-in failed: " + error.message);
    }
  }
}

/**
 * Handle Google Profile Completion Submission
 */
async function handleGoogleProfileCompletion(e) {
  e.preventDefault();
  if (!pendingGoogleUser) return;

  const usnInput = document.getElementById("google-modal-usn");
  const roomInput = document.getElementById("google-modal-room");
  const submitBtn = document.getElementById("btn-google-profile-submit");

  const cleanUsn = usnInput.value.trim().toUpperCase();
  const roomNumber = roomInput.value.trim();

  if (!cleanUsn || !roomNumber) {
    notify.error("Please provide your USN and Room Number.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

  const cleanupIssues = [];

  try {
    // Reserve the USN and create the profile atomically.
    const usnDocRef = doc(db, "usn_index", cleanUsn);
    const profileData = {
      uid: pendingGoogleUser.uid,
      name: pendingGoogleUser.displayName || "Student",
      email: pendingGoogleUser.email,
      usn: cleanUsn,
      roomNumber: roomNumber,
      role: "student",
      createdAt: serverTimestamp()
    };
    const profileBatch = writeBatch(db);
    profileBatch.set(usnDocRef, {
      uid: pendingGoogleUser.uid,
      createdAt: serverTimestamp()
    });
    profileBatch.set(doc(db, "users", pendingGoogleUser.uid), profileData);
    await profileBatch.commit();

    notify.success("Profile completed! Loading your dashboard...");
    setTimeout(() => {
      window.location.href = "student-dashboard.html";
    }, 800);
  } catch (err) {
    console.error("Profile save error:", err);

    const cleanupMessage = cleanupIssues.length ? ` Also, ${cleanupIssues.join(" and ")}.` : "";
    const message = err.code === "permission-denied"
      ? "This USN is already registered or the profile could not be authorized."
      : err.message;
    notify.error("Failed to complete profile: " + message + cleanupMessage);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Save and Continue`;
  }
}

/**
 * Handle Forgot Password Reset
 */
async function handleForgotPassword(e) {
  e.preventDefault();
  const emailInput = document.getElementById("forgot-email");
  const submitBtn = document.getElementById("btn-forgot-submit");
  const email = emailInput.value.trim();

  if (!email || !validateEmail(email)) {
    notify.error("Please enter a valid email address.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Sending link...`;

  try {
    await sendPasswordResetEmail(auth, email);
    notify.success("Password reset link sent! Check your inbox.");
    
    // Close modal if open
    const modal = document.getElementById("forgot-password-modal");
    if (modal) modal.classList.remove("active");
  } catch (err) {
    console.error("Password reset error:", err);
    notify.error("Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Send Reset Link`;
  }
}
