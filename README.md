# 🚗 Sawaari — Hyperlocal Ride Sharing App

A fully functional hyperlocal ride-sharing platform built with React, Node.js/Express, SQLite, Socket.io, and JWT authentication.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ 
- npm

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Start the Backend
```bash
cd backend
node server.js
```
Backend runs on `http://localhost:5000`

### 3. Start the Frontend (in a new terminal)
```bash
cd frontend
npm start
```
Frontend runs on `http://localhost:3000`

---

## 🔐 How OTP Works (Dev Mode)

OTPs are printed in the **backend terminal console** — check the server terminal when logging in. Look for:
```
📲 [SAWAARI OTP SERVICE]
   Phone : +91...
   OTP   : 123456
```

To use real SMS (e.g. Twilio), replace the `sendOtp()` function body in `backend/routes/auth.js`.

---

## 📱 Features

| Feature | Status |
|---------|--------|
| Phone + OTP Auth (real verification) | ✅ |
| JWT Session (7-day tokens) | ✅ |
| Signup with age gate (< 15 blocked) | ✅ |
| Ride Search with Route Overlap Matching | ✅ |
| Pink Mode (female-only filter) | ✅ |
| Register a Ride | ✅ |
| Join a Ride | ✅ |
| Auto-expiry of past rides | ✅ |
| Real-time Group Chat (Socket.io) | ✅ |
| WhatsApp-style Chat UI | ✅ |
| Call stub (no phone numbers shared) | ✅ |
| Carpooling | 🚧 Coming Soon |

---

## 🗄️ Database

SQLite database auto-created at `backend/sawaari.db` on first run.

Tables: `users`, `otp_store`, `rides`, `ride_members`, `messages`

---

## 🔒 Security

- Phone numbers are **never** exposed in any API response or UI
- JWT validated on every protected route
- OTPs expire in 10 minutes and can only be used once
- Age validation: users under 15 cannot register
