const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ─── TIME SLOT TO HOURS MAP ───────────────────────────────────────────────────
// Used to compute expires_at for rides and for filtering
const TIME_SLOT_HOURS = {
    'Early Morning': 5,
    'Morning': 9,
    'Afternoon': 13,
    'Evening': 17,
    'Night': 21
};

function computeExpiresAt(date, timeSlot) {
    const hour = TIME_SLOT_HOURS[timeSlot] ?? 12;
    // date is "YYYY-MM-DD"
    return `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

// ─── ROUTE OVERLAP LOGIC ──────────────────────────────────────────────────────
// Checks if a ride's route overlaps with the search query.
// Strategy: case-insensitive substring matching.
// Extensible: replace this function with geo-based logic (e.g. Google Maps API)
// without changing any route handlers.
function routeOverlaps(ride, searchSource, searchDest) {
    const rideSource = ride.source.toLowerCase();
    const rideDest = ride.destination.toLowerCase();
    const qSrc = searchSource.toLowerCase().trim();
    const qDst = searchDest.toLowerCase().trim();

    // Direct match
    if (
        (rideSource.includes(qSrc) || qSrc.includes(rideSource)) &&
        (rideDest.includes(qDst) || qDst.includes(rideDest))
    ) return true;

    // Overlap: search route is a sub-segment of ride route
    // e.g. ride: A→D, search: B→C  → if B and C are "along" the route
    // Simple heuristic: if either endpoint pair shows overlap
    if (
        (rideSource.includes(qSrc) || qSrc.includes(rideSource)) &&
        (rideDest.includes(qDst) || qDst.includes(rideDest))
    ) return true;

    // Reverse overlap check
    if (
        (rideDest.includes(qSrc) || qSrc.includes(rideDest)) ||
        (rideSource.includes(qDst) || qDst.includes(rideSource))
    ) {
        // At least one endpoint partially matches
        if (
            rideSource.includes(qSrc) || qSrc.includes(rideSource) ||
            rideDest.includes(qDst) || qDst.includes(rideDest)
        ) return true;
    }

    return false;
}

// ─── POST /api/rides/search ───────────────────────────────────────────────────
router.post('/search', authenticateToken, (req, res) => {
    try {
        const { source, destination, date, timeSlot, pinkMode } = req.body;
        if (!source || !destination) {
            return res.status(400).json({ error: 'Source and destination are required' });
        }

        const db = getDb();
        const now = new Date().toISOString();
        const userGender = req.user.gender;

        // Base query: non-expired rides with owner info (no phone ever exposed)
        let query = `
      SELECT 
        r.id, r.source, r.destination, r.date, r.time_slot, r.vehicle_type,
        r.seats_available, r.male_count, r.female_count, r.pink_mode,
        r.created_at, r.expires_at,
        u.username AS owner_username,
        u.gender AS owner_gender,
        (SELECT COUNT(*) FROM ride_members rm WHERE rm.ride_id = r.id) AS member_count
      FROM rides r
      JOIN users u ON r.user_id = u.id
      WHERE r.expires_at > ?
        AND r.user_id != ?
    `;
        const params = [now, req.user.userId];

        // Pink Mode filtering:
        // If pinkMode requested: show ONLY pink rides (female-only)
        // If not requested: hide pink rides from non-Female users
        if (pinkMode === true || pinkMode === 'true') {
            query += ` AND r.pink_mode = 1`;
        } else if (userGender !== 'Female') {
            // Non-female users don't see pink-only rides
            query += ` AND r.pink_mode = 0`;
        }

        if (date) {
            query += ` AND r.date = ?`;
            params.push(date);
        }

        if (timeSlot) {
            query += ` AND r.time_slot = ?`;
            params.push(timeSlot);
        }

        query += ` ORDER BY r.expires_at ASC`;

        const rides = db.prepare(query).all(...params);

        // Apply route overlap filter in JS (extensible)
        const matched = rides.filter(ride => routeOverlaps(ride, source, destination));

        res.json({ rides: matched });
    } catch (err) {
        console.error('Search rides error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ─── POST /api/rides/register ─────────────────────────────────────────────────
router.post('/register', authenticateToken, (req, res) => {
    try {
        const {
            source, destination, date, timeSlot, vehicleType,
            seatsAvailable, maleCount, femaleCount, pinkMode
        } = req.body;

        if (!source || !destination || !date || !timeSlot || !vehicleType || seatsAvailable === undefined) {
            return res.status(400).json({ error: 'All ride fields are required' });
        }

        const seats = parseInt(seatsAvailable);
        if (isNaN(seats) || seats < 1) {
            return res.status(400).json({ error: 'Seats available must be at least 1' });
        }

        // Pink mode validation: no males allowed
        const isPink = pinkMode === true || pinkMode === 'true' || pinkMode === 1;
        const males = parseInt(maleCount) || 0;
        const females = parseInt(femaleCount) || 0;

        if (isPink && males > 0) {
            return res.status(400).json({ error: 'Pink Mode rides cannot have male passengers' });
        }

        const db = getDb();
        const expiresAt = computeExpiresAt(date, timeSlot);

        // Check if time is already past
        if (new Date(expiresAt) <= new Date()) {
            return res.status(400).json({ error: 'Cannot register a ride for a past time' });
        }

        const result = db.prepare(`
      INSERT INTO rides (user_id, source, destination, date, time_slot, vehicle_type, seats_available, male_count, female_count, pink_mode, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            req.user.userId,
            source.trim(),
            destination.trim(),
            date,
            timeSlot,
            vehicleType,
            seats,
            isPink ? 0 : males,
            females,
            isPink ? 1 : 0,
            expiresAt
        );

        // Automatically add the owner as a member
        db.prepare(`INSERT OR IGNORE INTO ride_members (ride_id, user_id) VALUES (?, ?)`).run(
            result.lastInsertRowid, req.user.userId
        );

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(result.lastInsertRowid);
        res.status(201).json({ success: true, ride });
    } catch (err) {
        console.error('Register ride error:', err);
        res.status(500).json({ error: 'Failed to register ride' });
    }
});

