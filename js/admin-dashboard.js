/* ==========================================================================
   ADMIN & WARDEN DASHBOARD CONTROLLER
   ========================================================================== */

import { requireAuth, logoutUser } from "./auth.js";
import {
  subscribeAllComplaints,
  subscribeComplaintHistory,
  getComplaintById,
  updateComplaintStatus,
  assignComplaint,
  addComplaintReply
} from "./complaints.js";
import { notify } from "./notifications.js";
import {
  formatDate,
  formatTimeAgo,
  getStatusBadgeHtml,
  sanitize,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES
} from "./utils.js";

let currentAdminUser = null;
let currentAdminProfile = null;
let allComplaints = [];
let unsubscribeAll = null;
let unsubscribeHistory = null;
let activeComplaintDocId = null;
let activeComplaintData = null;
let complaintModalRequest = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Strict admin guard
  requireAuth(["admin"], (user, profile) => {
    currentAdminUser = user;
    currentAdminProfile = profile;
    initAdminDashboard();
  });
});

function initAdminDashboard() {
  renderAdminHeader();
  setupEventListeners();
  populateDropdowns();
  listenToAllComplaints();
}

/**
 * Display admin name and role
 */
function renderAdminHeader() {
  const name = currentAdminProfile?.name || currentAdminUser.displayName || "Hostel Warden";
  const nameEl = document.getElementById("admin-welcome-name");
  if (nameEl) nameEl.textContent = name;

  const sidebarName = document.getElementById("sidebar-admin-name");
  if (sidebarName) sidebarName.textContent = name;
}

/**
 * Populate filter dropdowns
 */
function populateDropdowns() {
  const catFilter = document.getElementById("admin-filter-category");
  if (catFilter) {
    catFilter.innerHTML = '<option value="all">All Categories</option>' +
      COMPLAINT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  const statFilter = document.getElementById("admin-filter-status");
  if (statFilter) {
    statFilter.innerHTML = '<option value="all">All Statuses</option>' +
      COMPLAINT_STATUSES.map(s => `<option value="${s}">${s}</option>`).join("");
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Logout
  const logoutBtn = document.getElementById("btn-admin-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => logoutUser("admin-login.html"));
  }

  // Mobile navigation toggle
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

  // Search & Filter change events
  const searchInput = document.getElementById("admin-search-input");
  const catFilter = document.getElementById("admin-filter-category");
  const statFilter = document.getElementById("admin-filter-status");
  const sortFilter = document.getElementById("admin-sort-order");
  const resetBtn = document.getElementById("btn-reset-filters");

  if (searchInput) searchInput.addEventListener("input", filterAndRenderTable);
  if (catFilter) catFilter.addEventListener("change", filterAndRenderTable);
  if (statFilter) statFilter.addEventListener("change", filterAndRenderTable);
  if (sortFilter) sortFilter.addEventListener("change", filterAndRenderTable);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (catFilter) catFilter.value = "all";
      if (statFilter) statFilter.value = "all";
      if (sortFilter) sortFilter.value = "desc";
      filterAndRenderTable();
    });
  }

  // Manage Modal Close Buttons
  const manageModal = document.getElementById("admin-manage-modal");
  const closeManageBtns = document.querySelectorAll(".close-manage-modal");
  closeManageBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      complaintModalRequest++;
      if (manageModal) manageModal.classList.remove("active");
      if (unsubscribeHistory) {
        unsubscribeHistory();
        unsubscribeHistory = null;
      }
      activeComplaintDocId = null;
      activeComplaintData = null;
    });
  });

  // Assign Form
  const assignForm = document.getElementById("admin-assign-form");
  if (assignForm) {
    assignForm.addEventListener("submit", handleAssignSubmit);
  }

  // Status Change Form
  const statusForm = document.getElementById("admin-status-form");
  if (statusForm) {
    statusForm.addEventListener("submit", handleStatusSubmit);
  }

  // Status select change: toggle rejection and resolution input fields
  const statusSelect = document.getElementById("manage-new-status");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      const rejectGroup = document.getElementById("status-rejection-group");
      const resolveGroup = document.getElementById("status-resolution-group");

      if (rejectGroup) rejectGroup.style.display = (val === "Rejected") ? "block" : "none";
      if (resolveGroup) resolveGroup.style.display = (val === "Resolved") ? "block" : "none";
    });
  }

  // Admin Reply Form
  const replyForm = document.getElementById("admin-reply-form");
  if (replyForm) {
    replyForm.addEventListener("submit", handleReplySubmit);
  }
}

