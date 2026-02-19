const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'sawaari_secret';
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

// ─── OTP SERVICE ──────────────────────────────────────────────────────────────
async function sendOtp(phone, otp) {
    console.log(`\n📲 [SAWAARI OTP SERVICE]`);
    console.log(`   Phone : ${phone}`);
    console.log(`   OTP   : ${otp}`);
    console.log(`   Valid for ${OTP_EXPIRY_MINUTES} minutes\n`);
    return true;
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function makeToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, gender: user.gender, role: user.role || null },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function userPayload(user) {
    return { id: user.id, username: user.username, gender: user.gender, age: user.age, role: user.role || null };
}

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid phone number is required' });
        }

        const db = getDb();
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        db.prepare(`UPDATE otp_store SET used = 1 WHERE phone = ? AND used = 0`).run(phone);
        db.prepare(`INSERT INTO otp_store (phone, otp, expires_at) VALUES (?, ?, ?)`).run(phone, otp, expiresAt);

        await sendOtp(phone, otp);

        const existingUser = db.prepare(`SELECT id, username FROM users WHERE phone = ?`).get(phone);

        res.json({
            success: true,
            message: 'OTP sent successfully',
            isExistingUser: !!existingUser
        });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const db = getDb();
        const otpRecord = db.prepare(`
      SELECT * FROM otp_store 
      WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(phone, otp);

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const user = db.prepare(`SELECT id, username, gender, age, role FROM users WHERE phone = ?`).get(phone);

        if (!user) {
            // New user — keep OTP alive for /register
            return res.json({ success: true, otpVerified: true, needsRegistration: true, phone });
        }

        // Existing user login — consume OTP now
        db.prepare(`UPDATE otp_store SET used = 1 WHERE id = ?`).run(otpRecord.id);

        const token = makeToken(user);

        res.json({
            success: true,
            token,
            user: userPayload(user)
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Simplified: only collects username, gender, age (NO role, NO license)
router.post('/register', async (req, res) => {
    try {
        const { phone, otp, username, gender, age } = req.body;

        if (!phone || !otp || !username || !gender || age === undefined) {
            return res.status(400).json({ error: 'Phone, OTP, username, gender, and age are required' });
        }

        if (!['Male', 'Female', 'Prefer not to say'].includes(gender)) {
            return res.status(400).json({ error: 'Invalid gender value' });
        }

        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 15) {
            return res.status(400).json({ error: 'You must be at least 15 years old' });
        }

        const db = getDb();

        const otpRecord = db.prepare(`
      SELECT * FROM otp_store 
      WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(phone, otp);

        if (!otpRecord) {
            return res.status(400).json({ error: 'OTP session expired. Please restart signup.' });
        }

        const existingUsername = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username.trim());
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken. Please choose another.' });
        }

        const existingPhone = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
        if (existingPhone) {
            return res.status(400).json({ error: 'Phone number already registered. Please login.' });
        }

        // Create user — NO role yet (null)
        const result = db.prepare(`
      INSERT INTO users (phone, username, gender, age, role) VALUES (?, ?, ?, ?, NULL)
    `).run(phone, username.trim(), gender, ageNum);

        const userId = result.lastInsertRowid;

        // Consume OTP
        db.prepare(`UPDATE otp_store SET used = 1 WHERE id = ?`).run(otpRecord.id);

        const newUser = { id: userId, username: username.trim(), gender, age: ageNum, role: null };
        const token = makeToken(newUser);

        res.status(201).json({ success: true, token, user: userPayload(newUser) });
    } catch (err) {
        console.error('Register error:', err);
        if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ─── POST /api/auth/set-driveshare-role ───────────────────────────────────────
// Called when user first enters DriveShare and selects Driver or Rider
const { authenticateToken } = require('../middleware/auth');

router.post('/set-driveshare-role', authenticateToken, (req, res) => {
    try {
        const { role, licenseNo, issueDate, expiryDate } = req.body;

        if (!['driver', 'rider'].includes(role)) {
            return res.status(400).json({ error: 'Role must be "driver" or "rider"' });
        }

        // Drivers MUST provide license number
        if (role === 'driver' && !licenseNo) {
            return res.status(400).json({ error: 'Drivers must provide a license number' });
        }

        const db = getDb();
        const userId = req.user.userId;
        const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Prevent changing role once set
        if (user.role) {
            return res.status(400).json({ error: `You are already registered as a ${user.role}` });
        }

        // Set role
        db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, userId);

        // If driver, save license
        if (role === 'driver') {
            db.prepare(`
        INSERT OR REPLACE INTO driver_licenses (user_id, license_no, issue_date, expiry_date)
        VALUES (?, ?, ?, ?)
      `).run(userId, licenseNo.trim(), issueDate || null, expiryDate || null);
        }

        // Fetch updated user
        const updatedUser = db.prepare(`SELECT id, username, gender, age, role FROM users WHERE id = ?`).get(userId);

        // Issue fresh token with new role
        const token = makeToken(updatedUser);

        res.json({
            success: true,
            token,
            user: userPayload(updatedUser),
            message: `You are now registered as a ${role} on DriveShare!`
        });
    } catch (err) {
        console.error('Set role error:', err);
        res.status(500).json({ error: 'Failed to set role' });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, (req, res) => {
    const db = getDb();
    const user = db.prepare(`SELECT id, username, gender, age, role, created_at FROM users WHERE id = ?`).get(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if driver has license info
    let hasLicense = false;
    if (user.role === 'driver') {
        const license = db.prepare(`SELECT id FROM driver_licenses WHERE user_id = ?`).get(user.id);
        hasLicense = !!license;
    }

    res.json({ user: { ...userPayload(user), created_at: user.created_at }, hasLicense });
});

module.exports = router;
