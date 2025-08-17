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

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
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
  return users.find(user => 
    user.username === identifier || user.email === identifier
  );
}

async function findUserById(id) {
  const users = await readUsers();
  return users.find(user => user.id === id);
}

// REGISTER NEW USER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, userType = 'job_seeker', phone } = req.body;

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
    const existingUser = await findUserByUsernameOrEmail(username) || 
                        await findUserByUsernameOrEmail(email);
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username or email already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = {
      id: Date.now().toString(), // Simple ID generation
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

    // Add user to JSON file
    const users = await readUsers();
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
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user
    const user = await findUserByUsernameOrEmail(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

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
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].last_login = new Date().toISOString();
      users[userIndex].login_count = (users[userIndex].login_count || 0) + 1;
      await writeUsers(users);
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
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
  res.json({ message: 'Logged out successfully' });
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

module.exports = router;
