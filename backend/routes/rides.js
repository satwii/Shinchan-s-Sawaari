const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function computeExpiresAt(date, rideTime) {
    // rideTime is HH:MM (24hr format)
    if (rideTime) {
        return `${date}T${rideTime}:00.000Z`;
    }
    return `${date}T23:59:59.000Z`;
}

// Haversine distance in kilometres between two lat/lng points
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MATCH_RADIUS_KM = 5; // rides within 5 km radius are considered overlapping

function routeOverlaps(ride, searchSource, searchDest, searchSrcLat, searchSrcLng, searchDstLat, searchDstLng) {
    // ── Coordinate-based matching (preferred) ─────────────────────────────
    const hasSrcCoords = searchSrcLat && searchSrcLng && ride.source_lat && ride.source_lng;
    const hasDstCoords = searchDstLat && searchDstLng && ride.destination_lat && ride.destination_lng;

    if (hasSrcCoords && hasDstCoords) {
        const srcDist = haversineKm(searchSrcLat, searchSrcLng, ride.source_lat, ride.source_lng);
        const dstDist = haversineKm(searchDstLat, searchDstLng, ride.destination_lat, ride.destination_lng);
        return srcDist <= MATCH_RADIUS_KM && dstDist <= MATCH_RADIUS_KM;
    }

    // ── String-based fallback ─────────────────────────────────────────────
    const rideSource = ride.source.toLowerCase();
    const rideDest = ride.destination.toLowerCase();
    const qSrc = searchSource.toLowerCase().trim();
    const qDst = searchDest.toLowerCase().trim();

    if (
        (rideSource.includes(qSrc) || qSrc.includes(rideSource)) &&
        (rideDest.includes(qDst) || qDst.includes(rideDest))
    ) return true;

    if (
        (rideDest.includes(qSrc) || qSrc.includes(rideDest)) ||
        (rideSource.includes(qDst) || qDst.includes(rideSource))
    ) {
        if (
            rideSource.includes(qSrc) || qSrc.includes(rideSource) ||
            rideDest.includes(qDst) || qDst.includes(rideDest)
        ) return true;
    }

    return false;
}

function getPublicProfile(db, userId) {
    const user = db.prepare(`SELECT id, username, gender, aadhaar_verified, trip_count, created_at FROM users WHERE id = ?`).get(userId);
    if (!user) return null;

    const ratingRow = db.prepare(`SELECT AVG(stars) as avg_rating, COUNT(*) as rating_count FROM ratings WHERE rated_user = ?`).get(userId);
    const avgRating = ratingRow?.avg_rating ? Math.round(ratingRow.avg_rating * 10) / 10 : null;
    const ratingCount = ratingRow?.rating_count || 0;

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
    };
}