/**
 * Real-time listener for all complaints
 */
function listenToAllComplaints() {
  if (unsubscribeAll) unsubscribeAll();

  const loadingSpinner = document.getElementById("admin-table-loading");
  if (loadingSpinner) loadingSpinner.style.display = "block";

  unsubscribeAll = subscribeAllComplaints(
    (complaints) => {
      allComplaints = complaints;
      if (loadingSpinner) loadingSpinner.style.display = "none";
      updateAdminMetrics(complaints);
      filterAndRenderTable();

      // If active complaint is currently open in modal, refresh its view
      if (activeComplaintDocId) {
        const updated = complaints.find(c => c.id === activeComplaintDocId);
        if (updated) {
          activeComplaintData = updated;
          renderManageModalDetails(updated);
        } else {
          complaintModalRequest++;
          if (unsubscribeHistory) unsubscribeHistory();
          unsubscribeHistory = null;
          activeComplaintDocId = null;
          activeComplaintData = null;
          const manageModal = document.getElementById("admin-manage-modal");
          if (manageModal) manageModal.classList.remove("active");
          notify.warning("This complaint was deleted and the management window was closed.");
        }
      }
    },
    (error) => {
      console.error("Admin complaints listener error:", error);
      if (loadingSpinner) loadingSpinner.style.display = "none";
      notify.error("Failed to load complaints: " + error.message);
    }
  );
}

/**
 * Update 6 Admin Metric Cards
 */
function updateAdminMetrics(complaints) {
  const total = complaints.length;
  const pending = complaints.filter(c => (c.status || "Pending") === "Pending").length;
  const assigned = complaints.filter(c => c.status === "Assigned").length;
  const inProgress = complaints.filter(c => c.status === "In Progress").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;
  const rejected = complaints.filter(c => c.status === "Rejected").length;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl("admin-stat-total", total);
  setEl("admin-stat-pending", pending);
  setEl("admin-stat-assigned", assigned);
  setEl("admin-stat-inprogress", inProgress);
  setEl("admin-stat-resolved", resolved);
  setEl("admin-stat-rejected", rejected);
}

/**
 * Search, filter and sort complaints
 */
function filterAndRenderTable() {
  const searchInput = document.getElementById("admin-search-input");
  const catFilter = document.getElementById("admin-filter-category");
  const statFilter = document.getElementById("admin-filter-status");
  const sortFilter = document.getElementById("admin-sort-order");

  const queryText = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const catVal = catFilter ? catFilter.value : "all";
  const statVal = statFilter ? statFilter.value : "all";
  const sortOrder = sortFilter ? sortFilter.value : "desc";

  let list = allComplaints.filter(c => {
    const matchQuery = !queryText ||
      (c.complaintId && c.complaintId.toLowerCase().includes(queryText)) ||
      (c.studentName && c.studentName.toLowerCase().includes(queryText)) ||
      (c.usn && c.usn.toLowerCase().includes(queryText)) ||
      (c.title && c.title.toLowerCase().includes(queryText)) ||
      (c.roomNumber && c.roomNumber.toLowerCase().includes(queryText));

    const matchCategory = (catVal === "all") || (c.category === catVal);
    const matchStatus = (statVal === "all") || (c.status === statVal);

    return matchQuery && matchCategory && matchStatus;
  });

  // Sort
  list.sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
  });

  renderAdminTable(list);
}

/**
 * Render Admin Data Table
 */
