require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { getDb } = require('./database');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'sawaari_secret';
const PORT = process.env.PORT || 5000;

// Explicit CORS allowlist — includes Render frontend + local dev
const ALLOWED_ORIGINS = [
    'https://shinchan-s-sawaari-f.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
];

// Shared CORS options — used for both the middleware and OPTIONS preflight
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (
            ALLOWED_ORIGINS.includes(origin) ||
            /\.onrender\.com$/.test(origin) ||
            /\.azurewebsites\.net$/.test(origin)
        ) {
            return callback(null, true);
        }

        console.log("Blocked CORS origin:", origin);

        // instead of throwing error, deny quietly
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
// Handle OPTIONS preflight BEFORE other middleware so it always responds correctly
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Invalid token'));
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        socket.gender = decoded.gender;
        socket.role = decoded.role;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.username} (${socket.userId})`);

    // Join a ride's chat room
    socket.on('join_ride_room', ({ rideId }) => {
        const db = getDb();
        const isMember = db.prepare(
            `SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`
        ).get(rideId, socket.userId);

        if (!isMember) {
            socket.emit('error', { message: 'You are not a member of this ride' });
            return;
        }

        socket.join(`ride_${rideId}`);
        console.log(`💬 ${socket.username} joined ride room ${rideId}`);
        socket.emit('joined_room', { rideId });
    });

    // Send a message in a ride chat
    socket.on('send_message', ({ rideId, content }) => {
        if (!content || !content.trim()) return;
        if (!rideId) return;

        const db = getDb();

        const isMember = db.prepare(
            `SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`
        ).get(rideId, socket.userId);

        if (!isMember) {
            socket.emit('error', { message: 'You are not a member of this ride' });
            return;
        }

        const ride = db.prepare(`SELECT id FROM rides WHERE id = ?`).get(rideId);
        if (!ride) {
            socket.emit('error', { message: 'Ride not found' });
            return;
        }

        const sanitizedContent = content.trim().substring(0, 1000);
        const sentAt = new Date().toISOString();

        const result = db.prepare(
            `INSERT INTO messages (ride_id, user_id, content, sent_at) VALUES (?, ?, ?, ?)`
        ).run(rideId, socket.userId, sanitizedContent, sentAt);

        const message = {
            id: result.lastInsertRowid,
            rideId,
            userId: socket.userId,
            username: socket.username,
            gender: socket.gender,
            content: sanitizedContent,
            sentAt
        };

        io.to(`ride_${rideId}`).emit('new_message', message);
    });

    // GPS location updates for live tracking
    socket.on('location_update', ({ rideId, lat, lng }) => {
        if (!rideId || lat === undefined || lng === undefined) return;
        // Broadcast to all members in the ride room
        io.to(`ride_${rideId}`).emit('live_location', { rideId, lat, lng, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.username}`);
    });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/ts', require('./routes/tripsService'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/fare', require('./routes/fare'));
app.use('/api/wallet', require('./routes/wallet'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Sawaari Backend', timestamp: new Date().toISOString() });
});

// ─── SERVE FRONTEND IN PRODUCTION ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, 'public');
    app.use(express.static(buildPath));
    // SPA catch-all — must come after API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });
} else {
    // 404 handler (dev only — in prod the SPA catch-all handles it)
    app.use((req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── POST /api/sos ─────────────────────────────────────────────────────
app.post('/api/sos', authenticateToken, (req, res) => {
    try {
        const { ride_id, lat, lng, message } = req.body;
        const db = getDb();
        const userId = req.user.userId;

        console.log(`\n🚨 [SOS TRIGGERED] User ${userId} | Ride ${ride_id} | Lat ${lat} Lng ${lng} | ${new Date().toISOString()}`);

        // Get user emergency contact
        const user = db.prepare(`SELECT username, emergency_contact_name, emergency_contact_phone FROM users WHERE id = ?`).get(userId);

        // Get all ride members to notify
        if (ride_id) {
            const members = db.prepare(`SELECT user_id FROM ride_members WHERE ride_id = ? AND user_id != ?`).all(ride_id, userId);
            for (const m of members) {
                try {
                    db.prepare(`INSERT INTO notifications (user_id, type, message, ride_id) VALUES (?, 'sos', ?, ?)`)
                        .run(m.user_id, `🚨 SOS ALERT from ${user?.username || 'a co-passenger'}! They may need help. Location: ${lat ? `${lat},${lng}` : 'unavailable'}`, ride_id);
                } catch (_) { }
            }
        }

        console.log(`   Emergency Contact: ${user?.emergency_contact_name} (${user?.emergency_contact_phone})`);
        console.log(`   Location: https://maps.google.com/?q=${lat},${lng}`);

        res.json({ success: true, message: 'SOS triggered. Help is on the way.' });
    } catch (err) {
        console.error('SOS error:', err);
        res.status(500).json({ error: 'SOS failed' });
    }
});

// ─── EXPIRED RIDES CLEANUP JOB (Fix 2) ────────────────────────────────────
function markExpiredRides() {
    try {
        const db = getDb();
        const result = db.prepare(`
            UPDATE rides SET status = 'expired'
            WHERE status = 'active'
              AND datetime(date || 'T' || COALESCE(ride_time, '23:59') || ':00') < datetime('now')
        `).run();
        if (result.changes > 0) {
            console.log(`⏰ Marked ${result.changes} expired ride(s)`);
        }
    } catch (err) {
        console.error('Expired rides cleanup error:', err);
    }
}

// ─── START ─────────────────────────────────────────────────────
getDb();

// Run cleanup immediately on start, then every hour
markExpiredRides();
setInterval(markExpiredRides, 60 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`\n🚗 Sawaari Backend running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🖬 Azure Speech: ${process.env.AZURE_SPEECH_KEY ? 'LOADED' : 'MISSING'}`);
    console.log(`🗺️  ORS API: ${process.env.ORS_API_KEY ? 'LOADED' : 'MISSING'}`);
    console.log(`🗄️  Database: SQLite (sawaari.db)\n`);
});

module.exports = { app, server };