// ─── POST /api/rides/search ──────────────────────────────────────────────────
router.post('/search', authenticateToken, (req, res) => {
    try {
        const { source, destination, date, timeSlot, pinkMode,
            sourceLat, sourceLng, destinationLat, destinationLng } = req.body;
        if (!source || !destination) {
            return res.status(400).json({ error: 'Source and destination are required' });
        }

        const db = getDb();
        const now = new Date().toISOString();
        const userGender = req.user.gender;

        let query = `
            SELECT 
                r.id, r.source, r.destination, r.date, r.time_slot, r.ride_time, r.vehicle_type,
                r.seats_available, r.male_count, r.female_count, r.pink_mode,
                r.created_at, r.expires_at, r.status, r.trip_started, r.trip_completed,
                r.source_lat, r.source_lng, r.destination_lat, r.destination_lng,
                u.username AS owner_username,
                u.gender AS owner_gender,
                u.id AS owner_id,
                (SELECT COUNT(*) FROM ride_members rm WHERE rm.ride_id = r.id) AS member_count
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE r.expires_at > ?
              AND r.user_id != ?
              AND r.trip_completed = 0
        `;
        const params = [now, req.user.userId];

        if (pinkMode === true || pinkMode === 'true') {
            query += ` AND r.pink_mode = 1`;
        } else if (userGender !== 'Female') {
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

        query += ` ORDER BY r.date ASC, r.ride_time ASC`;

        const rides = db.prepare(query).all(...params);
        const matched = rides.filter(ride => routeOverlaps(
            ride, source, destination,
            sourceLat ? parseFloat(sourceLat) : null,
            sourceLng ? parseFloat(sourceLng) : null,
            destinationLat ? parseFloat(destinationLat) : null,
            destinationLng ? parseFloat(destinationLng) : null
        ));

        // Add owner profile for each ride
        const enriched = matched.map(ride => {
            const ownerProfile = getPublicProfile(db, ride.owner_id);
            // Check if current user has a pending request
            const existingRequest = db.prepare(
                `SELECT status FROM ride_requests WHERE ride_id = ? AND requester_id = ?`
            ).get(ride.id, req.user.userId);

            return {
                ...ride,
                owner_profile: ownerProfile,
                user_request_status: existingRequest?.status || null,
            };
        });

        res.json({ rides: enriched });
    } catch (err) {
        console.error('Search rides error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ─── POST /api/rides/register ────────────────────────────────────────────────
router.post('/register', authenticateToken, (req, res) => {
    try {
        const {
            source, destination, date, timeSlot, rideTime, vehicleType,
            seatsAvailable, maleCount, femaleCount, pinkMode,
            sourceLat, sourceLng, destinationLat, destinationLng
        } = req.body;

        if (!source || !destination || !date || !vehicleType || seatsAvailable === undefined) {
            return res.status(400).json({ error: 'All ride fields are required' });
        }
        if (!rideTime && !timeSlot) {
            return res.status(400).json({ error: 'Ride time is required' });
        }

        const seats = parseInt(seatsAvailable);
        if (isNaN(seats) || seats < 1) {
            return res.status(400).json({ error: 'Seats available must be at least 1' });
        }

        const isPink = pinkMode === true || pinkMode === 'true' || pinkMode === 1;
        const males = parseInt(maleCount) || 0;
        const females = parseInt(femaleCount) || 0;

        if (isPink && males > 0) {
            return res.status(400).json({ error: 'Pink Mode rides cannot have male passengers' });
        }

        // Check emergency contact
        const db = getDb();
        const creator = db.prepare(`SELECT emergency_contact_name FROM users WHERE id = ?`).get(req.user.userId);
        if (!creator?.emergency_contact_name) {
            return res.status(400).json({ error: 'You must set up an emergency contact before creating a ride' });
        }

        // Compute time slot from ride time if not provided
        let finalTimeSlot = timeSlot || 'Custom';
        if (rideTime && !timeSlot) {
            const hour = parseInt(rideTime.split(':')[0]);
            if (hour < 6) finalTimeSlot = 'Early Morning';
            else if (hour < 12) finalTimeSlot = 'Morning';
            else if (hour < 16) finalTimeSlot = 'Afternoon';
            else if (hour < 20) finalTimeSlot = 'Evening';
            else finalTimeSlot = 'Night';
        }

        const expiresAt = computeExpiresAt(date, rideTime);
        const trackingToken = uuidv4();

        const result = db.prepare(`
            INSERT INTO rides (user_id, source, destination, date, time_slot, ride_time, vehicle_type, 
                seats_available, male_count, female_count, pink_mode, expires_at, tracking_token,
                source_lat, source_lng, destination_lat, destination_lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.user.userId,
            source.trim(), destination.trim(),
            date, finalTimeSlot, rideTime || null, vehicleType,
            seats, isPink ? 0 : males, females,
            isPink ? 1 : 0,
            expiresAt, trackingToken,
            sourceLat ? parseFloat(sourceLat) : null,
            sourceLng ? parseFloat(sourceLng) : null,
            destinationLat ? parseFloat(destinationLat) : null,
            destinationLng ? parseFloat(destinationLng) : null
        );

        // Auto-add owner as member
        db.prepare(`INSERT OR IGNORE INTO ride_members (ride_id, user_id) VALUES (?, ?)`)
            .run(result.lastInsertRowid, req.user.userId);

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(result.lastInsertRowid);
        res.status(201).json({ success: true, ride });
    } catch (err) {
        console.error('Register ride error:', err);
        res.status(500).json({ error: 'Failed to register ride' });
    }
});

// ─── GET /api/rides/:id ──────────────────────────────────────────────────────
// Ride detail page
router.get('/:id/detail', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const ride = db.prepare(`
            SELECT r.*, u.username AS owner_username, u.gender AS owner_gender, u.id AS owner_id
            FROM rides r JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `).get(rideId);

        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        const ownerProfile = getPublicProfile(db, ride.owner_id);

        // Get all members with their public profiles
        const members = db.prepare(`
            SELECT u.id, u.username, u.gender, u.aadhaar_verified, u.trip_count, rm.joined_at
            FROM ride_members rm JOIN users u ON u.id = rm.user_id
            WHERE rm.ride_id = ? ORDER BY rm.joined_at ASC
        `).all(rideId);

        const memberProfiles = members.map(m => ({
            ...getPublicProfile(db, m.id),
            joined_at: m.joined_at,
        }));

        // Check current user status
        const isMember = members.some(m => m.id === req.user.userId);
        const isOwner = ride.user_id === req.user.userId;
        const existingRequest = db.prepare(
            `SELECT status FROM ride_requests WHERE ride_id = ? AND requester_id = ?`
        ).get(rideId, req.user.userId);

        const memberCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;

        res.json({
            ride: {
                ...ride,
                member_count: memberCount,
            },
            owner_profile: ownerProfile,
            members: memberProfiles,
            is_member: isMember,
            is_owner: isOwner,
            user_request_status: existingRequest?.status || null,
        });
    } catch (err) {
        console.error('Get ride detail error:', err);
        res.status(500).json({ error: 'Failed to fetch ride details' });
    }
});

// ─── POST /api/rides/:id/request ─────────────────────────────────────────────
// Request to join a ride
router.post('/:id/request', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();
        const now = new Date().toISOString();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ? AND expires_at > ?`).get(rideId, now);
        if (!ride) return res.status(404).json({ error: 'Ride not found or has expired' });

        if (ride.trip_started) return res.status(400).json({ error: 'Cannot join a ride that has already started' });
        if (ride.trip_completed) return res.status(400).json({ error: 'This ride is completed' });

        // Pink mode enforcement
        if (ride.pink_mode && req.user.gender !== 'Female') {
            return res.status(403).json({ error: 'This is a Pink Mode ride — only female riders can join' });
        }

        // Check not already member
        const alreadyMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`)
            .get(rideId, req.user.userId);
        if (alreadyMember) return res.status(400).json({ error: 'You are already a member of this ride' });

        // Check no existing pending request
        const existingRequest = db.prepare(`SELECT * FROM ride_requests WHERE ride_id = ? AND requester_id = ?`)
            .get(rideId, req.user.userId);

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return res.status(400).json({ error: 'You already have a pending request for this ride' });
            }
            if (existingRequest.status === 'declined') {
                return res.status(400).json({ error: 'Your previous request was declined' });
            }
        }

        // Check emergency contact
        const user = db.prepare(`SELECT emergency_contact_name FROM users WHERE id = ?`).get(req.user.userId);
        if (!user?.emergency_contact_name) {
            return res.status(400).json({ error: 'You must set up an emergency contact before joining a ride' });
        }

        // Check seats
        const memberCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;
        if (memberCount >= ride.seats_available) {
            return res.status(400).json({ error: 'No seats available in this ride' });
        }

        db.prepare(`INSERT INTO ride_requests (ride_id, requester_id, status) VALUES (?, ?, 'pending')`)
            .run(rideId, req.user.userId);

        res.json({
            success: true,
            message: 'Request sent! Waiting for ride owner approval.',
            status: 'pending',
        });
    } catch (err) {
        console.error('Request ride error:', err);
        if (err.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'You already have a request for this ride' });
        }
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// ─── GET /api/rides/:id/requests ─────────────────────────────────────────────
// Get pending requests for a ride (ride owner only)
router.get('/:id/requests', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const ride = db.prepare(`SELECT user_id FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Only the ride owner can view requests' });
        }

        const requests = db.prepare(`
            SELECT rr.id, rr.requester_id, rr.status, rr.requested_at,
                   u.username, u.gender, u.aadhaar_verified, u.trip_count
            FROM ride_requests rr
            JOIN users u ON u.id = rr.requester_id
            WHERE rr.ride_id = ?
            ORDER BY rr.requested_at DESC
        `).all(rideId);

        const enriched = requests.map(r => ({
            ...r,
            profile: getPublicProfile(db, r.requester_id),
        }));

        res.json({ requests: enriched });
    } catch (err) {
        console.error('Get requests error:', err);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// ─── POST /api/rides/:id/requests/:requestId/respond ─────────────────────────
// Accept or decline a join request
router.post('/:id/requests/:requestId/respond', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const requestId = parseInt(req.params.requestId);
        const { action } = req.body; // 'accept' or 'decline'

        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ error: 'Action must be "accept" or "decline"' });
        }

        const db = getDb();
        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Only the ride owner can respond to requests' });
        }

        const request = db.prepare(`SELECT * FROM ride_requests WHERE id = ? AND ride_id = ?`)
            .get(requestId, rideId);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'This request has already been responded to' });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'declined';
        db.prepare(`UPDATE ride_requests SET status = ?, responded_at = datetime('now') WHERE id = ?`)
            .run(newStatus, requestId);

        if (action === 'accept') {
            // Check seats
            const memberCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;
            if (memberCount >= ride.seats_available) {
                // Revert
                db.prepare(`UPDATE ride_requests SET status = 'pending', responded_at = NULL WHERE id = ?`)
                    .run(requestId);
                return res.status(400).json({ error: 'No seats available' });
            }

            db.prepare(`INSERT OR IGNORE INTO ride_members (ride_id, user_id) VALUES (?, ?)`)
                .run(rideId, request.requester_id);
        }

        const updatedCount = db.prepare(`SELECT COUNT(*) as cnt FROM ride_members WHERE ride_id = ?`).get(rideId).cnt;

        res.json({
            success: true,
            message: action === 'accept' ? 'Request accepted!' : 'Request declined.',
            member_count: updatedCount,
        });
    } catch (err) {
        console.error('Respond to request error:', err);
        res.status(500).json({ error: 'Failed to respond to request' });
    }
});

