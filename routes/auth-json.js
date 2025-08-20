const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

// JSON file paths
const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Rate limiting for auth routes (configurable + smarter keying)
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000, // default 15 minutes
  max: Number(process.env.AUTH_RATE_MAX) || 20, // default 20 attempts
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Count per IP + submitted username/email (reduces shared-IP lockouts)
  keyGenerator: (req /*, res*/) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString();
    let id = '';
    try {
      const src = req.body || {};
      id = (src.username || src.email || '').toString().toLowerCase();
    } catch (_) { /* noop */ }
    return `${ip}:${id}`;
  },
  // Don’t count successful logins toward the limit
  skipSuccessfulRequests: true
});

// Helper functions
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    return [];
  }
}

async function writeUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function findUserByUsernameOrEmail(identifier) {
  const users = await readUsers();
  const lowerIdentifier = (identifier || '').toLowerCase();
  return users.find(user => {
    const uname = (user.username || '').toLowerCase();
    const mail = (user.email || '').toLowerCase();
    return uname === lowerIdentifier || mail === lowerIdentifier;
  });
}

async function findUserById(id) {
  const users = await readUsers();
  return users.find(user => user.id === id);
}

function getBaseUrl() {
  return process.env.PUBLIC_BASE_URL || process.env.SITE_URL || 'http://localhost:3000';
}

