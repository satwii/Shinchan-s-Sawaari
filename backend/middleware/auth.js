const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sawaari_secret';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            username: decoded.username,
            gender: decoded.gender,
            role: decoded.role || null      // null until DriveShare role is chosen
        };
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Middleware to require a specific DriveShare role
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user.role) {
            return res.status(403).json({ error: 'You must select a DriveShare role first' });
        }
        if (req.user.role !== role) {
            return res.status(403).json({ error: `This action requires ${role} access` });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };
