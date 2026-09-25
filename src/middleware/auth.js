const jwt = require('jsonwebtoken');

function requireAuth(secret) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'missing or invalid Authorization header' });
    }
    try {
      req.user = jwt.verify(token, secret);
      return next();
    } catch {
      return res.status(401).json({ error: 'invalid or expired token' });
    }
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `requires ${role} role` });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };