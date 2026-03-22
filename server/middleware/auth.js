const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/init');

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Get fresh user data from database
    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1
    };
    
    next();
  });
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
