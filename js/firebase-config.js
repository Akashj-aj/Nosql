/* ==========================================================================
   FIREBASE CONFIGURATION AND INITIALIZATION
   Hostel Complaint Management System
   ========================================================================== */

// Using Firebase v10 Modular SDK via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * Replace the values below with your actual Firebase Project Configuration.
 * You can find these in Firebase Console:
 * Project Settings -> General -> Your Apps -> Web App (</>) -> Firebase SDK snippet -> Config.
 */
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAUszi3HhD8vGVzFmp7eCueKOgwOKgCjX0",
  authDomain: "studio-2138263611-862f5.firebaseapp.com",
  projectId: "studio-2138263611-862f5",
  storageBucket: "studio-2138263611-862f5.firebasestorage.app",
  messagingSenderId: "395633289515",
  appId: "1:395633289515:web:4d9aeec6976e040066fd6e"
};

// Check for dynamic overrides from window or localStorage for testing/deployment flexibility
let activeConfig = defaultFirebaseConfig;

if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.apiKey) {
  activeConfig = window.__FIREBASE_CONFIG__;
} else {
  try {
    const savedConfig = localStorage.getItem("HOSTEL_FIREBASE_CONFIG");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (parsed.apiKey && parsed.apiKey !== "YOUR_API_KEY") {
        activeConfig = parsed;
      }
    }
  } catch (error) {
    console.warn("Could not read stored Firebase config", error);
  }
}

// Check if credentials are placeholders
export function isFirebaseConfigured() {
  return activeConfig.apiKey && 
         activeConfig.apiKey !== "YOUR_API_KEY" && 
         activeConfig.projectId !== "YOUR_PROJECT_ID";
}

// Initialize Firebase
let app, auth, db;

try {
  app = initializeApp(activeConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export { app, auth, db, activeConfig };

// If not configured, inject an informative banner at the top
if (!isFirebaseConfigured()) {
  window.addEventListener("DOMContentLoaded", () => {
    // Avoid duplicate banners
    if (document.getElementById("firebase-setup-banner")) return;
    
    const banner = document.createElement("div");
    banner.id = "firebase-setup-banner";
    banner.style.cssText = `
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #003032;
      color: #DEEC51;
      padding: 10px 16px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #DEEC51;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:16px;">⚙️</span>
        <span><strong>Firebase Setup Required:</strong> Connect your Firebase project by entering your credentials or editing <code>js/firebase-config.js</code>.</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="btn-quick-config" style="background:#DEEC51; color:#050711; border:none; padding:4px 10px; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">Quick Connect</button>
        <button id="btn-dismiss-config" style="background:transparent; color:#FFF; border:1px solid #999; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">✕</button>
      </div>
    `;

    document.body.prepend(banner);

    document.getElementById("btn-quick-config")?.addEventListener("click", () => {
      const jsonStr = prompt(
        "Paste your Firebase Config JSON (from Firebase Console -> Project Settings -> SDK Snippet):\n\nExample:\n{\n  \"apiKey\": \"AIza...\",\n  \"authDomain\": \"...\",\n  \"projectId\": \"...\",\n  \"appId\": \"...\"\n}"
      );
      if (jsonStr) {
        try {
          const config = JSON.parse(jsonStr.trim());
          if (config.apiKey && config.projectId) {
            localStorage.setItem("HOSTEL_FIREBASE_CONFIG", JSON.stringify(config));
            alert("Firebase configuration saved! Reloading application...");
            window.location.reload();
          } else {
            alert("Invalid config: apiKey and projectId are required.");
          }
        } catch (err) {
          alert("Error parsing JSON config: " + err.message);
        }
      }
    });

    document.getElementById("btn-dismiss-config")?.addEventListener("click", () => {
      banner.style.display = "none";
    });
  });
}