// ─── POST /api/rides/:id/remove-member ───────────────────────────────────────
router.post('/:id/remove-member', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const { userId } = req.body;
        const db = getDb();

        const ride = db.prepare(`SELECT user_id FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Only the ride owner can remove members' });
        }
        if (userId === req.user.userId) {
            return res.status(400).json({ error: 'Cannot remove yourself' });
        }

        db.prepare(`DELETE FROM ride_members WHERE ride_id = ? AND user_id = ?`).run(rideId, userId);
        db.prepare(`UPDATE ride_requests SET status = 'declined' WHERE ride_id = ? AND requester_id = ?`)
            .run(rideId, userId);

        res.json({ success: true, message: 'Member removed' });
    } catch (err) {
        console.error('Remove member error:', err);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// ─── POST /api/rides/:id/start-trip ──────────────────────────────────────────
router.post('/:id/start-trip', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const { vehicleReg } = req.body;
        const db = getDb();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Only the ride owner can start the trip' });
        }
        if (ride.trip_started) {
            return res.status(400).json({ error: 'Trip has already started' });
        }

        // Validate vehicle reg
        if (!vehicleReg || vehicleReg.trim().length < 6) {
            return res.status(400).json({ error: 'Valid vehicle registration number is required (min 6 chars)' });
        }
        if (!/[a-zA-Z]/.test(vehicleReg) || !/\d/.test(vehicleReg)) {
            return res.status(400).json({ error: 'Vehicle registration must contain both letters and numbers' });
        }

        const now = new Date().toISOString();

        db.prepare(`
            UPDATE rides SET trip_started = 1, trip_started_at = ?, vehicle_reg = ?, status = 'active'
            WHERE id = ?
        `).run(now, vehicleReg.trim().toUpperCase(), rideId);

        // Create audit log
        const members = db.prepare(`
            SELECT u.id, u.aadhaar_last4 FROM ride_members rm 
            JOIN users u ON u.id = rm.user_id WHERE rm.ride_id = ?
        `).all(rideId);

        const memberIds = members.map(m => m.id);
        const memberAadhaars = members.map(m => m.aadhaar_last4 ? `XXXX-XXXX-${m.aadhaar_last4}` : 'N/A');

        db.prepare(`
            INSERT INTO ride_audit_log (ride_id, started_at, source, destination, vehicle_reg, owner_user_id, member_aadhaars, member_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            rideId, now, ride.source, ride.destination,
            vehicleReg.trim().toUpperCase(), req.user.userId,
            JSON.stringify(memberAadhaars), JSON.stringify(memberIds)
        );

        res.json({ success: true, message: 'Trip started!', tracking_token: ride.tracking_token });
    } catch (err) {
        console.error('Start trip error:', err);
        res.status(500).json({ error: 'Failed to start trip' });
    }
});

