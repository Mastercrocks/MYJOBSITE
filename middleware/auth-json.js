const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

// Models (Mongo fallback)
let UserModel = null;
try {
  UserModel = require('../models/User');
} catch (_) {
  UserModel = null;
}

const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Helper: read user from JSON store
async function findUserByIdJSON(id) {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    const users = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    const target = id != null ? id.toString() : '';
    return users.find(u => u && u.id != null && u.id.toString() === target) || null;
  } catch (_) {
    return null;
  }
}

// Helper: read user from MongoDB store
async function findUserByIdMongo(id) {
  try {
    if (!UserModel) return null;
    // Accept string id only if valid ObjectId
    const str = id != null ? id.toString() : '';
    if (!mongoose.Types.ObjectId.isValid(str)) return null;
    const doc = await UserModel.findById(str).lean();
    if (!doc) return null;
    // Normalize to the shape used by the rest of the app
    return {
      id: doc._id.toString(),
      username: doc.username || (doc.email ? doc.email.split('@')[0] : ''),
      email: (doc.email || '').toLowerCase(),
      user_type: doc.userType || doc.user_type || 'job_seeker',
      status: (doc.status || 'active')
    };
  } catch (_) {
    return null;
  }
}

// Unified helper: find user by ID with JSON first, then Mongo fallback
async function findUserById(id) {
  // Try JSON (legacy)
  const jsonUser = await findUserByIdJSON(id);
  if (jsonUser) return jsonUser;
  // Fallback to Mongo (persistent)
  const mongoUser = await findUserByIdMongo(id);
  if (mongoUser) return mongoUser;
  return null;
}

// Check if user has valid login token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.cookies) token = req.cookies.authToken;

  if (!token) return res.status(401).json({ error: 'Login required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid or inactive user' });

    const status = (user.status || 'active').toString().toLowerCase();
    if (status !== 'active') return res.status(401).json({ error: 'Invalid or inactive user' });

    req.user = {
      id: user.id ? user.id.toString() : (user._id ? user._id.toString() : ''),
      username: user.username,
      email: user.email,
      user_type: user.user_type || user.userType,
      status: user.status
    };
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to redirect logged-in users away from login/register pages
const redirectIfAuthenticated = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.cookies) token = req.cookies.authToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await findUserById(decoded.userId);
      const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
      if (user && status === 'active') {
        if ((user.user_type || user.userType) === 'employer') {
          return res.redirect('/employers.html');
        } else {
          return res.redirect('/jobs.html');
        }
      }
    } catch (_) { /* ignore invalid token */ }
  }

  return next();
};

// Middleware to check if user is an admin
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.cookies) token = req.cookies.authToken;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid user' });

    const status = (user.status || 'active').toString().toLowerCase();
    if (status !== 'active') return res.status(401).json({ error: 'Invalid user' });

    // Admin if user_type is admin OR username is 'admin'
    if ((user.user_type || user.userType) !== 'admin' && (user.username || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = {
  authenticateToken,
  redirectIfAuthenticated,
  requireAdmin
};
