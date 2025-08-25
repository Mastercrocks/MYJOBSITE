const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const router = express.Router();

// Mongo models
let UserModel = null;
let EmployerModel = null;
try {
  UserModel = require('../models/User');
} catch (_) { UserModel = null; }
try {
  EmployerModel = require('../models/Employer');
} catch (_) { EmployerModel = null; }

// JSON file paths (legacy fallback)
const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Rate limiting for auth routes (configurable + smarter keying)
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_MAX) || 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString();
    let id = '';
    try { const src = req.body || {}; id = (src.username || src.email || '').toString().toLowerCase(); } catch (_) {}
    return `${ip}:${id}`;
  },
  skipSuccessfulRequests: true
});

// Helper functions (legacy JSON)
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (_) { return []; }
}
async function writeUsers(users) { await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2)); }
async function findUserByUsernameOrEmailJSON(identifier) {
  const users = await readUsers();
  const lower = (identifier || '').toLowerCase();
  return users.find(u => (u.username || '').toLowerCase() === lower || (u.email || '').toLowerCase() === lower);
}
async function findUserByIdJSON(id) {
  const users = await readUsers();
  return users.find(u => u && u.id == id);
}

// Helper functions (Mongo)
function mongoAvailable() {
  return !!(UserModel && mongoose.connection && mongoose.connection.readyState === 1);
}
async function findUserByUsernameOrEmailMongo(identifier) {
  if (!mongoAvailable()) return null;
  const lower = (identifier || '').toLowerCase();
  // Try email first, then username
  let user = await UserModel.findOne({ email: lower }).lean();
  if (!user) user = await UserModel.findOne({ username: identifier }).lean();
  return user;
}
async function findUserByIdMongo(id) {
  if (!mongoAvailable()) return null;
  const str = id != null ? id.toString() : '';
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  const user = await UserModel.findById(str).lean();
  return user;
}
async function ensureEmployerDocForUser(userDoc, extras = {}) {
  if (!EmployerModel || !userDoc) return null;
  const email = (userDoc.email || '').toLowerCase();
  // Prefer using the same _id as User to simplify downstream lookups
  const desiredId = userDoc._id;
  let employer = await EmployerModel.findById(desiredId);
  if (!employer) {
    // If not by ID, try by email
    employer = await EmployerModel.findOne({ email });
  }
  if (!employer) {
    const fullName = [userDoc.firstName, userDoc.lastName].filter(Boolean).join(' ') || userDoc.username || email;
    employer = new EmployerModel({
      _id: desiredId, // align IDs for consistency
      name: fullName,
      email,
      company: extras.company || ''
    });
    await employer.save();
  }
  return employer;
}

function getBaseUrl() {
  return process.env.PUBLIC_BASE_URL || process.env.SITE_URL || 'http://localhost:3000';
}