// ─── POST /api/rides/:id/complete-trip ───────────────────────────────────────
router.post('/:id/complete-trip', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });
        if (ride.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Only the ride owner can complete the trip' });
        }
        if (!ride.trip_started) {
            return res.status(400).json({ error: 'Trip has not started yet' });
        }
        if (ride.trip_completed) {
            return res.status(400).json({ error: 'Trip is already completed' });
        }

        const now = new Date().toISOString();
        db.prepare(`UPDATE rides SET trip_completed = 1, trip_completed_at = ?, status = 'completed' WHERE id = ?`)
            .run(now, rideId);

        // Increment trip_count for all members
        const members = db.prepare(`SELECT user_id FROM ride_members WHERE ride_id = ?`).all(rideId);
        for (const m of members) {
            db.prepare(`UPDATE users SET trip_count = trip_count + 1 WHERE id = ?`).run(m.user_id);
        }

        res.json({ success: true, message: 'Trip completed!' });
    } catch (err) {
        console.error('Complete trip error:', err);
        res.status(500).json({ error: 'Failed to complete trip' });
    }
});

// ─── POST /api/rides/:id/track ───────────────────────────────────────────────
// Store GPS location update
router.post('/:id/track', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const { lat, lng } = req.body;
        const db = getDb();

        if (lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'lat and lng are required' });
        }

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ? AND trip_started = 1 AND trip_completed = 0`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Active ride not found' });

        db.prepare(`INSERT INTO ride_tracking (ride_id, lat, lng) VALUES (?, ?, ?)`)
            .run(rideId, lat, lng);

        res.json({ success: true });
    } catch (err) {
        console.error('Track error:', err);
        res.status(500).json({ error: 'Failed to save location' });
    }
});

// ─── GET /api/rides/:id/tracking ─────────────────────────────────────────────
// Get latest GPS position for a ride
router.get('/:id/tracking', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const latest = db.prepare(`
            SELECT lat, lng, timestamp FROM ride_tracking 
            WHERE ride_id = ? ORDER BY timestamp DESC LIMIT 1
        `).get(rideId);

        const history = db.prepare(`
            SELECT lat, lng, timestamp FROM ride_tracking 
            WHERE ride_id = ? ORDER BY timestamp ASC
        `).all(rideId);

        res.json({ latest, history });
    } catch (err) {
        console.error('Get tracking error:', err);
        res.status(500).json({ error: 'Failed to fetch tracking data' });
    }
});

// ─── GET /api/rides/track/:token ─────────────────────────────────────────────
// Public tracking via shareable link (no auth required)
router.get('/track/:token', (req, res) => {
    try {
        const token = req.params.token;
        const db = getDb();

        const ride = db.prepare(`
            SELECT r.id, r.source, r.destination, r.date, r.ride_time, r.vehicle_type,
                   r.trip_started, r.trip_completed, r.vehicle_reg, r.tracking_token,
                   u.username AS owner_username
            FROM rides r JOIN users u ON r.user_id = u.id
            WHERE r.tracking_token = ?
        `).get(token);

        if (!ride) return res.status(404).json({ error: 'Tracking link not found' });

        // Check if tracking should still be active (ride time + 3 hours)
        const latest = db.prepare(`
            SELECT lat, lng, timestamp FROM ride_tracking 
            WHERE ride_id = ? ORDER BY timestamp DESC LIMIT 1
        `).get(ride.id);

        const history = db.prepare(`
            SELECT lat, lng, timestamp FROM ride_tracking 
            WHERE ride_id = ? ORDER BY timestamp ASC
        `).all(ride.id);

        res.json({
            ride: {
                source: ride.source,
                destination: ride.destination,
                date: ride.date,
                ride_time: ride.ride_time,
                vehicle_type: ride.vehicle_type,
                trip_started: !!ride.trip_started,
                trip_completed: !!ride.trip_completed,
                vehicle_reg: ride.vehicle_reg,
                owner_username: ride.owner_username,
            },
            latest,
            history,
        });
    } catch (err) {
        console.error('Public tracking error:', err);
        res.status(500).json({ error: 'Failed to fetch tracking' });
    }
});

// ─── GET /api/rides/my ───────────────────────────────────────────────────────
router.get('/my', authenticateToken, (req, res) => {
    try {
        const db = getDb();

        const rides = db.prepare(`
            SELECT DISTINCT
                r.id, r.source, r.destination, r.date, r.time_slot, r.ride_time, r.vehicle_type,
                r.seats_available, r.male_count, r.female_count, r.pink_mode, r.expires_at,
                r.status, r.trip_started, r.trip_started_at, r.trip_completed, r.trip_completed_at,
                r.vehicle_reg, r.tracking_token,
                u.username AS owner_username,
                u.gender AS owner_gender,
                (SELECT COUNT(*) FROM ride_members rm WHERE rm.ride_id = r.id) AS member_count,
                CASE WHEN r.user_id = ? THEN 1 ELSE 0 END AS is_owner,
                (SELECT COUNT(*) FROM ride_requests rr WHERE rr.ride_id = r.id AND rr.status = 'pending') AS pending_requests
            FROM rides r
            JOIN users u ON r.user_id = u.id
            JOIN ride_members rm2 ON rm2.ride_id = r.id AND rm2.user_id = ?
            ORDER BY r.date DESC, r.ride_time DESC
        `).all(req.user.userId, req.user.userId);

        res.json({ rides });
    } catch (err) {
        console.error('Get my rides error:', err);
        res.status(500).json({ error: 'Failed to fetch rides' });
    }
});

// ─── GET /api/rides/:id/members ──────────────────────────────────────────────
router.get('/:id/members', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const members = db.prepare(`
            SELECT u.id, u.username, u.gender, u.age, u.aadhaar_verified, u.trip_count, rm.joined_at
            FROM ride_members rm
            JOIN users u ON u.id = rm.user_id
            WHERE rm.ride_id = ?
            ORDER BY rm.joined_at ASC
        `).all(rideId);

        const enriched = members.map(m => ({
            ...m,
            profile: getPublicProfile(db, m.id),
        }));

        res.json({ members: enriched });
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

        const isMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`)
            .get(rideId, req.user.userId);
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

