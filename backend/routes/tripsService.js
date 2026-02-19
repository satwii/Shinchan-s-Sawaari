const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getStatusId(db, name) {
    const row = db.prepare(`SELECT id FROM trip_status WHERE name = ?`).get(name);
    return row ? row.id : null;
}

// Mark trips as Completed if date is past
function autoCompletePastTrips(db) {
    const completedId = getStatusId(db, 'Completed');
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
    UPDATE trips SET status_id = ? 
    WHERE trip_date < ? AND status_id != ? AND status_id != (SELECT id FROM trip_status WHERE name='Cancelled')
  `).run(completedId, today, completedId);
}

// Cancel bookings whose payment window expired; restore seats
function cancelExpiredBookings(db) {
    const now = new Date().toISOString();
    const expired = db.prepare(`
    SELECT id, trip_id, seats_booked FROM bookings
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?
  `).all(now);

    const openId = getStatusId(db, 'Open');
    const fullId = getStatusId(db, 'Full');

    for (const b of expired) {
        db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(b.id);
        db.prepare(`UPDATE trips SET available_seats = available_seats + ? WHERE id = ?`).run(b.seats_booked, b.trip_id);
        // Restore trip to Open if it was Full
        db.prepare(`UPDATE trips SET status_id = ? WHERE id = ? AND status_id = ?`).run(openId, b.trip_id, fullId);
    }
}

// ─── VEHICLE ROUTES ───────────────────────────────────────────────────────────

// POST /api/trips-service/vehicles — Driver adds a vehicle
router.post('/vehicles', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Only drivers can add vehicles' });
    try {
        const { model, type, color, capacity } = req.body;
        if (!model || !type || !capacity) return res.status(400).json({ error: 'Model, type, and capacity are required' });

        const db = getDb();
        const result = db.prepare(`
      INSERT INTO vehicles (driver_id, model, type, color, capacity) VALUES (?, ?, ?, ?, ?)
    `).run(req.user.userId, model.trim(), type.trim(), color?.trim() || '', parseInt(capacity));

        res.status(201).json({ success: true, vehicle_id: result.lastInsertRowid });
    } catch (err) {
        console.error('Add vehicle error:', err);
        res.status(500).json({ error: 'Failed to add vehicle' });
    }
});

// GET /api/trips-service/vehicles — Driver's vehicles
router.get('/vehicles', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Driver only' });
    try {
        const db = getDb();
        const vehicles = db.prepare(`SELECT * FROM vehicles WHERE driver_id = ?`).all(req.user.userId);
        res.json({ vehicles });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

// ─── TRIP ROUTES ──────────────────────────────────────────────────────────────

// GET /api/trips-service/trips — Public: search all open/full trips
router.get('/trips', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        autoCompletePastTrips(db);
        cancelExpiredBookings(db);

        const { source, destination, pink_mode } = req.query;
        const userGender = req.user.gender;

        let query = `
      SELECT t.id, t.source, t.destination, t.trip_date, t.trip_time,
             t.available_seats, t.price_per_seat, t.pink_mode,
             ts.name AS status_name,
             v.model, v.type AS vehicle_type, v.color, v.capacity,
             u.username AS driver_name, u.gender AS driver_gender
      FROM trips t
      JOIN trip_status ts ON ts.id = t.status_id
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN users u ON u.id = v.driver_id
      WHERE ts.name NOT IN ('Cancelled','Completed')
    `;
        const params = [];

        if (source && destination) {
            query += ` AND (LOWER(t.source) LIKE LOWER('%' || ? || '%') OR LOWER(?) LIKE LOWER('%' || t.source || '%'))
                      AND (LOWER(t.destination) LIKE LOWER('%' || ? || '%') OR LOWER(?) LIKE LOWER('%' || t.destination || '%'))`;
            params.push(source, source, destination, destination);
        }

        // Pink mode filtering:
        // If pink_mode=true requested: show ONLY pink trips (and only if user is Female)
        // If pink_mode not requested: hide pink trips from non-Female users
        if (pink_mode === 'true' || pink_mode === '1') {
            query += ` AND t.pink_mode = 1`;
        } else if (userGender !== 'Female') {
            // Non-female users don't see pink-only trips (unless they created them)
            query += ` AND (t.pink_mode = 0 OR v.driver_id = ?)`;
            params.push(req.user.userId);
        }

        query += ` ORDER BY t.trip_date ASC, t.trip_time ASC`;

        const trips = db.prepare(query).all(...params);
        res.json({ trips });
    } catch (err) {
        console.error('Get trips error:', err);
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// GET /api/trips-service/trips/:id — Single trip
router.get('/trips/:id', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        autoCompletePastTrips(db);
        cancelExpiredBookings(db);

        const trip = db.prepare(`
      SELECT t.id, t.source, t.destination, t.trip_date, t.trip_time,
             t.available_seats, t.price_per_seat, t.pink_mode,
             ts.name AS status_name,
             v.id AS vehicle_id, v.model, v.type AS vehicle_type, v.color, v.capacity,
             u.username AS driver_name, u.gender AS driver_gender
      FROM trips t
      JOIN trip_status ts ON ts.id = t.status_id
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN users u ON u.id = v.driver_id
      WHERE t.id = ? AND ts.name NOT IN ('Cancelled','Completed')
    `).get(parseInt(req.params.id));

        if (!trip) return res.status(404).json({ error: 'Trip not found or unavailable' });
        res.json({ trip });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trip' });
    }
});

// POST /api/trips-service/trips — Driver creates trip
router.post('/trips', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Only drivers can create trips' });
    try {
        const { vehicle_id, source, destination, date, time, available_seats, price, pink_mode } = req.body;
        if (!vehicle_id || !source || !destination || !date || !time || !available_seats) {
            return res.status(400).json({ error: 'All trip fields are required' });
        }

        const db = getDb();

        // Ensure vehicle belongs to this driver
        const vehicle = db.prepare(`SELECT id FROM vehicles WHERE id = ? AND driver_id = ?`).get(parseInt(vehicle_id), req.user.userId);
        if (!vehicle) return res.status(403).json({ error: 'Vehicle not found or unauthorized' });

        const openId = getStatusId(db, 'Open');
        const result = db.prepare(`
      INSERT INTO trips (vehicle_id, source, destination, trip_date, trip_time, available_seats, price_per_seat, status_id, pink_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(parseInt(vehicle_id), source.trim(), destination.trim(), date, time, parseInt(available_seats), parseFloat(price) || 0, openId, pink_mode ? 1 : 0);

        res.status(201).json({ success: true, trip_id: result.lastInsertRowid });
    } catch (err) {
        console.error('Create trip error:', err);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

// GET /api/trips-service/driver/trips — Driver's own trips
router.get('/driver/trips', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Driver only' });
    try {
        const db = getDb();
        autoCompletePastTrips(db);
        const trips = db.prepare(`
      SELECT t.id, t.source, t.destination, t.trip_date, t.trip_time,
             t.available_seats, t.price_per_seat, t.pink_mode,
             ts.name AS status_name,
             v.model, v.type AS vehicle_type
      FROM trips t
      JOIN trip_status ts ON ts.id = t.status_id
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE v.driver_id = ?
      ORDER BY t.trip_date DESC, t.trip_time DESC
    `).all(req.user.userId);
        res.json({ trips });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// GET /api/trips-service/driver/stats — Driver earnings & trip summary
router.get('/driver/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Driver only' });
    try {
        const db = getDb();
        autoCompletePastTrips(db);
        cancelExpiredBookings(db);
        const today = new Date().toISOString().split('T')[0];

        const { earnings } = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) AS earnings
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      JOIN trips t ON t.id = b.trip_id
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE v.driver_id = ? AND p.status = 'Completed'
    `).get(req.user.userId);

        const { total_trips } = db.prepare(`
      SELECT COUNT(*) AS total_trips FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN trip_status ts ON ts.id = t.status_id
      WHERE v.driver_id = ? AND ts.name IN ('Open','Full')
    `).get(req.user.userId);

        const todays_trips = db.prepare(`
      SELECT t.id, t.source, t.destination, t.trip_date, t.trip_time, t.available_seats, t.pink_mode, ts.name AS status_name
      FROM trips t JOIN vehicles v ON v.id = t.vehicle_id JOIN trip_status ts ON ts.id = t.status_id
      WHERE v.driver_id = ? AND t.trip_date = ? AND ts.name IN ('Open','Full')
    `).all(req.user.userId, today);

        const upcoming_trips = db.prepare(`
      SELECT t.id, t.source, t.destination, t.trip_date, t.trip_time, t.available_seats, t.pink_mode, ts.name AS status_name
      FROM trips t JOIN vehicles v ON v.id = t.vehicle_id JOIN trip_status ts ON ts.id = t.status_id
      WHERE v.driver_id = ? AND t.trip_date > ? AND ts.name IN ('Open','Full')
      ORDER BY t.trip_date ASC, t.trip_time ASC
    `).all(req.user.userId, today);

        res.json({ earnings, total_trips, todays_trips, upcoming_trips });
    } catch (err) {
        console.error('Driver stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/trips-service/driver/bookings — All bookings for driver's trips
router.get('/driver/bookings', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Driver only' });
    try {
        const db = getDb();
        const bookings = db.prepare(`
      SELECT b.id AS booking_id, b.seats_booked, b.status, b.booking_date,
             u.username AS rider_name,
             t.source, t.destination, t.trip_date, t.trip_time, t.available_seats
      FROM bookings b
      JOIN trips t ON t.id = b.trip_id
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN users u ON u.id = b.rider_id
      WHERE v.driver_id = ?
      ORDER BY b.booking_date DESC
    `).all(req.user.userId);
        res.json({ bookings });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch driver bookings' });
    }
});

// PUT /api/trips-service/driver/trips/:id/cancel — Driver cancels trip
router.put('/driver/trips/:id/cancel', authenticateToken, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Driver only' });
    try {
        const tripId = parseInt(req.params.id);
        const db = getDb();

        const trip = db.prepare(`
      SELECT t.id FROM trips t JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.id = ? AND v.driver_id = ?
    `).get(tripId, req.user.userId);
        if (!trip) return res.status(404).json({ error: 'Trip not found or unauthorized' });

        // Cancel all pending/confirmed bookings for this trip
        db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE trip_id = ? AND status != 'cancelled'`).run(tripId);

        // Refund payments
        db.prepare(`
      UPDATE payments SET status = 'Refunded'
      WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = ?) AND status = 'Completed'
    `).run(tripId);

        const cancelledId = getStatusId(db, 'Cancelled');
        db.prepare(`UPDATE trips SET status_id = ? WHERE id = ?`).run(cancelledId, tripId);

        res.json({ success: true, message: 'Trip cancelled, all bookings refunded' });
    } catch (err) {
        console.error('Cancel trip error:', err);
        res.status(500).json({ error: 'Failed to cancel trip' });
    }
});

