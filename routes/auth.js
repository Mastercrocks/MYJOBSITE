
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../Config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const { sendAccountEmail } = require('../services/emailService');
const passport = require('passport');
const router = express.Router();

// Google OAuth routes
router.get('/google', (req, res, next) => {
  // Store referrer to determine user type after OAuth
  req.session.authReferrer = req.get('Referer') || req.query.redirect;
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      let user = req.user;
      
      // Check if user came from employer page and update user type if needed
      const referrer = req.session.authReferrer;
      const isFromEmployerPage = referrer && (referrer.includes('/employers') || referrer.includes('/post-job'));
      
      if (isFromEmployerPage && user.user_type === 'job_seeker') {
        // Update user type to employer if they came from employer page
        await pool.execute(
          'UPDATE users SET user_type = ? WHERE id = ?',
          ['employer', user.id]
        );
        user.user_type = 'employer';
      }
      
      // Generate JWT token for the authenticated user
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update login tracking
      await pool.execute(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = COALESCE(login_count, 0) + 1 WHERE id = ?',
        [user.id]
      );

      // Redirect based on user type
      const redirectUrl = user.user_type === 'employer' ? '/employer/dashboard.html' : '/dashboard.html';
      
      // Set token in cookie and redirect
      res.cookie('authToken', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      res.redirect(redirectUrl + '?loginSuccess=true');
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=oauth-failed');
    }
  }
);

// Check if user is already logged in
router.get('/check-auth', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await pool.execute(
      'SELECT id, username, email, user_type, first_name, last_name, profile_picture FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({ 
      authenticated: true, 
      user: users[0] 
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ authenticated: false });
  }
});

// ADMIN FORGOT PASSWORD
router.post('/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    // Only allow admin user
    const [users] = await pool.execute('SELECT id FROM users WHERE email = ? AND user_type = ?', [email, 'admin']);
    if (users.length === 0) return res.status(404).json({ error: 'Admin not found' });
    const user = users[0];
    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min expiry
    await pool.execute('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
    // Send email
    const resetUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/admin/reset-password.html?token=${token}`;
    await sendAccountEmail({
      to: email,
      subject: 'Admin Password Reset',
      text: `Reset your admin password: ${resetUrl}`,
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your admin password. This link expires in 30 minutes.</p>`
    });
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (e) {
    console.error('Admin forgot password error:', e);
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});

// ADMIN RESET PASSWORD
router.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
  try {
    const [users] = await pool.execute('SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW() AND user_type = ?', [token, 'admin']);
    if (users.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    const user = users[0];
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));
    await pool.execute('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [passwordHash, user.id]);
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (e) {
    console.error('Admin reset password error:', e);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});


// Rate limiting to prevent spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, please try again later' }
});

// REGISTER NEW USER (Job Seeker or Employer)
router.post('/register', async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      firstName, 
      lastName, 
      userType, // 'job_seeker' or 'employer'
      phone,
      // Company info if employer
      companyName,
      companyWebsite,
      jobTitle
    } = req.body;

    // Validation
    if (!username || !email || !password || !userType) {
      return res.status(400).json({ 
        error: 'Username, email, password, and user type are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    if (!['job_seeker', 'employer'].includes(userType)) {
      return res.status(400).json({ 
        error: 'User type must be job_seeker or employer' 
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        error: 'Username or email already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    // Insert user
    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, user_type, first_name, last_name, phone, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, userType, firstName, lastName, phone, 'active']
    );

    const userId = userResult.insertId;

    // If employer, create company and employer profile
    if (userType === 'employer' && companyName) {
      // Create company
      const [companyResult] = await pool.execute(
        'INSERT INTO companies (name, website, status) VALUES (?, ?, ?)',
        [companyName, companyWebsite, 'pending']
      );

      // Link user to company
      await pool.execute(
        'INSERT INTO employer_profiles (user_id, company_id, job_title, is_company_admin) VALUES (?, ?, ?, ?)',
        [userId, companyResult.insertId, jobTitle, true]
      );
    }


    // Send email with username and password if employer or job poster
    if (userType === 'employer' || userType === 'admin') {
      try {
        const { sendAccountEmail } = require('../services/emailService');
        await sendAccountEmail({
          to: email,
          subject: 'Your TalentSync Account Details',
          text: `Welcome to TalentSync!\n\nYour account has been created.\nUsername: ${username}\nPassword: (the password you set during registration)\n\nYou can log in at http://localhost:3000/login.html`,
          html: `<p>Welcome to TalentSync!</p><p>Your account has been created.</p><ul><li><b>Username:</b> ${username}</li><li><b>Password:</b> (the password you set during registration)</li></ul><p>You can log in at <a href="http://localhost:3000/login.html">TalentSync Login</a></p>`
        });
      } catch (e) {
        console.error('Failed to send account email:', e.message);
      }
    }

    // Generate login token
    const token = jwt.sign(
      { userId: userId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: `${userType === 'employer' ? 'Employer' : 'Job seeker'} registered successfully`,
      token,
      user: {
        id: userId,
        username,
        email,
        userType,
        firstName,
        lastName
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user (allow login with username or email)
    const [users] = await pool.execute(
      'SELECT id, username, email, password_hash, user_type, status, first_name, last_name FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({ 
        error: 'Account is pending approval or has been suspended' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update login tracking
    await pool.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie for persistent login
    res.cookie('authToken', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      token,
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// LOGOUT USER
router.post('/logout', (req, res) => {
  // Clear the auth token cookie
  res.clearCookie('authToken');
  
  // If using passport sessions, logout
  if (req.logout) {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
    });
  }
  
  res.json({ message: 'Logged out successfully' });
});

// GET USER PROFILE
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get basic user info
    const [users] = await pool.execute(
      'SELECT id, username, email, user_type, first_name, last_name, phone, status, email_verified, created_at, last_login FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Get additional profile data based on user type
    if (user.user_type === 'employer') {
      const [employerData] = await pool.execute(`
        SELECT 
          ep.job_title, ep.is_company_admin,
          c.id as company_id, c.name as company_name, c.website as company_website,
          c.status as company_status
        FROM employer_profiles ep
        JOIN companies c ON ep.company_id = c.id
        WHERE ep.user_id = ?
      `, [userId]);

      if (employerData.length > 0) {
        user.employer_info = employerData[0];
      }
    }

    res.json({ user });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;