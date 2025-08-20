const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Helper function to read users from JSON file
async function findUserById(id) {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    const users = JSON.parse(data);
    return users.find(user => user.id === id);
  } catch (error) {
    return null;
  }
}

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
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists and is active (default missing status to active for legacy records)
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    const status = (user.status || 'active').toString().toLowerCase();
    if (status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      status: user.status
    };
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
      const decoded = jwt.verify(token, JWT_SECRET);
  const user = await findUserById(decoded.userId);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
      
  if (user && status === 'active') {
        // User is authenticated, redirect them to appropriate dashboard
        if (user.user_type === 'employer') {
          return res.redirect('/employers.html');
        } else {
          return res.redirect('/jobs.html');
        }
      }
    } catch (error) {
      // Token is invalid, continue to login/register page
    }
  }

  next(); // User is not authenticated, proceed to login/register page
};

// Middleware to check if user is an admin
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated first
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    if (!token && req.cookies) {
      token = req.cookies.authToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    const status = (user.status || 'active').toString().toLowerCase();
    if (status !== 'active') {
      return res.status(401).json({ error: 'Invalid user' });
    }

    // Check if user is admin (you can modify this logic based on your admin structure)
    if (user.user_type !== 'admin' && user.username !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = {
  authenticateToken,
  redirectIfAuthenticated,
  requireAdmin
};