function renderAdminTable(complaints) {
  const tbody = document.getElementById("admin-complaints-tbody");
  const emptyState = document.getElementById("admin-empty-state");
  const countBadge = document.getElementById("admin-record-count");

  if (countBadge) countBadge.textContent = `${complaints.length} Records Found`;

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
        <div style="font-weight:600; color:var(--color-dark);">${sanitize(c.studentName)}</div>
        <div class="complaint-subtext">USN: ${sanitize(c.usn)}</div>
      </td>
      <td>
        <div style="font-weight:500;">Room ${sanitize(c.roomNumber)}</div>
        <div class="complaint-subtext">${sanitize(c.hostelBlock)}</div>
      </td>
      <td>
        <span class="category-badge">${sanitize(c.category)}</span>
      </td>
      <td>
        <div class="complaint-title-cell" title="${sanitize(c.title)}">${sanitize(c.title)}</div>
      </td>
      <td>${formatDate(c.createdAt)}</td>
      <td>${getStatusBadgeHtml(c.status)}</td>
      <td>
        ${c.assignedTo 
          ? `<span style="font-weight:600; color:var(--color-secondary);">${sanitize(c.assignedTo)}</span>` 
          : `<span style="color:var(--color-text-muted); font-size:0.8rem;">Unassigned</span>`}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm btn-manage-complaint" data-id="${c.id}">
          Manage
        </button>
      </td>
    </tr>
  `).join("");

  // Attach click handlers
  tbody.querySelectorAll(".btn-manage-complaint").forEach(btn => {
    btn.addEventListener("click", () => {
      const docId = btn.getAttribute("data-id");
      openAdminManageModal(docId);
    });
  });
}

/**
 * Open Complaint Management Modal
 */
async function openAdminManageModal(docId) {
  const requestId = ++complaintModalRequest;
  activeComplaintDocId = docId;
  const complaint = allComplaints.find(c => c.id === docId) || await getComplaintById(docId);
  if (requestId !== complaintModalRequest) return;
  if (!complaint) {
    activeComplaintDocId = null;
    activeComplaintData = null;
    notify.error("Complaint record not found.");
    return;
  }

  activeComplaintData = complaint;
  renderManageModalDetails(complaint);

  // Setup Real-time history & replies listener
  listenToComplaintTimeline(docId);

  const modal = document.getElementById("admin-manage-modal");
  if (modal) modal.classList.add("active");
}

/**
 * Render details inside Admin Manage Modal
 */
function renderManageModalDetails(c) {
  const fields = {
    "modal-complaint-id": c.complaintId || c.id,
    "modal-title": c.title,
    "modal-student-name": c.studentName,
    "modal-usn": c.usn,
    "modal-location": `${c.hostelBlock}, Room ${c.roomNumber}`,
    "modal-category": c.category,
    "modal-date": formatDate(c.createdAt),
    "modal-description": c.description
  };
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  const statusBadge = document.getElementById("modal-status-badge");
  if (statusBadge) statusBadge.innerHTML = getStatusBadgeHtml(c.status);

  // Pre-fill assignment form
  const staffInput = document.getElementById("assign-staff-name");
  const notesInput = document.getElementById("assign-notes");
  if (staffInput) staffInput.value = c.assignedTo || "";
  if (notesInput) notesInput.value = c.assignmentNotes || "";

  // Pre-fill status change form
  const statusSelect = document.getElementById("manage-new-status");
  const rejectGroup = document.getElementById("status-rejection-group");
  const resolveGroup = document.getElementById("status-resolution-group");
  const rejectReasonInput = document.getElementById("status-rejection-reason");
  const resolveDetailsInput = document.getElementById("status-resolution-details");

  if (statusSelect) statusSelect.value = c.status || "Pending";
  if (rejectGroup) rejectGroup.style.display = (c.status === "Rejected") ? "block" : "none";
  if (resolveGroup) resolveGroup.style.display = (c.status === "Resolved") ? "block" : "none";
  if (rejectReasonInput) rejectReasonInput.value = c.rejectionReason || "";
  if (resolveDetailsInput) resolveDetailsInput.value = c.resolutionDetails || "";
}

/**
 * Real-time timeline & replies listener for modal
 */
function listenToComplaintTimeline(docId) {
  if (unsubscribeHistory) unsubscribeHistory();

  const timelineContainer = document.getElementById("modal-timeline");
  const repliesContainer = document.getElementById("modal-replies-thread");

  unsubscribeHistory = subscribeComplaintHistory(docId, (historyList) => {
    if (docId !== activeComplaintDocId) return;
    // 1. Timeline audit events
    if (timelineContainer) {
      if (historyList.length === 0) {
        timelineContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--color-text-muted);">No logs yet.</p>`;
      } else {
        timelineContainer.innerHTML = historyList.map(h => `
          <div class="timeline-step">
            <div class="timeline-marker ${h.actionType === 'STATUS_CHANGE' ? 'active' : ''}"></div>
            <div class="timeline-step-header">
              <span class="timeline-step-title">${sanitize(h.message)}</span>
              <span class="timeline-step-time">${formatTimeAgo(h.timestamp)}</span>
            </div>
            <div class="timeline-by">Logged by: ${sanitize(h.performedByName || "Admin")}</div>
          </div>
        `).join("");
      }
    }

    // 2. Replies / Chat thread
    if (repliesContainer) {
      const replies = historyList.filter(h => h.actionType === "REPLY");
      if (replies.length === 0) {
        repliesContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--color-text-muted); text-align:center; padding:1rem 0;">No messages yet. Send a progress update below.</p>`;
      } else {
        repliesContainer.innerHTML = replies.map(r => `
          <div class="reply-bubble ${r.role === 'admin' ? 'admin-reply' : ''}">
            <div class="reply-header">
              <span class="reply-author">${sanitize(r.performedByName)}</span>
              <span class="reply-time">${formatTimeAgo(r.timestamp)}</span>
            </div>
            <div class="reply-body">${sanitize(r.message)}</div>
          </div>
        `).join("");
      }
    }
  }, (error) => {
    console.error("Admin complaint history error:", error);
    notify.error("Could not load complaint history: " + error.message);
  });
}

