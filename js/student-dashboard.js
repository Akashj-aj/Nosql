/* ==========================================================================
   STUDENT DASHBOARD CONTROLLER
   ========================================================================== */

import { requireAuth, logoutUser } from "./auth.js";
import {
  createComplaint,
  subscribeStudentComplaints,
  subscribeComplaintHistory,
  getComplaintById
} from "./complaints.js";
import { notify } from "./notifications.js";
import {
  formatDate,
  formatTimeAgo,
  getStatusBadgeHtml,
  sanitize,
  COMPLAINT_CATEGORIES
} from "./utils.js";

let currentUser = null;
let currentProfile = null;
let studentComplaints = [];
let unsubscribeComplaints = null;
let unsubscribeHistory = null;
let complaintDetailRequest = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Guard page for student role
  requireAuth(["student"], (user, profile) => {
    currentUser = user;
    currentProfile = profile;
    initStudentDashboard();
  });
});

function initStudentDashboard() {
  renderStudentInfo();
  setupEventListeners();
  populateCategoryDropdown();
  listenToComplaints();
}

/**
 * Display student profile info in header and sidebar
 */
function renderStudentInfo() {
  const nameDisplay = currentProfile?.name || currentUser.displayName || "Student";
  const usnDisplay = currentProfile?.usn || "N/A";
  const roomDisplay = currentProfile?.roomNumber || "N/A";

  const welcomeEl = document.getElementById("student-welcome-name");
  if (welcomeEl) welcomeEl.textContent = nameDisplay;

  const sidebarName = document.getElementById("sidebar-user-name");
  if (sidebarName) sidebarName.textContent = nameDisplay;

  const sidebarSub = document.getElementById("sidebar-user-usn");
  if (sidebarSub) sidebarSub.textContent = `${usnDisplay} | Room ${roomDisplay}`;

  // Pre-fill student room in complaint modal
  const roomField = document.getElementById("complaint-room");
  if (roomField && currentProfile?.roomNumber && currentProfile.roomNumber !== "N/A") {
    roomField.value = currentProfile.roomNumber;
  }
}

/**
 * Populate category dropdowns
 */
function populateCategoryDropdown() {
  const select = document.getElementById("complaint-category");
  const filterSelect = document.getElementById("filter-category");

  if (select) {
    select.innerHTML = '<option value="" disabled selected>Select Category</option>' +
      COMPLAINT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("");
  }

  if (filterSelect) {
    filterSelect.innerHTML = '<option value="all">All Categories</option>' +
      COMPLAINT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("");
  }
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
  // Logout
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => logoutUser("student-login.html"));
  }

  // Mobile menu toggle
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const sidebar = document.getElementById("app-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const sidebarClose = document.getElementById("sidebar-close");

  const toggleSidebar = () => {
    if (sidebar) sidebar.classList.toggle("open");
    if (sidebarOverlay) sidebarOverlay.classList.toggle("active");
  };

  if (mobileToggle) mobileToggle.addEventListener("click", toggleSidebar);
  if (sidebarClose) sidebarClose.addEventListener("click", toggleSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", toggleSidebar);

  // Section navigation
  const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
  const updateSectionNavigation = () => {
    const sectionId = window.location.hash === "#my-complaints-section"
      ? "my-complaints-section"
      : "dashboard-section";
    const section = document.getElementById(sectionId);
    const dashboardView = document.getElementById("dashboard-view");
    const complaintsView = document.getElementById("complaints-view");
    const showingComplaints = sectionId === "my-complaints-section";

    if (dashboardView) dashboardView.style.display = showingComplaints ? "none" : "";
    if (complaintsView) complaintsView.style.display = showingComplaints ? "" : "none";

    navItems.forEach(item => {
      item.classList.toggle("active", item.getAttribute("href") === `#${sectionId}`);
    });

    if (section && window.location.hash) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  navItems.forEach(item => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const targetHash = item.getAttribute("href");
      if (targetHash && window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        updateSectionNavigation();
      }
      if (sidebar?.classList.contains("open")) toggleSidebar();
    });
  });
  window.addEventListener("hashchange", updateSectionNavigation);
  updateSectionNavigation();

  // New Complaint Modal Open/Close
  const openModalBtn = document.getElementById("btn-open-complaint-modal");
  const modal = document.getElementById("new-complaint-modal");
  const closeModalBtns = document.querySelectorAll(".close-complaint-modal");

  if (openModalBtn && modal) {
    openModalBtn.addEventListener("click", () => {
      modal.classList.add("active");
    });
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (modal) modal.classList.remove("active");
    });
  });

  // Complaint Form Submit
  const complaintForm = document.getElementById("new-complaint-form");
  if (complaintForm) {
    complaintForm.addEventListener("submit", handleComplaintSubmit);
  }

  // Search & Filter listeners
  const searchInput = document.getElementById("search-complaints");
  const filterCategory = document.getElementById("filter-category");
  const filterStatus = document.getElementById("filter-status");

  if (searchInput) searchInput.addEventListener("input", filterAndRenderComplaints);
  if (filterCategory) filterCategory.addEventListener("change", filterAndRenderComplaints);
  if (filterStatus) filterStatus.addEventListener("change", filterAndRenderComplaints);

  // Close details modal
  const closeDetailBtns = document.querySelectorAll(".close-detail-modal");
  const detailModal = document.getElementById("complaint-detail-modal");
  closeDetailBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      complaintDetailRequest++;
      if (detailModal) detailModal.classList.remove("active");
      if (unsubscribeHistory) {
        unsubscribeHistory();
        unsubscribeHistory = null;
      }
    });
  });
}