// ─── BOOKING ROUTES ───────────────────────────────────────────────────────────

// POST /api/trips-service/bookings — Rider books seats (creates pending booking)
router.post('/bookings', authenticateToken, (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Only riders can book trips' });
    try {
        const { trip_id, seats } = req.body;
        const seatsReq = parseInt(seats) || 1;
        const db = getDb();

        cancelExpiredBookings(db);

        const trip = db.prepare(`
      SELECT t.*, ts.name AS status_name FROM trips t
      JOIN trip_status ts ON ts.id = t.status_id
      WHERE t.id = ? AND ts.name NOT IN ('Cancelled','Completed')
    `).get(parseInt(trip_id));

        if (!trip) return res.status(404).json({ error: 'Trip not found or unavailable' });
        if (trip.available_seats < seatsReq) return res.status(400).json({ error: 'Not enough seats available' });

        // Pink mode enforcement: only Female users can book pink trips
        if (trip.pink_mode && req.user.gender !== 'Female') {
            return res.status(403).json({ error: 'This is a Pink Mode trip — only female riders can book' });
        }

        // Check rider not already booked
        const existing = db.prepare(`SELECT id FROM bookings WHERE trip_id = ? AND rider_id = ? AND status != 'cancelled'`).get(parseInt(trip_id), req.user.userId);
        if (existing) return res.status(400).json({ error: 'You already have an active booking for this trip' });

        // 30-second payment window
        const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

        const result = db.prepare(`
      INSERT INTO bookings (trip_id, rider_id, seats_booked, status, expires_at) VALUES (?, ?, ?, 'pending', ?)
    `).run(parseInt(trip_id), req.user.userId, seatsReq, expiresAt);

        // Lock seats immediately
        db.prepare(`UPDATE trips SET available_seats = available_seats - ? WHERE id = ?`).run(seatsReq, parseInt(trip_id));

        // Mark as Full if no seats left
        const updatedTrip = db.prepare(`SELECT available_seats FROM trips WHERE id = ?`).get(parseInt(trip_id));
        if (updatedTrip.available_seats <= 0) {
            const fullId = getStatusId(db, 'Full');
            db.prepare(`UPDATE trips SET status_id = ? WHERE id = ?`).run(fullId, parseInt(trip_id));
        }

        res.status(201).json({
            success: true,
            booking_id: result.lastInsertRowid,
            expires_at: expiresAt,
            total_amount: seatsReq * trip.price_per_seat,
            message: 'Booking created. Complete payment within 30 seconds.'
        });
    } catch (err) {
        console.error('Book trip error:', err);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// GET /api/trips-service/rider/bookings — Rider's bookings
router.get('/rider/bookings', authenticateToken, (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Rider only' });
    try {
        const db = getDb();
        autoCompletePastTrips(db);
        cancelExpiredBookings(db);

        const bookings = db.prepare(`
      SELECT b.id AS booking_id, b.seats_booked, b.status, b.booking_date, b.expires_at,
             t.id AS trip_id, t.source, t.destination, t.trip_date, t.trip_time, t.price_per_seat,
             ts.name AS trip_status,
             u.username AS driver_name,
             p.id AS payment_id, p.amount, p.mode AS payment_mode, p.status AS payment_status
      FROM bookings b
      JOIN trips t ON t.id = b.trip_id
      JOIN trip_status ts ON ts.id = t.status_id
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN users u ON u.id = v.driver_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.rider_id = ?
      ORDER BY b.booking_date DESC
    `).all(req.user.userId);

        res.json({ bookings });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// PUT /api/trips-service/rider/bookings/:id/cancel — Rider cancels booking
router.put('/rider/bookings/:id/cancel', authenticateToken, (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Rider only' });
    try {
        const bookingId = parseInt(req.params.id);
        const db = getDb();

        const booking = db.prepare(`
      SELECT b.id, b.trip_id, b.seats_booked FROM bookings b
      WHERE b.id = ? AND b.rider_id = ? AND b.status != 'cancelled'
    `).get(bookingId, req.user.userId);

        if (!booking) return res.status(404).json({ error: 'Booking not found or already cancelled' });

        db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(bookingId);

        // Restore seats
        db.prepare(`UPDATE trips SET available_seats = available_seats + ? WHERE id = ?`).run(booking.seats_booked, booking.trip_id);

        // Re-open if was Full
        const trip = db.prepare(`SELECT available_seats FROM trips WHERE id = ?`).get(booking.trip_id);
        if (trip && trip.available_seats > 0) {
            const openId = getStatusId(db, 'Open');
            const fullId = getStatusId(db, 'Full');
            db.prepare(`UPDATE trips SET status_id = ? WHERE id = ? AND status_id = ?`).run(openId, booking.trip_id, fullId);
        }

        // Refund payment if any
        db.prepare(`UPDATE payments SET status = 'Refunded' WHERE booking_id = ? AND status = 'Completed'`).run(bookingId);

        res.json({ success: true, message: 'Booking cancelled and seats restored' });
    } catch (err) {
        console.error('Cancel booking error:', err);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// ─── PAYMENT ROUTES ───────────────────────────────────────────────────────────

// POST /api/trips-service/payments — Complete payment for a pending booking
router.post('/payments', authenticateToken, (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Only riders can make payments' });
    try {
        const { booking_id, amount, mode } = req.body;
        const db = getDb();

        cancelExpiredBookings(db);

        const booking = db.prepare(`
      SELECT b.*, t.price_per_seat, b.seats_booked FROM bookings b
      JOIN trips t ON t.id = b.trip_id
      WHERE b.id = ? AND b.rider_id = ?
    `).get(parseInt(booking_id), req.user.userId);

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status !== 'pending') return res.status(400).json({ error: `Booking is ${booking.status} — cannot pay` });

        const expectedAmount = booking.seats_booked * booking.price_per_seat;

        // Store payment
        db.prepare(`
      INSERT INTO payments (booking_id, amount, mode, status) VALUES (?, ?, ?, 'Completed')
    `).run(parseInt(booking_id), parseFloat(amount) || expectedAmount, mode || 'UPI');

        // Confirm booking, clear expiry
        db.prepare(`UPDATE bookings SET status = 'confirmed', expires_at = NULL WHERE id = ?`).run(parseInt(booking_id));

        res.status(201).json({ success: true, message: 'Payment successful, booking confirmed!' });
    } catch (err) {
        console.error('Payment error:', err);
        res.status(500).json({ error: 'Payment failed' });
    }
});

module.exports = router;