/**
 * Handle Complaint Assignment
 */
async function handleAssignSubmit(e) {
  e.preventDefault();
  if (!activeComplaintDocId) return;

  const staffInput = document.getElementById("assign-staff-name");
  const notesInput = document.getElementById("assign-notes");
  const submitBtn = document.getElementById("btn-assign-submit");

  if (!staffInput || !notesInput || !submitBtn) {
    notify.error("Assignment controls are unavailable.");
    return;
  }

  const staffName = staffInput.value.trim();
  const notes = notesInput.value.trim();
  const latestComplaint = allComplaints.find(c => c.id === activeComplaintDocId);
  if (!latestComplaint) {
    notify.warning("This complaint is no longer available.");
    return;
  }

  if (!staffName) {
    notify.error("Please enter maintenance staff name.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Assigning...`;

  try {
    await assignComplaint(activeComplaintDocId, {
      assignedTo: staffName,
      assignmentNotes: notes,
      adminUser: {
        uid: currentAdminUser.uid,
        name: currentAdminProfile?.name || "Hostel Warden"
      },
      currentStatus: latestComplaint.status || "Pending"
    });

    notify.success(`Complaint successfully assigned to ${staffName}!`);
  } catch (err) {
    console.error("Assignment error:", err);
    notify.error("Failed to assign complaint: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Save Assignment`;
  }
}

/**
 * Handle Status Update
 */
async function handleStatusSubmit(e) {
  e.preventDefault();
  if (!activeComplaintDocId) return;

  const statusSelect = document.getElementById("manage-new-status");
  const rejectReasonInput = document.getElementById("status-rejection-reason");
  const resolveDetailsInput = document.getElementById("status-resolution-details");
  const submitBtn = document.getElementById("btn-status-submit");

  if (!statusSelect || !rejectReasonInput || !resolveDetailsInput || !submitBtn) {
    notify.error("Status controls are unavailable.");
    return;
  }
  const newStatus = statusSelect.value;
  const reason = rejectReasonInput.value.trim();
  const resolutionDetails = resolveDetailsInput.value.trim();
  const latestComplaint = allComplaints.find(c => c.id === activeComplaintDocId);
  if (!latestComplaint) {
    notify.warning("This complaint is no longer available.");
    return;
  }

  if (newStatus === "Rejected" && !reason) {
    notify.error("Rejection reason is strictly mandatory.");
    rejectReasonInput.focus();
    return;
  }

  if (newStatus === "Resolved" && !resolutionDetails) {
    notify.warning("Please provide resolution details for the student.");
    resolveDetailsInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Updating...`;

  try {
    await updateComplaintStatus(activeComplaintDocId, newStatus, {
      reason,
      resolutionDetails,
      adminUser: {
        uid: currentAdminUser.uid,
        name: currentAdminProfile?.name || "Hostel Warden"
      },
      previousStatus: latestComplaint.status || "Pending"
    });

    notify.success(`Status updated to "${newStatus}"!`);
  } catch (err) {
    console.error("Status update error:", err);
    notify.error("Could not update status: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Update Status`;
  }
}

/**
 * Handle Sending Admin Reply
 */
async function handleReplySubmit(e) {
  e.preventDefault();
  if (!activeComplaintDocId) return;

  const replyInput = document.getElementById("admin-reply-input");
  const submitBtn = document.getElementById("btn-reply-submit");
  if (!replyInput || !submitBtn) {
    notify.error("Reply controls are unavailable.");
    return;
  }
  const text = replyInput.value.trim();

  if (!text) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span>`;

  try {
    await addComplaintReply(
      activeComplaintDocId,
      text,
      {
        uid: currentAdminUser.uid,
        name: currentAdminProfile?.name || "Hostel Warden"
      },
      "admin"
    );

    replyInput.value = "";
    notify.success("Reply posted successfully!");
  } catch (err) {
    console.error("Reply error:", err);
    notify.error("Failed to post reply: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Send Reply`;
  }
}
