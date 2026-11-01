/* ==========================================================================
   AUTHENTICATION CORE & ROUTE PROTECTION
   ========================================================================== */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { notify } from "./notifications.js";

/**
 * Fetch user document profile from Firestore
 */
export async function getUserProfile(uid) {
  if (!uid || !db) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}

/**
 * Route protection guard
 * @param {Array<string>} allowedRoles - e.g. ['student'] or ['admin']
 * @param {Function} onAuthenticated - Callback with (user, profile)
 */
export function requireAuth(allowedRoles = [], onAuthenticated = null) {
  if (!auth) {
    console.error("Firebase Auth not initialized.");
    return;
  }

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // User is not logged in
      const isAdminRoute = window.location.pathname.includes("admin");
      window.location.href = isAdminRoute ? "admin-login.html" : "student-login.html";
      return;
    }

    try {
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        if (allowedRoles.includes("student")) {
          notify.warning("Please complete your student profile before accessing the dashboard.");
          setTimeout(() => {
            window.location.href = "student-login.html?completeProfile=1";
          }, 600);
        } else {
          notify.error("Your account profile is missing. Please contact an administrator.");
          await signOut(auth);
          window.location.href = "student-login.html";
        }
        return;
      }

      const role = profile.role;
      if (role !== "student" && role !== "admin") {
        notify.error("Your account has an invalid role. Please contact an administrator.");
        await signOut(auth);
        window.location.href = "student-login.html";
        return;
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        // Unauthorized role access
        notify.error("Access denied: You do not have permission for this portal.");
        if (role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "student-dashboard.html";
        }
        return;
      }

      // If a student is accessing the student dashboard, require mandatory profile fields.
      if (allowedRoles.includes("student")) {
        const isProfileIncomplete = !profile ||
          !profile.usn ||
          profile.usn === "PENDING" ||
          !profile.roomNumber ||
          profile.roomNumber === "N/A";

        if (isProfileIncomplete) {
          notify.warning("Please complete your student profile before accessing the dashboard.");
          setTimeout(() => {
            window.location.href = "student-login.html?completeProfile=1";
          }, 600);
          return;
        }
      }

      if (typeof onAuthenticated === "function") {
        onAuthenticated(user, profile);
      }
    } catch (err) {
      console.error("Auth guard error:", err);
      notify.error("Authentication check failed. Please log in again.");
    }
  });

  return unsubscribe;
}

/**
 * Global Log out function
 */
export async function logoutUser(redirectTo = null) {
  try {
    const currentIsAdmin = window.location.pathname.includes("admin");
    await signOut(auth);
    notify.info("Logged out successfully.");
    const target = redirectTo || (currentIsAdmin ? "admin-login.html" : "student-login.html");
    setTimeout(() => {
      window.location.href = target;
    }, 400);
  } catch (error) {
    console.error("Sign out error:", error);
    notify.error("Error signing out: " + error.message);
  }
}
