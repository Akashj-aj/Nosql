# Hostel Complaint Management System

A complete, production-ready, and lightweight Hostel Complaint Management System built with **HTML5, CSS3, Vanilla JavaScript (ES Modules)**, and **Google Firebase** (Authentication and Cloud Firestore). Designed for static deployment on **Netlify**.

---

## 🚀 Features Overview

### 1. Student Portal
- **Student Signup & Login**: Full Name, USN (University Seat Number), Email, Room Number, and Password.
- **Duplicate Prevention**: Rejects duplicate registrations for the same Email or USN.
- **Google Authentication**: One-click Google sign-in. Automatically prompts a completion modal for USN and Room Number on first-time login.
- **Security & UX**: Real-time password strength meter, visibility toggle (`show/hide`), and forgot password reset link.
- **Student Dashboard**:
  - Live metric counters: Total, Pending, In-Progress, and Resolved.
  - Interactive **Submit Complaint** modal with category picker and room info.
  - **My Complaints** table with search and filtering by Category and Status.
  - Detailed Complaint view with audit activity timeline, maintenance assignment, and admin response notes.
  - Privacy guaranteed: Students can only view their own registered complaints.

### 2. Warden & Administrator Console
- **Restricted Access**: Dedicated admin login portal (`admin-login.html`). No public registration; accounts are verified by Firestore role (`role === 'admin'`).
- **Comprehensive Summary Cards**: Real-time counters for Total, Pending, Assigned, In Progress, Resolved, and Rejected grievances.
- **Complaint Management Table**:
  - Search by Complaint ID, Student Name, USN, or Room.
  - Filter by Category and Status.
  - Sort chronologically (Newest first / Oldest first).
- **Interactive Management Drawer / Modal**:
  - **Staff Assignment**: Assign maintenance personnel (electrician, plumber, etc.) with instructions.
  - **Status Updates**: Transitions across `Pending`, `Assigned`, `In Progress`, `Resolved`, and `Rejected`. Mandatory reason required when rejecting a grievance; resolution details required when resolving.
  - **Admin Replies**: Real-time communication and progress thread visible to the student.
  - **Chronological Audit Trail**: Full event logging with admin identity and timestamps.

### 3. Design System & UX
- **Color Palette**:
  - Accent Lime-Yellow: `#DEEC51`
  - Deep Teal: `#003032`
  - Near Black: `#050711`
  - Background: `#F5F5F5`
  - Surface: `#EBEBEB`
  - Text: `#323233`
- **Typography**: Big Shoulders Text (headings), Inter / SF Pro Display (body), JetBrains Mono / Geist Mono (IDs & metadata).
- **Toasts & Feedback**: Non-blocking toast notification system for success, error, warning, and info states.

---

## 📁 Project Structure

```text
hostel-complaint-management/
├── index.html                  # Landing gateway (Student & Admin portal selection)
├── student-login.html          # Student authentication & Google Auth
├── student-signup.html         # Student registration with USN and Room
├── admin-login.html            # Dedicated Admin & Warden sign-in
├── student-dashboard.html      # Student complaint tracking & submission
├── admin-dashboard.html        # Warden complaints management console
├── complaint-details.html      # Direct linkable complaint detail viewer
│
├── css/
│   ├── style.css               # Design system tokens, buttons, badges, modals, toasts
│   ├── auth.css                # Auth layouts, strength meter, password toggles
│   ├── dashboard.css           # Collapsible sidebar, stats grid, responsive table
│   └── complaint.css           # Forms, timeline audit trail, replies thread
│
├── js/
│   ├── firebase-config.js      # Firebase v10 Modular SDK initialization & quick-connect
│   ├── notifications.js        # Global Toast notification manager
│   ├── utils.js                # Helpers: IDs, dates, sanitization, strength meter
│   ├── auth.js                 # Session observer, route protection, logout
│   ├── student-auth.js         # Student login, signup, Google auth, password reset
│   ├── admin-auth.js           # Admin login verification & role enforcement
│   ├── complaints.js           # Firestore queries, realtime listeners, assignments
│   ├── student-dashboard.js    # Student dashboard logic & complaint submission
│   └── admin-dashboard.js      # Admin dashboard metrics, table, status updates, replies
│
├── firestore.rules             # Production security rules for Firestore
├── netlify.toml                # Netlify deployment configuration & security headers
└── README.md                   # Setup guide and documentation
```

---

