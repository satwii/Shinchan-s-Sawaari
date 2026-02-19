require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { getDb } = require('./database');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'sawaari_secret';
const PORT = process.env.PORT || 5000;
// Allow any localhost port (3000, 3001, 3002...) — useful in dev when CRA picks a free port
const CORS_ORIGIN = process.env.CLIENT_ORIGIN
    ? [process.env.CLIENT_ORIGIN]
    : (origin, callback) => {
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed for: ' + origin));
        }
    };

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json());

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN,
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
        // Verify user is a member of this ride
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

        // Verify membership
        const isMember = db.prepare(
            `SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`
        ).get(rideId, socket.userId);

        if (!isMember) {
            socket.emit('error', { message: 'You are not a member of this ride' });
            return;
        }

        // Verify ride still exists
        const ride = db.prepare(`SELECT id FROM rides WHERE id = ?`).get(rideId);
        if (!ride) {
            socket.emit('error', { message: 'Ride not found' });
            return;
        }

        const sanitizedContent = content.trim().substring(0, 1000);
        const sentAt = new Date().toISOString();

        // Save message to DB
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

        // Broadcast to all room members (including sender)
        io.to(`ride_${rideId}`).emit('new_message', message);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.username}`);
    });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/ts', require('./routes/tripsService'));  // trips / bookings / payments / vehicles

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Sawaari Backend', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
// Initialize DB on startup
getDb();

server.listen(PORT, () => {
    console.log(`\n🚗 Sawaari Backend running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🗄️  Database: SQLite (sawaari.db)\n`);
});

module.exports = { app, server };