// ─── POST /api/rides/:id/join ─────────────────────────────────────────────────
router.post('/:id/join', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();
        const now = new Date().toISOString();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ? AND expires_at > ?`).get(rideId, now);
        if (!ride) return res.status(404).json({ error: 'Ride not found or has expired' });

        // Pink mode enforcement: only Female users can join pink rides
        if (ride.pink_mode && req.user.gender !== 'Female') {
            return res.status(403).json({ error: 'This is a Pink Mode ride — only female riders can join' });
        }

        // Check not already member
        const alreadyMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`).get(rideId, req.user.userId);
        if (alreadyMember) return res.status(400).json({ error: 'You have already joined this ride' });

        // Check seats
        const memberCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;
        if (memberCount >= ride.seats_available) {
            return res.status(400).json({ error: 'No seats available in this ride' });
        }

        db.prepare(`INSERT INTO ride_members (ride_id, user_id) VALUES (?, ?)`).run(rideId, req.user.userId);

        const updatedCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;

        res.json({
            success: true,
            message: 'Successfully joined the ride',
            rideId,
            memberCount: updatedCount,
            chatEnabled: updatedCount > 1
        });
    } catch (err) {
        console.error('Join ride error:', err);
        res.status(500).json({ error: 'Failed to join ride' });
    }
});

// ─── GET /api/rides/my ────────────────────────────────────────────────────────
router.get('/my', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const now = new Date().toISOString();

        // Rides the user owns or has joined
        const rides = db.prepare(`
      SELECT DISTINCT
        r.id, r.source, r.destination, r.date, r.time_slot, r.vehicle_type,
        r.seats_available, r.male_count, r.female_count, r.pink_mode, r.expires_at,
        u.username AS owner_username,
        u.gender AS owner_gender,
        (SELECT COUNT(*) FROM ride_members rm WHERE rm.ride_id = r.id) AS member_count,
        CASE WHEN r.user_id = ? THEN 1 ELSE 0 END AS is_owner
      FROM rides r
      JOIN users u ON r.user_id = u.id
      JOIN ride_members rm2 ON rm2.ride_id = r.id AND rm2.user_id = ?
      WHERE r.expires_at > ?
      ORDER BY r.expires_at ASC
    `).all(req.user.userId, req.user.userId, now);

        res.json({ rides });
    } catch (err) {
        console.error('Get my rides error:', err);
        res.status(500).json({ error: 'Failed to fetch rides' });
    }
});

// ─── GET /api/rides/:id/members ───────────────────────────────────────────────
router.get('/:id/members', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        // Verify requester is a member
        const isMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`).get(rideId, req.user.userId);
        if (!isMember) return res.status(403).json({ error: 'You are not a member of this ride' });

        // Return members WITHOUT phone numbers
        const members = db.prepare(`
      SELECT u.id, u.username, u.gender, u.age, rm.joined_at
      FROM ride_members rm
      JOIN users u ON u.id = rm.user_id
      WHERE rm.ride_id = ?
      ORDER BY rm.joined_at ASC
    `).all(rideId);

        res.json({ members });
    } catch (err) {
        console.error('Get members error:', err);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// ─── GET /api/rides/:id/messages ─────────────────────────────────────────────
router.get('/:id/messages', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const isMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`).get(rideId, req.user.userId);
        if (!isMember) return res.status(403).json({ error: 'You are not a member of this ride' });

        const messages = db.prepare(`
      SELECT m.id, m.content, m.sent_at, u.username, u.gender
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.ride_id = ?
      ORDER BY m.sent_at ASC
    `).all(rideId);

        res.json({ messages });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