## 🛠️ Step-by-Step Firebase Setup

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it (e.g. `hostel-complaints`), and click **Continue**.
3. Disable Google Analytics (optional) and click **Create project**.

### Step 2: Enable Firebase Authentication
1. In the Firebase console sidebar, navigate to **Build** &rarr; **Authentication**.
2. Click **Get started**.
3. In the **Sign-in method** tab:
   - Enable **Email/Password** (keep Email link disabled).
   - Enable **Google** (set your project support email and save).

### Step 3: Enable Cloud Firestore
1. In the sidebar, navigate to **Build** &rarr; **Firestore Database**.
2. Click **Create database**.
3. Choose your closest database location (e.g. `asia-south1` or `us-central1`).
4. Select **Start in production mode** and click **Create**.

### Step 4: Configure Firestore Security Rules
1. In Firestore Database, click on the **Rules** tab.
2. Replace all existing content with the contents of the [`firestore.rules`](./firestore.rules) file in this repository.
3. Click **Publish**.

### Step 5: Create Your First Admin / Warden Account
Since there is intentionally **no public admin registration** for security:
1. In Firebase Console &rarr; **Authentication** &rarr; **Users** tab:
   - Click **Add user**.
   - Enter an admin email (e.g. `warden@hostel.edu`) and a secure password.
   - Copy the newly created user's **User UID**.
2. Go to **Firestore Database** &rarr; **Data** tab:
   - Click **Start collection**.
   - Collection ID: `users`
   - Document ID: Paste the **User UID** copied from step 1.
   - Add the following fields:
     - `uid`: `(string)` paste the User UID
     - `name`: `(string)` `Chief Warden`
     - `email`: `(string)` `warden@hostel.edu`
     - `usn`: `(string)` `ADMIN-01`
     - `roomNumber`: `(string)` `Warden Office`
     - `role`: `(string)` `admin`
     - `createdAt`: `(timestamp)` current time
   - Click **Save**.
3. You can now log into `admin-login.html` using this email and password!

### Step 6: Connect Firebase Credentials to Frontend
1. In Firebase Console, go to **Project Settings** (gear icon) &rarr; **General**.
2. Scroll down to **Your apps**, click the **Web (</>)** icon, register the app, and copy the `firebaseConfig` object.
3. Open `js/firebase-config.js` in this repository and replace the placeholder values:
   ```javascript
   const defaultFirebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "hostel-complaints.firebaseapp.com",
     projectId: "hostel-complaints",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcdef..."
   };
   ```
*(Alternatively, when opening the application in the browser, an interactive **Quick Connect** banner will appear allowing you to paste your JSON configuration directly).*

---

## 🌐 Netlify Deployment Guide

### Option A: Deploy via GitHub (Recommended)
1. Push this project to a GitHub repository:
   ```bash
   git add .
   git commit -m "Hostel Complaint Management System"
   git push origin main
   ```
2. Log in to [Netlify](https://app.netlify.com/).
3. Click **Add new site** &rarr; **Import an existing project** &rarr; **GitHub**.
4. Select your repository.
5. In the Build settings:
   - **Base directory**: (leave blank)
   - **Build command**: (leave blank, plain HTML/CSS/JS requires no build)
   - **Publish directory**: `.`
6. Click **Deploy site**.

### Option B: Netlify CLI
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=.
```

### Critical Post-Deployment Step: Authorize Netlify Domain in Firebase
To allow Firebase Authentication (especially Google Sign-In and email sessions) to operate on your deployed site:
1. Copy your deployed Netlify domain (e.g. `your-app-name.netlify.app`).
2. Go to the [Firebase Console](https://console.firebase.google.com/) &rarr; **Authentication** &rarr; **Settings** tab &rarr; **Authorized domains**.
3. Click **Add domain**.
4. Paste your domain `your-app-name.netlify.app` and click **Add**.

---

## 🔒 Security Summary

| Role | Permissions | Enforced By |
| :--- | :--- | :--- |
| **Anonymous** | Can only access Login, Signup, and Landing pages. | Frontend Guard & Firebase Auth |
| **Student** | Can create complaints (`Pending`) and read their own complaints and history. Cannot reply, change their role, alter statuses, or view peers' complaints. | Firestore Security Rules & `auth.js` |
| **Admin / Warden** | Can view all complaints, assign staff, modify statuses to all 5 states, post replies, and manage full grievance workflows. | Firestore Security Rules & Role Check |

---

## 💻 Local Development

To run the application locally, start any static local web server in the project directory:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Open `http://localhost:8000` in your web browser.