// REGISTER NEW USER
router.post('/register', async (req, res) => {
  try {
  let { username, email, password, firstName, lastName, userType = 'job_seeker', phone } = req.body || {};
  // Normalize inputs
  username = (username ?? '').toString().trim();
  email = (email ?? '').toString().trim();
  password = (password ?? '').toString();
  firstName = (firstName ?? '').toString().trim();
  lastName = (lastName ?? '').toString().trim();
  userType = (userType ?? 'job_seeker').toString().trim() || 'job_seeker';

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
  const usersRaw = await readUsers();
  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const existingUsername = users.find(u => (u && (u.username || '')).toString().toLowerCase() === username.toLowerCase());
  const existingEmail = users.find(u => (u && (u.email || '')).toString().toLowerCase() === email.toLowerCase());
    
    if (existingUsername) {
      return res.status(400).json({ 
        error: 'Username already exists. Please choose a different username.' 
      });
    }
    
    if (existingEmail) {
      return res.status(400).json({ 
        error: 'Email address already exists. Please use a different email or try logging in.' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = {
      id: Date.now().toString(), // Simple ID generation
  username,
  email: email.toLowerCase(), // Store email in lowercase
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

    // Add user to JSON file
    users.push(newUser);
    await writeUsers(users);

    // Generate token
    const token = jwt.sign(
      { userId: newUser.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('authToken', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Add job seekers to email_list.json for job alerts
    try {
      if ((newUser.user_type || '').toLowerCase() === 'job_seeker') {
        const listPath = path.join(__dirname, '../data', 'email_list.json');
        let emailList = [];
        try {
          const raw = await fs.readFile(listPath, 'utf8');
          emailList = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
        } catch (_) {
          emailList = [];
        }
        const lower = newUser.email.toLowerCase();
        const exists = emailList.some(e => (e && (e.email || '')).toString().toLowerCase() === lower);
        if (!exists) {
          const displayName = [newUser.first_name, newUser.last_name].filter(Boolean).join(' ') || newUser.username || newUser.email;
          emailList.unshift({
            id: Date.now().toString(),
            email: newUser.email,
            name: displayName,
            tags: ['job_seeker'],
            status: 'active',
            addedDate: new Date().toISOString(),
            lastEmailSent: null,
            totalEmailsSent: 0
          });
          await fs.writeFile(listPath, JSON.stringify(emailList, null, 2));
          console.log('📨 Added to email list:', newUser.email);
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to add to email list:', e.message);
    }

    // Fire-and-forget welcome email (does not block registration)
    (async () => {
      try {
        const { sendAccountEmail, isEmailConfigured } = require('../services/emailService');
        if (!isEmailConfigured()) {
          console.warn('📧 Email not configured (missing EMAIL_USER/EMAIL_PASS). Skipping welcome email.');
          return;
        }
        const subject = 'Welcome to TalentSync 🎉';
        const text = `Hi ${firstName || username},\n\nWelcome to TalentSync! Your account has been created successfully.\n\nYou can now browse jobs, save opportunities, and apply with ease.\n\nVisit your dashboard: https://talentsync.shop/jobseeker/dashboard.html\n\n— TalentSync Team`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome to TalentSync 🎉</h2>
            <p>Hi ${firstName || username || 'there'},</p>
            <p>Thanks for signing up! Your account was created successfully.</p>
            <ul>
              <li>Browse thousands of student-friendly jobs</li>
              <li>Save opportunities to apply later</li>
              <li>Track your applications</li>
            </ul>
            <p>
              <a href="https://talentsync.shop/jobseeker/dashboard.html" style="background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Go to your dashboard</a>
            </p>
            <p style="color:#6b7280; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
          </div>`;
        await sendAccountEmail({ to: newUser.email, subject, text, html });
        console.log('📧 Welcome email sent to', newUser.email);
        // Persist welcomeSent flag
        try {
          const all = await readUsers();
          const idx = all.findIndex(u => u.id === newUser.id);
          if (idx !== -1) {
            all[idx].welcomeSent = true;
            await writeUsers(all);
          }
        } catch (_) {}

        // Optional admin notification
        if (process.env.ADMIN_NOTIFY_EMAIL) {
          try {
            await sendAccountEmail({
              to: process.env.ADMIN_NOTIFY_EMAIL,
              subject: `New ${newUser.user_type === 'employer' ? 'Employer' : 'User'} Registration`,
              text: `A new ${newUser.user_type} registered: ${newUser.email}`,
              html: `<p>A new <strong>${newUser.user_type}</strong> registered:</p><ul><li>Email: ${newUser.email}</li><li>Username: ${newUser.username}</li></ul>`
            });
            console.log('📧 Admin notified of new registration');
          } catch (e) {
            console.warn('📧 Admin notification failed:', e.message);
          }
        }
      } catch (e) {
        console.warn('📧 Welcome email failed:', e.message);
      }
    })();

    res.status(201).json({
      message: `${userType === 'employer' ? 'Employer' : 'Job seeker'} registered successfully`,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        userType: newUser.user_type,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// LOGIN USER
router.post('/login', authLimiter, async (req, res) => {
  try {
  const body = req.body || {};
  const identifier = (body.username || body.email || '').toString().trim();
  const password = (body.password || '').toString();

  if (!identifier || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user by username or email (case-insensitive)
  const user = await findUserByUsernameOrEmail(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if account is active (normalize legacy variants)
    const status = (user.status || 'active').toString().toLowerCase();
    if (status !== 'active') {
      return res.status(401).json({ 
        error: 'Account is pending approval or has been suspended' 
      });
    }

    // Verify password supporting both new (password_hash) and legacy (password) fields
    let isValidPassword = false;
    try {
      if (user.password_hash) {
        // New schema (bcrypt hash)
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      } else if (user.password) {
        // Legacy schema
        if (typeof user.password === 'string' && user.password.startsWith('$2')) {
          // Legacy stored as bcrypt under different key
          isValidPassword = await bcrypt.compare(password, user.password);
        } else {
          // Legacy stored as plaintext (rare, but present in some records)
          isValidPassword = user.password === password;
        }
      }
    } catch (e) {
      // Any compare error => treat as invalid
      isValidPassword = false;
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Optional: migrate legacy plaintext passwords to hashed format
    const users = await readUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1 && !users[idx].password_hash) {
      try {
        // If legacy password is plaintext, hash and store; if it's bcrypt under password, move it
        if (users[idx].password && !users[idx].password.startsWith('$2')) {
          users[idx].password_hash = await bcrypt.hash(users[idx].password, 12);
          delete users[idx].password; // remove plaintext
        } else if (users[idx].password && users[idx].password.startsWith('$2')) {
          users[idx].password_hash = users[idx].password; // migrate key
          delete users[idx].password;
        }
        await writeUsers(users);
      } catch (_) {
        // Non-fatal if migration fails
      }
    }

    // Update login tracking
    if (idx !== -1) {
      users[idx].last_login = new Date().toISOString();
      users[idx].login_count = (users[idx].login_count || 0) + 1;
      await writeUsers(users);
    }

    // Fallback welcome email on first successful login (if registration email failed)
    try {
      const record = idx !== -1 ? users[idx] : user;
      const firstLogin = record && (record.login_count === 1 || !record.welcomeSent);
      if (firstLogin && record && record.email) {
        const { sendAccountEmail, isEmailConfigured } = require('../services/emailService');
        if (isEmailConfigured()) {
          const dash = (record.user_type || record.userType) === 'employer' ? 'employer/dashboard.html' : 'jobseeker/dashboard.html';
          await sendAccountEmail({
            to: record.email,
            subject: 'Welcome to TalentSync!',
            text: `Hi ${record.first_name || record.username || ''},\n\nWelcome! Your account is active.\n\nDashboard: https://talentsync.shop/${dash}`,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Welcome to TalentSync</h2><p>Hi ${record.first_name || record.username || 'there'},</p><p>Your account is active.</p><p><a href="https://talentsync.shop/${dash}" style="background:#10b981;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Open Dashboard</a></p></div>`
          });
          if (idx !== -1) {
            users[idx].welcomeSent = true;
            await writeUsers(users);
          }
          console.log('📧 Sent welcome on first login to', record.email);
        }
      }
    } catch (e) {
      console.warn('📧 First-login email failed:', e.message);
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie (align with register/logout options)
    res.cookie('authToken', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Normalize user fields for response
    const responseUser = {
      id: user.id,
      username: user.username || (user.email ? user.email.split('@')[0] : ''),
      email: user.email,
      userType: user.user_type || user.userType || 'job_seeker',
      firstName: user.first_name || (user.name ? user.name.split(' ')[0] : ''),
      lastName: user.last_name || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
    };

    res.json({
      message: 'Login successful',
      token,
      user: responseUser
    });

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
    const user = await findUserById(decoded.userId);
    if (!user || user.status !== 'active') return res.json({ authenticated: false });

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        user_type: user.user_type || 'job_seeker'
      }
    });
  } catch (e) {
    return res.json({ authenticated: false });
  }
});

// LOGOUT USER
router.post('/logout', (req, res) => {
  // Destroy express session if present
  try {
    if (req.session) {
      req.session.destroy(() => {});
    }
  } catch (_) {}

  // Clear the auth token cookie with matching options
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  // Also clear session cookie if any
  res.clearCookie('connect.sid', { path: '/' });
  return res.json({ message: 'Logged out successfully' });
});

// GET USER PROFILE
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1] || req.cookies.authToken;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile (excluding password hash)
    const { password_hash, ...userProfile } = user;
    res.json({ user: userProfile });

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

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      valid: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid token', valid: false });
  }
});

// CHECK AUTH (used by login.html)
router.get('/check-auth', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies.authToken;
    if (!token) return res.json({ authenticated: false });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);
    if (!user) return res.json({ authenticated: false });

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username || (user.email ? user.email.split('@')[0] : ''),
        email: user.email,
        user_type: user.user_type || user.userType || 'job_seeker',
        first_name: user.first_name || (user.name ? user.name.split(' ')[0] : ''),
        last_name: user.last_name || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
        status: user.status || 'active'
      }
    });
  } catch (e) {
    return res.json({ authenticated: false });
  }
});