// ─── POST /api/rides/:id/rate ────────────────────────────────────────────────
router.post('/:id/rate', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const { ratings } = req.body; // [{userId, stars}]
        const db = getDb();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        // Verify user is a member
        const isMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`)
            .get(rideId, req.user.userId);
        if (!isMember) return res.status(403).json({ error: 'You are not a member of this ride' });

        if (!Array.isArray(ratings) || ratings.length === 0) {
            return res.status(400).json({ error: 'Ratings are required' });
        }

        for (const r of ratings) {
            if (!r.userId || !r.stars || r.stars < 1 || r.stars > 5) continue;
            if (r.userId === req.user.userId) continue; // Can't rate yourself

            try {
                db.prepare(`
                    INSERT OR REPLACE INTO ratings (ride_id, rated_by, rated_user, stars) 
                    VALUES (?, ?, ?, ?)
                `).run(rideId, req.user.userId, r.userId, r.stars);
            } catch (e) {
                // Ignore duplicate
            }
        }

        res.json({ success: true, message: 'Ratings submitted!' });
    } catch (err) {
        console.error('Rate error:', err);
        res.status(500).json({ error: 'Failed to submit ratings' });
    }
});

// ─── GET /api/rides/:id/sos-data ─────────────────────────────────────────────
// Get SOS data for emergency alert
router.get('/:id/sos-data', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.userId);

        // Get all members' names
        const members = db.prepare(`
            SELECT u.username FROM ride_members rm 
            JOIN users u ON u.id = rm.user_id 
            WHERE rm.ride_id = ? AND u.id != ?
        `).all(rideId, req.user.userId);

        res.json({
            userName: user.username,
            emergencyContact: {
                name: user.emergency_contact_name,
                phone: user.emergency_contact_phone,
            },
            vehicleReg: ride.vehicle_reg || 'Not yet entered',
            coPassengers: members.map(m => m.username),
            source: ride.source,
            destination: ride.destination,
        });
    } catch (err) {
        console.error('SOS data error:', err);
        res.status(500).json({ error: 'Failed to fetch SOS data' });
    }
});

// ─── GET /api/rides/:id/check-ratings ────────────────────────────────────────
router.get('/:id/check-ratings', authenticateToken, (req, res) => {
    try {
        const rideId = parseInt(req.params.id);
        const db = getDb();

        const existing = db.prepare(`SELECT rated_user FROM ratings WHERE ride_id = ? AND rated_by = ?`)
            .all(rideId, req.user.userId);
        const ratedUserIds = existing.map(r => r.rated_user);

        res.json({ ratedUserIds });
    } catch (err) {
        console.error('Check ratings error:', err);
        res.status(500).json({ error: 'Failed to check ratings' });
    }
});

module.exports = router;