/**
 * Handle new complaint submission
 */
async function handleComplaintSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById("complaint-title");
  const categoryInput = document.getElementById("complaint-category");
  const descInput = document.getElementById("complaint-desc");
  const blockInput = document.getElementById("complaint-block");
  const roomInput = document.getElementById("complaint-room");
  const submitBtn = document.getElementById("btn-submit-complaint");

  if (!titleInput || !categoryInput || !descInput || !blockInput || !roomInput || !submitBtn) {
    notify.error("Complaint form is unavailable.");
    return;
  }

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const description = descInput.value.trim();
  const hostelBlock = blockInput.value.trim();
  const roomNumber = roomInput.value.trim();

  if (!title || !category || !description || !roomNumber) {
    notify.error("Please fill in all required fields.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Registering Complaint...`;

  try {
    const res = await createComplaint({
      studentId: currentUser.uid,
      studentName: currentProfile.name,
      usn: currentProfile.usn,
      title,
      description,
      category,
      hostelBlock: hostelBlock || "Main Block",
      roomNumber
    });

    notify.success(`Complaint #${res.complaintId} submitted successfully!`);
    // Reset and close modal
    const form = document.getElementById("new-complaint-form");
    if (form) form.reset();
    const complaintModal = document.getElementById("new-complaint-modal");
    if (complaintModal) complaintModal.classList.remove("active");

  } catch (err) {
    console.error("Complaint registration error:", err);
    notify.error("Could not register complaint: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Submit Complaint`;
    }
  }
}

/**
 * Listen to real-time complaints for authenticated student
 */
function listenToComplaints() {
  if (unsubscribeComplaints) unsubscribeComplaints();

  const loadingSpinner = document.getElementById("table-loading");
  if (loadingSpinner) loadingSpinner.style.display = "block";

  unsubscribeComplaints = subscribeStudentComplaints(
    currentUser.uid,
    (complaints) => {
      studentComplaints = complaints;
      if (loadingSpinner) loadingSpinner.style.display = "none";
      updateMetricsCards(complaints);
      renderRecentComplaints(complaints);
      filterAndRenderComplaints();
    },
    (error) => {
      console.error("Student complaints listener error:", error);
      if (loadingSpinner) loadingSpinner.style.display = "none";
      notify.error("Error loading complaints: " + error.message);
    }
  );
}

/**
 * Update summary metric cards
 */
function updateMetricsCards(complaints) {
  const total = complaints.length;
  const pending = complaints.filter(c => (c.status || "Pending") === "Pending").length;
  const inProgress = complaints.filter(c => c.status === "In Progress" || c.status === "Assigned").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;

  const totalEl = document.getElementById("stat-total");
  const pendingEl = document.getElementById("stat-pending");
  const inProgressEl = document.getElementById("stat-inprogress");
  const resolvedEl = document.getElementById("stat-resolved");

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (resolvedEl) resolvedEl.textContent = resolved;
}

/**
 * Render the recent complaints overview on the dashboard view.
 */
function renderRecentComplaints(complaints) {
  const tbody = document.getElementById("recent-complaints-tbody");
  const emptyState = document.getElementById("recent-empty-state");
  if (!tbody) return;

  const recentComplaints = [...complaints]
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  if (recentComplaints.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  tbody.innerHTML = recentComplaints.map(complaint => `
    <tr>
      <td class="complaint-id-cell">${sanitize(complaint.complaintId || complaint.id)}</td>
      <td>${sanitize(complaint.title)}</td>
      <td>${getStatusBadgeHtml(complaint.status)}</td>
      <td>${formatDate(complaint.createdAt)}</td>
    </tr>
  `).join("");
}

/**
 * Filter & render student complaints
 */
function filterAndRenderComplaints() {
  const searchInput = document.getElementById("search-complaints");
  const filterCat = document.getElementById("filter-category");
  const filterStat = document.getElementById("filter-status");

  const queryText = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const catVal = filterCat ? filterCat.value : "all";
  const statVal = filterStat ? filterStat.value : "all";

  const filtered = studentComplaints.filter(c => {
    const matchQuery = !queryText || 
      (c.complaintId && c.complaintId.toLowerCase().includes(queryText)) ||
      (c.title && c.title.toLowerCase().includes(queryText)) ||
      (c.description && c.description.toLowerCase().includes(queryText));

    const matchCategory = (catVal === "all") || (c.category === catVal);
    const matchStatus = (statVal === "all") || (c.status === statVal);

    return matchQuery && matchCategory && matchStatus;
  });

  renderTable(filtered);
}

/**
 * Render complaints table
 */
function renderTable(complaints) {
  const tbody = document.getElementById("student-complaints-tbody");
  const emptyState = document.getElementById("student-empty-state");
  const countBadge = document.getElementById("complaint-count-badge");

  if (countBadge) countBadge.textContent = `${complaints.length} Records`;

  if (!tbody) return;

  if (complaints.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = complaints.map(c => `
    <tr>
      <td class="complaint-id-cell">${sanitize(c.complaintId || c.id)}</td>
      <td>
        <div class="complaint-title-cell">${sanitize(c.title)}</div>
        <div class="complaint-subtext">${sanitize(c.hostelBlock)} - Room ${sanitize(c.roomNumber)}</div>
      </td>
      <td>
        <span class="category-badge">${sanitize(c.category)}</span>
      </td>
      <td>${formatDate(c.createdAt)}</td>
      <td>${getStatusBadgeHtml(c.status)}</td>
      <td>
        ${c.assignedTo 
          ? `<span style="font-size:0.85rem; font-weight:500; color:var(--color-secondary);">${sanitize(c.assignedTo)}</span>` 
          : `<span style="color:var(--color-text-muted); font-size:0.8rem;">Unassigned</span>`}
      </td>
      <td>
        ${c.adminResponse 
          ? `<div style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; color:#065F46;">${sanitize(c.adminResponse)}</div>` 
          : `<span style="color:var(--color-text-muted); font-size:0.8rem;">No reply yet</span>`}
      </td>
      <td>
        <button class="btn btn-outline btn-sm btn-view-complaint" data-id="${c.id}">
          View Details
        </button>
      </td>
    </tr>
  `).join("");

  // Attach view detail click handlers
  tbody.querySelectorAll(".btn-view-complaint").forEach(btn => {
    btn.addEventListener("click", () => {
      const docId = btn.getAttribute("data-id");
      openComplaintDetailsModal(docId);
    });
  });
}

/**
 * Open Complaint Details Modal and load history
 */
async function openComplaintDetailsModal(docId) {
  const modal = document.getElementById("complaint-detail-modal");
  if (!modal) return;
  const requestId = ++complaintDetailRequest;

  const complaint = studentComplaints.find(c => c.id === docId) || await getComplaintById(docId);
  if (requestId !== complaintDetailRequest) return;
  if (!complaint) {
    notify.error("Complaint not found.");
    return;
  }

  // Populate basic info
  const detailFields = {
    "detail-id": complaint.complaintId || complaint.id,
    "detail-title": complaint.title,
    "detail-date": formatDate(complaint.createdAt),
    "detail-category": complaint.category,
    "detail-location": `${complaint.hostelBlock}, Room ${complaint.roomNumber}`,
    "detail-description": complaint.description
  };
  Object.entries(detailFields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  const statusBadge = document.getElementById("detail-status-badge");
  if (statusBadge) statusBadge.innerHTML = getStatusBadgeHtml(complaint.status);

  // Assignment section
  const assignCard = document.getElementById("detail-assignment-card");
  if (complaint.assignedTo) {
    if (assignCard) assignCard.style.display = "block";
    const assignee = document.getElementById("detail-assignee");
    const assignNotes = document.getElementById("detail-assign-notes");
    if (assignee) assignee.textContent = complaint.assignedTo;
    if (assignNotes) assignNotes.textContent = complaint.assignmentNotes || "No specific instructions provided.";
  } else {
    if (assignCard) assignCard.style.display = "none";
  }

  // Resolution / Rejection callouts
  const resCallout = document.getElementById("detail-resolution-callout");
  const rejCallout = document.getElementById("detail-rejection-callout");

  if (complaint.status === "Resolved" && complaint.resolutionDetails) {
    if (resCallout) resCallout.style.display = "block";
    const resolutionText = document.getElementById("detail-resolution-text");
    if (resolutionText) resolutionText.textContent = complaint.resolutionDetails;
  } else {
    if (resCallout) resCallout.style.display = "none";
  }

  if (complaint.status === "Rejected" && complaint.rejectionReason) {
    if (rejCallout) rejCallout.style.display = "block";
    const rejectionText = document.getElementById("detail-rejection-text");
    if (rejectionText) rejectionText.textContent = complaint.rejectionReason;
  } else {
    if (rejCallout) rejCallout.style.display = "none";
  }

  // Subscribe to real-time history/timeline
  const timelineEl = document.getElementById("detail-timeline");
  if (!timelineEl) {
    notify.error("Complaint history could not be displayed.");
    return;
  }
  timelineEl.innerHTML = `<div style="text-align:center; padding:1rem;"><span class="spinner"></span> Loading activity...</div>`;

  if (unsubscribeHistory) unsubscribeHistory();

  unsubscribeHistory = subscribeComplaintHistory(docId, (historyList) => {
    if (requestId !== complaintDetailRequest) return;
    if (historyList.length === 0) {
      timelineEl.innerHTML = `<p style="font-size:0.85rem; color:var(--color-text-muted);">No activity recorded yet.</p>`;
      return;
    }

    timelineEl.innerHTML = historyList.map(h => `
      <div class="timeline-step">
        <div class="timeline-marker ${h.actionType === 'STATUS_CHANGE' ? 'active' : ''}"></div>
        <div class="timeline-step-header">
          <span class="timeline-step-title">${sanitize(formatActionTitle(h.actionType, h.newStatus))}</span>
          <span class="timeline-step-time">${formatTimeAgo(h.timestamp)}</span>
        </div>
        <div class="timeline-step-content">${sanitize(h.message)}</div>
        <div class="timeline-by">By: ${sanitize(h.performedByName || "Admin")}</div>
      </div>
    `).join("");
  }, (error) => {
    if (requestId !== complaintDetailRequest) return;
    console.error("Student complaint history error:", error);
    timelineEl.innerHTML = `<p style="font-size:0.85rem; color:var(--color-text-muted);">Unable to load complaint history.</p>`;
    notify.error("Could not load complaint history: " + error.message);
  });

  modal.classList.add("active");
}

function formatActionTitle(actionType, newStatus) {
  if (actionType === "CREATED") return "Complaint Registered";
  if (actionType === "ASSIGNED") return "Staff Assigned";
  if (actionType === "STATUS_CHANGE") return `Status: ${newStatus}`;
  if (actionType === "REPLY") return "Message / Update";
  return actionType;
}