// REGISTER NEW USER (Mongo-first with JSON fallback)
router.post('/register', async (req, res) => {
  try {
    let { username, email, password, firstName, lastName, userType = 'job_seeker', phone, company } = req.body || {};
    username = (username ?? '').toString().trim();
    email = (email ?? '').toString().trim().toLowerCase();
    password = (password ?? '').toString();
    firstName = (firstName ?? '').toString().trim();
    lastName = (lastName ?? '').toString().trim();
    userType = (userType ?? 'job_seeker').toString().trim() || 'job_seeker';

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (mongoAvailable()) {
      // Check uniqueness in Mongo
      const existing = await UserModel.findOne({ $or: [ { email }, { username } ] }).lean();
      if (existing) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const userDoc = new UserModel({
        username,
        email,
        password: passwordHash,
        firstName,
        lastName,
        userType
      });
      await userDoc.save();

      // If employer, ensure Employer document exists with same _id
      if ((userType || '').toLowerCase() === 'employer') {
        try { await ensureEmployerDocForUser(userDoc, { company }); } catch (_) {}
      }

      const token = jwt.sign({ userId: userDoc._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });

      // Add job seekers to email_list.json for job alerts (best-effort)
      try {
        if ((userType || '').toLowerCase() === 'job_seeker') {
          const listPath = path.join(__dirname, '../data', 'email_list.json');
          let emailList = [];
          try { const raw = await fs.readFile(listPath, 'utf8'); emailList = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []; } catch (_) { emailList = []; }
          const exists = emailList.some(e => (e && (e.email || '')).toString().toLowerCase() === email);
          if (!exists) {
            const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || email;
            emailList.unshift({ id: Date.now().toString(), email, name: displayName, tags: ['job_seeker'], status: 'active', addedDate: new Date().toISOString(), lastEmailSent: null, totalEmailsSent: 0 });
            await fs.writeFile(listPath, JSON.stringify(emailList, null, 2));
          }
        }
      } catch (_) {}

      return res.status(201).json({
        message: `${userType === 'employer' ? 'Employer' : 'Job seeker'} registered successfully`,
        token,
        user: {
          id: userDoc._id.toString(),
          username: userDoc.username,
          email: userDoc.email,
          userType: userDoc.userType,
          firstName: userDoc.firstName,
          lastName: userDoc.lastName
        }
      });
    }

    // Fallback: JSON store (legacy)
    const usersRaw = await readUsers();
    const users = Array.isArray(usersRaw) ? usersRaw : [];
    const existingUsername = users.find(u => (u && (u.username || '')).toString().toLowerCase() === username.toLowerCase());
    const existingEmail = users.find(u => (u && (u.email || '')).toString().toLowerCase() === email.toLowerCase());
    if (existingUsername) return res.status(400).json({ error: 'Username already exists. Please choose a different username.' });
    if (existingEmail) return res.status(400).json({ error: 'Email address already exists. Please use a different email or try logging in.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password_hash: passwordHash,
      user_type: userType,
      first_name: firstName || '',
      last_name: lastName || '',
      phone: phone || '',
      status: 'active',
      email_verified: false,
      created_at: new Date().toISOString(),
      last_login: null,
      login_count: 0
    };
    users.push(newUser);
    await writeUsers(users);

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.status(201).json({
      message: `${userType === 'employer' ? 'Employer' : 'Job seeker'} registered successfully`,
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, userType: newUser.user_type, firstName: newUser.first_name, lastName: newUser.last_name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// LOGIN USER (Mongo-first with JSON fallback)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = (body.username || body.email || '').toString().trim();
    const password = (body.password || '').toString();
    if (!identifier || !password) return res.status(400).json({ error: 'Username and password are required' });

    if (mongoAvailable()) {
      const user = await findUserByUsernameOrEmailMongo(identifier);
      if (user) {
        // Verify password
        const ok = user.password ? await bcrypt.compare(password, user.password) : false;
        if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
        // Account status (optional field)
        const status = (user.status || 'active').toString().toLowerCase();
        if (status !== 'active') return res.status(401).json({ error: 'Account is pending approval or has been suspended' });

        // Ensure Employer doc exists for employer accounts
        if ((user.userType || '').toLowerCase() === 'employer') {
          try { await ensureEmployerDocForUser(user); } catch (_) {}
        }

        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
        return res.json({
          message: 'Login successful',
          token,
          user: {
            id: user._id.toString(),
            username: user.username || (user.email ? user.email.split('@')[0] : ''),
            email: user.email,
            userType: user.userType || 'job_seeker',
            firstName: user.firstName || '',
            lastName: user.lastName || ''
          }
        });
      }
      // no Mongo user found -> fallthrough to JSON legacy
    }

    // Legacy JSON flow
    const userJson = await findUserByUsernameOrEmailJSON(identifier);
    if (!userJson) return res.status(401).json({ error: 'Invalid username or password' });

    const status = (userJson.status || 'active').toString().toLowerCase();
    if (status !== 'active') return res.status(401).json({ error: 'Account is pending approval or has been suspended' });

    // Verify password supporting both new (password_hash) and legacy (password) fields
    let isValidPassword = false;
    try {
      if (userJson.password_hash) {
        isValidPassword = await bcrypt.compare(password, userJson.password_hash);
      } else if (userJson.password) {
        if (typeof userJson.password === 'string' && userJson.password.startsWith('$2')) {
          isValidPassword = await bcrypt.compare(password, userJson.password);
        } else {
          isValidPassword = userJson.password === password;
        }
      }
    } catch (_) { isValidPassword = false; }
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid username or password' });

    // Optional: migrate legacy plaintext passwords to hashed format
    const users = await readUsers();
    const idx = users.findIndex(u => u.id === userJson.id);
    if (idx !== -1 && !users[idx].password_hash) {
      try {
        if (users[idx].password && !users[idx].password.startsWith('$2')) {
          users[idx].password_hash = await bcrypt.hash(users[idx].password, 12);
          delete users[idx].password;
        } else if (users[idx].password && users[idx].password.startsWith('$2')) {
          users[idx].password_hash = users[idx].password;
          delete users[idx].password;
        }
        await writeUsers(users);
      } catch (_) {}
    }

    const token = jwt.sign({ userId: userJson.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const responseUser = {
      id: userJson.id,
      username: userJson.username || (userJson.email ? userJson.email.split('@')[0] : ''),
      email: userJson.email,
      userType: userJson.user_type || userJson.userType || 'job_seeker',
      firstName: userJson.first_name || (userJson.name ? userJson.name.split(' ')[0] : ''),
      lastName: userJson.last_name || (userJson.name ? userJson.name.split(' ').slice(1).join(' ') : '')
    };

    return res.json({ message: 'Login successful', token, user: responseUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// CHECK AUTH (for login.html compatibility)
router.get('/check-auth', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.cookies) token = req.cookies.authToken;
    if (!token) return res.json({ authenticated: false });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Try Mongo first
    const userMongo = await findUserByIdMongo(decoded.userId);
    if (userMongo) {
      return res.json({
        authenticated: true,
        user: {
          id: userMongo._id.toString(),
          email: userMongo.email,
          username: userMongo.username,
          user_type: userMongo.userType || 'job_seeker'
        }
      });
    }

    // Fallback JSON
    const user = await findUserByIdJSON(decoded.userId);
    if (!user || (user.status || 'active').toLowerCase() !== 'active') return res.json({ authenticated: false });
    return res.json({ authenticated: true, user: { id: user.id, email: user.email, username: user.username, user_type: user.user_type || 'job_seeker' } });
  } catch (_) { return res.json({ authenticated: false }); }
});

// LOGOUT USER
router.post('/logout', (req, res) => {
  try { if (req.session) req.session.destroy(() => {}); } catch (_) {}
  res.clearCookie('authToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.clearCookie('connect.sid', { path: '/' });
  return res.json({ message: 'Logged out successfully' });
});

// GET USER PROFILE
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1] || req.cookies.authToken;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Mongo first
    const userMongo = await findUserByIdMongo(decoded.userId);
    if (userMongo) {
      const { password, ...safe } = userMongo;
      return res.json({ user: { id: userMongo._id.toString(), username: userMongo.username, email: userMongo.email, userType: userMongo.userType, firstName: userMongo.firstName, lastName: userMongo.lastName } });
    }

    // JSON fallback
    const user = await findUserByIdJSON(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...userProfile } = user;
    return res.json({ user: userProfile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// VERIFY TOKEN
router.get('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1] || req.cookies.authToken;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    const userMongo = await findUserByIdMongo(decoded.userId);
    if (userMongo) {
      return res.json({ valid: true, user: { id: userMongo._id.toString(), username: userMongo.username, email: userMongo.email, userType: userMongo.userType, firstName: userMongo.firstName, lastName: userMongo.lastName } });
    }

    const user = await findUserByIdJSON(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ valid: true, user: { id: user.id, username: user.username, email: user.email, userType: user.user_type, firstName: user.first_name, lastName: user.last_name } });
  } catch (_) { res.status(401).json({ error: 'Invalid token', valid: false }); }
});

module.exports = router;

// Optional health check
router.get('/health', (req, res) => { res.json({ ok: true }); });

// FORGOT PASSWORD (legacy JSON only, kept for compatibility)
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const emailRaw = (req.body?.email || '').toString().trim().toLowerCase();
    if (!emailRaw) return res.status(400).json({ success: false, message: 'Email is required' });

    const users = await readUsers();
    const idx = users.findIndex(u => (u?.email || '').toLowerCase() === emailRaw);
    const generic = { success: true, message: 'If that email exists, a reset link has been sent.' };
    if (idx === -1) return res.json(generic);

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000);
    users[idx].reset_token = token;
    users[idx].reset_token_expires = expiresAt;
    await writeUsers(users);

    const resetUrl = `${getBaseUrl()}/reset-password.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(emailRaw)}`;
    try {
      const { sendAccountEmail, isEmailConfigured } = require('../services/emailService');
      if (isEmailConfigured()) {
        await sendAccountEmail({ to: emailRaw, subject: 'Reset your TalentSync password', text: `Click the link to reset your password (expires in 1 hour): ${resetUrl}`, html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>` });
      } else {
        console.log('🔗 Password reset URL (dev):', resetUrl);
      }
    } catch (_) { console.log('🔗 Password reset URL (dev):', resetUrl); }

    const includeUrl = (process.env.NODE_ENV !== 'production') || String(process.env.RESET_DEBUG || 'false').toLowerCase() === 'true';
    if (includeUrl) return res.json({ ...generic, resetUrl });
    return res.json(generic);
  } catch (e) {
    console.error('Forgot password error:', e);
    return res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const token = (req.body?.token || '').toString().trim();
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const newPassword = (req.body?.newPassword || req.body?.password || '').toString();
    if (!token || !email || !newPassword) return res.status(400).json({ success: false, message: 'Token, email, and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const users = await readUsers();
    const idx = users.findIndex(u => (u?.email || '').toLowerCase() === email);
    if (idx === -1) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    const record = users[idx] || {};
    if (!record.reset_token || record.reset_token !== token || !record.reset_token_expires || Date.now() > Number(record.reset_token_expires)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    users[idx].password_hash = await bcrypt.hash(newPassword, 12);
    delete users[idx].password;
    users[idx].reset_token = null;
    users[idx].reset_token_expires = null;
    await writeUsers(users);

    return res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});
