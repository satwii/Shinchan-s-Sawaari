const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { validateAadhaar } = require('../utils/validateAadhaar');

const JWT_SECRET = process.env.JWT_SECRET || 'sawaari_secret';
const DEMO_OTP = '123456'; // Hardcoded Aadhaar OTP for demo
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

function makeToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, gender: user.gender, role: user.role || null },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function userPayload(user) {
    return {
        id: user.id,
        username: user.username,
        gender: user.gender,
        age: user.age,
        role: user.role || null,
        aadhaar_verified: !!user.aadhaar_verified,
        emergency_contact_name: user.emergency_contact_name || null,
        emergency_contact_phone: user.emergency_contact_phone || null,
        trip_count: user.trip_count || 0,
    };
}

function getPublicProfile(db, userId) {
    const user = db.prepare(`SELECT id, username, gender, aadhaar_verified, trip_count, created_at FROM users WHERE id = ?`).get(userId);
    if (!user) return null;

    // Compute average rating
    const ratingRow = db.prepare(`SELECT AVG(stars) as avg_rating, COUNT(*) as rating_count FROM ratings WHERE rated_user = ?`).get(userId);
    const avgRating = ratingRow?.avg_rating ? Math.round(ratingRow.avg_rating * 10) / 10 : null;
    const ratingCount = ratingRow?.rating_count || 0;

    // Compute badges
    const badges = [];
    if (user.aadhaar_verified) badges.push('Aadhaar Verified ✓');
    if ((user.trip_count || 0) < 3) badges.push('New to Sawaari 🌱');
    if ((user.trip_count || 0) > 10) badges.push('Verified Traveller ✓');

    return {
        id: user.id,
        username: user.username,
        gender: user.gender,
        aadhaar_verified: !!user.aadhaar_verified,
        trip_count: user.trip_count || 0,
        avg_rating: avgRating,
        rating_count: ratingCount,
        badges,
        created_at: user.created_at,
    };
}

// ─── POST /api/auth/check-phone ──────────────────────────────────────────────
// Step 1: Check if phone exists (returning user or new)
router.post('/check-phone', (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid phone number is required' });
        }

        const db = getDb();
        const existingUser = db.prepare(`SELECT id, username, aadhaar_verified FROM users WHERE phone = ?`).get(phone);

        res.json({
            success: true,
            isExistingUser: !!existingUser,
            isVerified: existingUser?.aadhaar_verified === 1,
            phone,
        });
    } catch (err) {
        console.error('Check phone error:', err);
        res.status(500).json({ error: 'Failed to check phone' });
    }
});