module.exports = router;

// Optional: simple health check for auth subsystem
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// FORGOT PASSWORD (students + employers)
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const emailRaw = (req.body?.email || '').toString().trim().toLowerCase();
    if (!emailRaw) return res.status(400).json({ success: false, message: 'Email is required' });

    const users = await readUsers();
    const idx = users.findIndex(u => (u?.email || '').toLowerCase() === emailRaw);
    // Always respond success to avoid user enumeration
    const generic = { success: true, message: 'If that email exists, a reset link has been sent.' };
    if (idx === -1) return res.json(generic);

    // Only allow for job seekers and employers
    const type = (users[idx].user_type || users[idx].userType || '').toLowerCase();
    if (!['job_seeker','employer','admin'].includes(type)) return res.json(generic);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    users[idx].reset_token = token;
    users[idx].reset_token_expires = expiresAt;
    await writeUsers(users);

    // Send email (best-effort)
    try {
      const { sendAccountEmail, isEmailConfigured } = require('../services/emailService');
      const resetUrl = `${getBaseUrl()}/reset-password.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(emailRaw)}`;
      if (isEmailConfigured()) {
        await sendAccountEmail({
          to: emailRaw,
          subject: 'Reset your TalentSync password',
          text: `Click the link to reset your password (expires in 1 hour): ${resetUrl}`,
          html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>`
        });
      } else {
        console.warn('Email not configured. Password reset email not sent.');
      }
    } catch (e) {
      console.warn('Failed to send reset email:', e.message);
    }

    return res.json(generic);
  } catch (e) {
    console.error('Forgot password error:', e);
    return res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// RESET PASSWORD via token
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const token = (req.body?.token || '').toString().trim();
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const newPassword = (req.body?.newPassword || req.body?.password || '').toString();
    if (!token || !email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token, email, and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const users = await readUsers();
    const idx = users.findIndex(u => (u?.email || '').toLowerCase() === email);
    if (idx === -1) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    const record = users[idx] || {};
    if (!record.reset_token || record.reset_token !== token || !record.reset_token_expires || Date.now() > Number(record.reset_token_expires)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Hash and store
    const bcrypt = require('bcryptjs');
    users[idx].password_hash = await bcrypt.hash(newPassword, 12);
    delete users[idx].password; // remove any legacy plaintext
    users[idx].reset_token = null;
    users[idx].reset_token_expires = null;
    await writeUsers(users);

    return res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});
