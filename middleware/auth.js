const jwt = require('jsonwebtoken');
const { pool } = require('../Config/database');

// Check if user has valid login token
const authenticateToken = async (req, res, next) => {
  // Try to get token from Authorization header first, then from cookies
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
  
  // If no token in header, check cookies
  if (!token && req.cookies) {
    token = req.cookies.authToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Login required' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const [users] = await pool.execute(
      'SELECT id, username, email, user_type, status FROM users WHERE id = ? AND status = ?',
      [decoded.userId, 'active']
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = users[0]; // Add user info to request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to redirect logged-in users away from login/register pages
const redirectIfAuthenticated = async (req, res, next) => {
  // Try to get token from Authorization header first, then from cookies
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.authToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [users] = await pool.execute(
        'SELECT id, user_type FROM users WHERE id = ? AND status = ?',
        [decoded.userId, 'active']
      );

      if (users.length > 0) {
        // User is authenticated, redirect to dashboard
        const redirectUrl = users[0].user_type === 'employer' ? '/employer/dashboard.html' : '/dashboard.html';
        return res.redirect(redirectUrl);
      }
    } catch (error) {
      // Invalid token, continue to login page
    }
  }
  
  next();
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  if (req.user.user_type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  redirectIfAuthenticated
};