// ─── POST /api/auth/send-aadhaar-otp ─────────────────────────────────────────
// Step 2-3: Send OTP for Aadhaar verification (hardcoded 123456)
router.post('/send-aadhaar-otp', (req, res) => {
    try {
        const { phone, aadhaar } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });
        if (!aadhaar || !/^\d{12}$/.test(aadhaar)) {
            return res.status(400).json({ error: 'Valid 12-digit Aadhaar number is required' });
        }

        // Verhoeff checksum + pattern validation
        const result = validateAadhaar(aadhaar);
        if (!result.valid) {
            return res.status(400).json({ success: false, error: result.reason });
        }

        const db = getDb();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        // Invalidate previous OTPs for this phone
        db.prepare(`UPDATE otp_store SET used = 1 WHERE phone = ? AND used = 0`).run(phone);

        // Store the OTP (hardcoded 123456)
        db.prepare(`INSERT INTO otp_store (phone, otp, expires_at) VALUES (?, ?, ?)`)
            .run(phone, DEMO_OTP, expiresAt);

        console.log(`\n📲 [AADHAAR OTP SERVICE]`);
        console.log(`   Phone   : ${phone}`);
        console.log(`   Aadhaar : XXXX-XXXX-${aadhaar.slice(-4)}`);
        console.log(`   OTP     : ${DEMO_OTP}`);
        console.log(`   Valid for ${OTP_EXPIRY_MINUTES} minutes\n`);

        res.json({
            success: true,
            message: 'OTP sent to Aadhaar-linked mobile number',
            aadhaarLast4: aadhaar.slice(-4),
        });
    } catch (err) {
        console.error('Send Aadhaar OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// ─── POST /api/auth/verify-aadhaar-otp ───────────────────────────────────────
// Step 4: Verify the Aadhaar OTP
router.post('/verify-aadhaar-otp', (req, res) => {
    try {
        const { phone, otp, aadhaarLast4 } = req.body;
        if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

        const db = getDb();
        const otpRecord = db.prepare(`
            SELECT * FROM otp_store 
            WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `).get(phone, otp);

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Check if returning user
        const existingUser = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);

        if (existingUser && existingUser.username && existingUser.aadhaar_verified) {
            // Returning user — login directly
            db.prepare(`UPDATE otp_store SET used = 1 WHERE id = ?`).run(otpRecord.id);
            const token = makeToken(existingUser);
            return res.json({
                success: true,
                isLogin: true,
                token,
                user: userPayload(existingUser),
            });
        }

        // New user or partial registration — mark Aadhaar verified
        if (existingUser) {
            // Update existing partial user
            db.prepare(`UPDATE users SET aadhaar_last4 = ?, aadhaar_verified = 1 WHERE id = ?`)
                .run(aadhaarLast4 || '', existingUser.id);
        } else {
            // Create new user with phone + aadhaar only
            db.prepare(`INSERT INTO users (phone, aadhaar_last4, aadhaar_verified) VALUES (?, ?, 1)`)
                .run(phone, aadhaarLast4 || '');
        }

        // Keep OTP alive for registration completion
        res.json({
            success: true,
            isLogin: false,
            otpVerified: true,
            needsRegistration: true,
            phone,
        });
    } catch (err) {
        console.error('Verify Aadhaar OTP error:', err);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Step 5-6: Complete registration with profile + emergency contact
router.post('/register', (req, res) => {
    try {
        const { phone, otp, username, gender, age, emergencyContactName, emergencyContactPhone } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (!gender || !['Male', 'Female', 'Prefer not to say'].includes(gender)) {
            return res.status(400).json({ error: 'Valid gender is required' });
        }
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 15) {
            return res.status(400).json({ error: 'You must be at least 15 years old' });
        }
        if (!emergencyContactName || !emergencyContactName.trim()) {
            return res.status(400).json({ error: 'Emergency contact name is required' });
        }
        if (!emergencyContactPhone || !/^\+?[\d\s\-()]{7,15}$/.test(emergencyContactPhone)) {
            return res.status(400).json({ error: 'Valid emergency contact phone number is required' });
        }

        const db = getDb();

        // Verify OTP is still valid
        const otpRecord = db.prepare(`
            SELECT * FROM otp_store 
            WHERE phone = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `).get(phone, otp);

        if (!otpRecord) {
            return res.status(400).json({ error: 'OTP session expired. Please restart signup.' });
        }

        // Check username uniqueness
        const existingUsername = db.prepare(`SELECT id FROM users WHERE username = ? AND phone != ?`)
            .get(username.trim(), phone);
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken. Please choose another.' });
        }

        // Update the user record (created during OTP verification)
        const existingUser = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
        if (!existingUser) {
            return res.status(400).json({ error: 'No verified Aadhaar found. Please restart.' });
        }

        db.prepare(`
            UPDATE users SET 
                username = ?, gender = ?, age = ?, 
                emergency_contact_name = ?, emergency_contact_phone = ?
            WHERE id = ?
        `).run(
            username.trim(), gender, ageNum,
            emergencyContactName.trim(), emergencyContactPhone.trim(),
            existingUser.id
        );

        // Consume OTP
        db.prepare(`UPDATE otp_store SET used = 1 WHERE id = ?`).run(otpRecord.id);

        const newUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(existingUser.id);
        const token = makeToken(newUser);

        res.status(201).json({
            success: true,
            token,
            user: userPayload(newUser),
        });
    } catch (err) {
        console.error('Register error:', err);
        if (err.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ─── POST /api/auth/set-driveshare-role ───────────────────────────────────────
router.post('/set-driveshare-role', authenticateToken, (req, res) => {
    try {
        const { role, licenseNo, issueDate, expiryDate } = req.body;
        if (!['driver', 'rider'].includes(role)) {
            return res.status(400).json({ error: 'Role must be "driver" or "rider"' });
        }
        if (role === 'driver' && !licenseNo) {
            return res.status(400).json({ error: 'Drivers must provide a license number' });
        }

        const db = getDb();
        const userId = req.user.userId;
        const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.role) {
            return res.status(400).json({ error: `You are already registered as a ${user.role}` });
        }

        db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, userId);

        if (role === 'driver') {
            db.prepare(`
                INSERT OR REPLACE INTO driver_licenses (user_id, license_no, issue_date, expiry_date)
                VALUES (?, ?, ?, ?)
            `).run(userId, licenseNo.trim(), issueDate || null, expiryDate || null);
        }

        const updatedUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
        const token = makeToken(updatedUser);

        res.json({
            success: true, token,
            user: userPayload(updatedUser),
            message: `You are now registered as a ${role} on DriveShare!`,
        });
    } catch (err) {
        console.error('Set role error:', err);
        res.status(500).json({ error: 'Failed to set role' });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, (req, res) => {
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let hasLicense = false;
    if (user.role === 'driver') {
        const license = db.prepare(`SELECT id FROM driver_licenses WHERE user_id = ?`).get(user.id);
        hasLicense = !!license;
    }

    const profile = getPublicProfile(db, user.id);

    res.json({
        user: {
            ...userPayload(user),
            created_at: user.created_at,
            avg_rating: profile?.avg_rating,
            rating_count: profile?.rating_count,
            badges: profile?.badges,
        },
        hasLicense,
    });
});

// ─── GET /api/auth/profile/:userId ────────────────────────────────────────────
// Public profile — never returns phone or full aadhaar
router.get('/profile/:userId', authenticateToken, (req, res) => {
    const db = getDb();
    const profile = getPublicProfile(db, parseInt(req.params.userId));
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ profile });
});

// ─── POST /api/auth/update-emergency-contact ─────────────────────────────────
router.post('/update-emergency-contact', authenticateToken, (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Emergency contact name required' });
        if (!phone || !/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid emergency contact phone required' });
        }

        const db = getDb();
        db.prepare(`UPDATE users SET emergency_contact_name = ?, emergency_contact_phone = ? WHERE id = ?`)
            .run(name.trim(), phone.trim(), req.user.userId);

        res.json({ success: true, message: 'Emergency contact updated' });
    } catch (err) {
        console.error('Update emergency contact error:', err);
        res.status(500).json({ error: 'Failed to update emergency contact' });
    }
});

module.exports = router;
module.exports.getPublicProfile = getPublicProfile;
