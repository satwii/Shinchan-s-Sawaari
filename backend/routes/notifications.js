const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications — all notifications for logged-in user
router.get('/', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const notes = db.prepare(`
            SELECT id, type, message, ride_id, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).all(req.user.userId);
        const unreadCount = notes.filter(n => !n.is_read).length;
        res.json({ notifications: notes, unreadCount });
    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// PUT /api/notifications/:id/read — mark a single notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE notifications SET is_read = 1
            WHERE id = ? AND user_id = ?
        `).run(parseInt(req.params.id), req.user.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark read' });
    }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark all read' });
    }
});

module.exports = router;
