const jwt = require('jsonwebtoken');
const { readDb, readMetadata } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'GR_CRM_SUPER_SECRET_KEY';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication token required.' });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    
    // Check session validity & token version
    const db = readDb();
    const employee = (db.employees || []).find(e => e.id === decodedUser.id);
    if (!employee || employee.status !== 'Active' || (employee.tokenVersion !== undefined && employee.tokenVersion !== decodedUser.tokenVersion)) {
      return res.status(403).json({ message: 'Session has expired or been revoked. Please log in again.' });
    }
    
    req.user = decodedUser;
    next();
  });
}

function checkPermission(moduleName, action) {
  return (req, res, next) => {
    const metadata = readMetadata();
    const role = req.user.role;
    
    const permissions = metadata.rolesPermissions[role];
    if (!permissions) {
      return res.status(403).json({ message: 'Role has no permissions configured.' });
    }

    const modulePerms = permissions[moduleName] || [];
    if (modulePerms.includes(action) || role === 'Admin') {
      return next();
    }

    return res.status(403).json({ message: `Insufficient permissions to perform '${action}' on '${moduleName}' module.` });
  };
}

const ipRequests = {};
function ipRateLimiter(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    if (!ipRequests[ip]) {
      ipRequests[ip] = [];
    }
    ipRequests[ip] = ipRequests[ip].filter(time => now - time < windowMs);
    if (ipRequests[ip].length >= maxRequests) {
      return res.status(429).json({ success: false, message: 'Too many requests from this network. Please try again in 15 minutes.' });
    }
    ipRequests[ip].push(now);
    next();
  };
}

function honeypot(req, res, next) {
  const { website_url } = req.body;
  if (website_url) {
    console.warn(`[Anti-Spam] Honeypot triggered from IP: ${req.ip}`);
    return res.status(200).json({ success: true, message: "Welcome back! Your new requirements query has been registered." });
  }
  next();
}

module.exports = {
  authenticateToken,
  checkPermission,
  ipRateLimiter,
  honeypot
};
