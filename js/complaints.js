/* ==========================================================================
   COMPLAINT DATA MANAGEMENT & FIRESTORE OPERATIONS
   ========================================================================== */

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateComplaintId } from "./utils.js";

/**
 * Submit a new complaint
 */
export async function createComplaint({
  studentId,
  studentName,
  usn,
  title,
  description,
  category,
  hostelBlock,
  roomNumber
}) {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!studentId || !studentName || !usn || !roomNumber) {
    throw new Error("A complete student profile is required before submitting a complaint.");
  }

  const complaintId = generateComplaintId();

  const complaintPayload = {
    complaintId: complaintId,
    studentId: studentId,
    studentName: studentName.trim(),
    usn: usn.trim(),
    title: title.trim(),
    description: description.trim(),
    category: category,
    hostelBlock: hostelBlock ? hostelBlock.trim() : "Main Block",
    roomNumber: roomNumber.trim(),
    status: "Pending",
    assignedTo: "",
    assignmentNotes: "",
    adminResponse: "",
    resolutionDetails: "",
    rejectionReason: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // 1. Add complaint document
  const docRef = await addDoc(collection(db, "complaints"), complaintPayload);

  return { id: docRef.id, complaintId };
}

/**
 * Real-time listener for current student's complaints
 */
export function subscribeStudentComplaints(studentId, onData, onError) {
  if (!db || !studentId) return () => {};

  const q = query(
    collection(db, "complaints"),
    where("studentId", "==", studentId)
  );

  return onSnapshot(q, (snapshot) => {
    const complaints = [];
    snapshot.forEach((doc) => {
      complaints.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sort by createdAt descending
    complaints.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    onData(complaints);
  }, onError);
}

/**
 * Real-time listener for all complaints (Admin Portal)
 */
export function subscribeAllComplaints(onData, onError) {
  if (!db) return () => {};

  const q = collection(db, "complaints");

  return onSnapshot(q, (snapshot) => {
    const complaints = [];
    snapshot.forEach((doc) => {
      complaints.push({ id: doc.id, ...doc.data() });
    });

    // Sort descending by createdAt
    complaints.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    onData(complaints);
  }, onError);
}

/**
 * Fetch a single complaint by document ID
 */
export async function getComplaintById(docId) {
  if (!db || !docId) return null;
  const docRef = doc(db, "complaints", docId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

/**
 * Assign a complaint to maintenance personnel
 */
export async function assignComplaint(docId, { assignedTo, assignmentNotes, adminUser, currentStatus }) {
  if (!db || !docId) throw new Error("Invalid parameters.");

  const docRef = doc(db, "complaints", docId);
  const newStatus = (currentStatus === "Pending") ? "Assigned" : currentStatus;

  const historyRef = doc(collection(db, "complaints", docId, "history"));
  const batch = writeBatch(db);
  batch.update(docRef, {
    assignedTo: assignedTo.trim(),
    assignmentNotes: assignmentNotes ? assignmentNotes.trim() : "",
    status: newStatus,
    updatedAt: serverTimestamp()
  });
  batch.set(historyRef, {
    actionType: "ASSIGNED",
    message: `Assigned to ${assignedTo.trim()}` + (assignmentNotes ? `: "${assignmentNotes.trim()}"` : ""),
    previousStatus: currentStatus,
    newStatus: newStatus,
    performedBy: adminUser.uid,
    performedByName: adminUser.name || adminUser.displayName || "Warden",
    timestamp: serverTimestamp()
  });
  await batch.commit();
}

/**
 * Update complaint status (with required reason for rejection or resolution details)
 */
export async function updateComplaintStatus(docId, newStatus, { reason = "", resolutionDetails = "", adminUser, previousStatus }) {
  if (!db || !docId) throw new Error("Invalid parameters.");

  if (newStatus === "Rejected" && !reason.trim()) {
    throw new Error("A clear rejection reason is required when rejecting a complaint.");
  }

  const updatePayload = {
    status: newStatus,
    updatedAt: serverTimestamp()
  };

  if (newStatus === "Rejected") {
    updatePayload.rejectionReason = reason.trim();
  }
  if (newStatus === "Resolved") {
    updatePayload.resolutionDetails = resolutionDetails.trim();
  }

  const docRef = doc(db, "complaints", docId);
  // Add history event
  let historyMessage = `Status updated to ${newStatus}`;
  if (newStatus === "Rejected") {
    historyMessage += `. Reason: ${reason.trim()}`;
  } else if (newStatus === "Resolved" && resolutionDetails.trim()) {
    historyMessage += `. Resolution: ${resolutionDetails.trim()}`;
  }

  const historyRef = doc(collection(db, "complaints", docId, "history"));
  const batch = writeBatch(db);
  batch.update(docRef, updatePayload);
  batch.set(historyRef, {
    actionType: "STATUS_CHANGE",
    message: historyMessage,
    previousStatus: previousStatus || "Pending",
    newStatus: newStatus,
    performedBy: adminUser.uid,
    performedByName: adminUser.name || adminUser.displayName || "Admin",
    timestamp: serverTimestamp()
  });
  await batch.commit();
}

/**
 * Post an admin reply to a complaint
 */
export async function addComplaintReply(docId, replyText, user, role) {
  if (role !== "admin") throw new Error("Only admins can reply to complaints.");
  if (!db || !docId || !replyText.trim()) throw new Error("Reply content cannot be empty.");

  const docRef = doc(db, "complaints", docId);
  const cleanReply = replyText.trim();

  const historyRef = doc(collection(db, "complaints", docId, "history"));
  const batch = writeBatch(db);
  batch.update(docRef, {
    adminResponse: cleanReply,
    updatedAt: serverTimestamp()
  });
  batch.set(historyRef, {
    actionType: "REPLY",
    message: cleanReply,
    previousStatus: null,
    newStatus: null,
    performedBy: user.uid,
    performedByName: (user.name || user.displayName || (role === "admin" ? "Warden" : "Student")),
    role: role,
    timestamp: serverTimestamp()
  });
  await batch.commit();
}

/**
 * Real-time listener for complaint activity and replies
 */
export function subscribeComplaintHistory(docId, onData, onError) {
  if (!db || !docId) return () => {};

  const historyRef = collection(db, "complaints", docId, "history");

  return onSnapshot(historyRef, (snapshot) => {
    const historyList = [];
    snapshot.forEach((doc) => {
      historyList.push({ id: doc.id, ...doc.data() });
    });

    // Sort chronologically ascending
    historyList.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeA - timeB;
    });

    onData(historyList);
  }, onError);
}
