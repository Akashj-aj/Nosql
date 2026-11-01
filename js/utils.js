/* ==========================================================================
   UTILITY FUNCTIONS
   ========================================================================== */

/**
 * Generate a unique, professional complaint identifier
 * Example: CMP-2026-X8F2
 */
export function generateComplaintId() {
  const currentYear = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous 0, O, 1, I
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CMP-${currentYear}-${randomPart}`;
}

/**
 * Format Firestore timestamp or Date object into human-readable string
 */
export function formatDate(timestamp) {
  if (!timestamp) return "N/A";

  let date;
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "string" || typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

/**
 * Format relative time (e.g. 5m ago, 2h ago)
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  let date;
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

/**
 * Return status badge HTML
 */
export function getStatusBadgeHtml(status) {
  const normalized = (status || "Pending").toLowerCase().replace(/[\s-_]/g, "");
  let cssClass = "status-pending";
  let label = "Pending";

  if (normalized === "assigned") {
    cssClass = "status-assigned";
    label = "Assigned";
  } else if (normalized === "inprogress" || normalized === "in-progress") {
    cssClass = "status-inprogress";
    label = "In Progress";
  } else if (normalized === "resolved") {
    cssClass = "status-resolved";
    label = "Resolved";
  } else if (normalized === "rejected") {
    cssClass = "status-rejected";
    label = "Rejected";
  }

  return `<span class="status-badge ${cssClass}">${label}</span>`;
}

/**
 * Sanitize HTML strings to prevent XSS
 */
export function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validate email address format
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Calculate password strength score & label
 */
export function checkPasswordStrength(password) {
  let score = 0;
  if (!password) {
    return { score: 0, label: "Empty", class: "strength-empty" };
  }

  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { score: 1, label: "Weak", class: "strength-weak" };
  } else if (score === 2) {
    return { score: 2, label: "Fair", class: "strength-fair" };
  } else if (score === 3 || score === 4) {
    return { score: 3, label: "Good", class: "strength-good" };
  } else {
    return { score: 4, label: "Strong", class: "strength-strong" };
  }
}

/**
 * Standard complaint categories
 */
export const COMPLAINT_CATEGORIES = [
  "Electrical",
  "Plumbing and Water",
  "Cleaning and Hygiene",
  "Wi-Fi and Internet",
  "Furniture",
  "Food",
  "Other"
];

/**
 * Standard complaint statuses
 */
export const COMPLAINT_STATUSES = [
  "Pending",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected"
];

