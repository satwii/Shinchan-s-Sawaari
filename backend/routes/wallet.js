const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// ── Atomic wallet transfer helper (exported for use in other routes) ──────────
function transferWallet(db, fromUserId, toUserId, amount, rideId, description) {
    const transfer = db.transaction(() => {
        // Debit sender
        const sender = db.prepare(`SELECT sawaari_wallet FROM users WHERE id = ?`).get(fromUserId);
        if (!sender || sender.sawaari_wallet < amount) {
            throw new Error(`Insufficient Sawaari Money. Need ₩${amount.toFixed(0)}, have ₩${(sender?.sawaari_wallet || 0).toFixed(0)}`);
        }
        const senderNewBal = parseFloat((sender.sawaari_wallet - amount).toFixed(2));
        db.prepare(`UPDATE users SET sawaari_wallet = ? WHERE id = ?`).run(senderNewBal, fromUserId);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, ride_id)
            VALUES (?, 'debit', ?, ?, ?, ?)
        `).run(fromUserId, amount, senderNewBal, description, rideId || null);

        // Credit receiver
        const receiver = db.prepare(`SELECT sawaari_wallet FROM users WHERE id = ?`).get(toUserId);
        const receiverNewBal = parseFloat(((receiver?.sawaari_wallet || 0) + amount).toFixed(2));
        db.prepare(`UPDATE users SET sawaari_wallet = ? WHERE id = ?`).run(receiverNewBal, toUserId);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, ride_id)
            VALUES (?, 'credit', ?, ?, ?, ?)
        `).run(toUserId, amount, receiverNewBal, description, rideId || null);

        return { senderBalance: senderNewBal, receiverBalance: receiverNewBal };
    });
    return transfer();
}

// GET /api/wallet — balance + last 20 transactions
router.get('/', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare(`SELECT sawaari_wallet FROM users WHERE id = ?`).get(req.user.userId);
        const transactions = db.prepare(`
            SELECT id, type, amount, balance_after, description, ride_id, created_at
            FROM wallet_transactions WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 20
        `).all(req.user.userId);
        res.json({
            balance: user?.sawaari_wallet || 0,
            transactions,
        });
    } catch (err) {
        console.error('Wallet fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet' });
    }
});

// POST /api/wallet/add-money — simulated top-up
router.post('/add-money', authenticateToken, (req, res) => {
    try {
        const { amount } = req.body;
        const amt = parseFloat(amount);
        if (!amt || amt <= 0 || amt > 50000) {
            return res.status(400).json({ error: 'Amount must be between ₩1 and ₩50,000' });
        }

        const db = getDb();
        const user = db.prepare(`SELECT sawaari_wallet FROM users WHERE id = ?`).get(req.user.userId);
        const newBal = parseFloat(((user?.sawaari_wallet || 0) + amt).toFixed(2));
        db.prepare(`UPDATE users SET sawaari_wallet = ? WHERE id = ?`).run(newBal, req.user.userId);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
            VALUES (?, 'credit', ?, ?, 'Added via UPI (simulated)')
        `).run(req.user.userId, amt, newBal);

        res.json({ success: true, balance: newBal, added: amt });
    } catch (err) {
        console.error('Add money error:', err);
        res.status(500).json({ error: 'Failed to add money' });
    }
});

module.exports = router;
module.exports.transferWallet = transferWallet;
