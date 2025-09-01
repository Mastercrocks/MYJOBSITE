// Migrate users from data/users.json to MongoDB (and create Employer docs for employers)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Employer = require('./models/Employer');

const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'talentsync';

if (!MONGO_URI) {
  console.error('MongoDB URI not found in environment variables.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('Connected to MongoDB');

    if (!fs.existsSync(USERS_PATH)) {
      console.error('users.json not found. Nothing to migrate.');
      process.exit(1);
    }

    const raw = fs.readFileSync(USERS_PATH, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      console.error('users.json is not an array');
      process.exit(1);
    }

    let createdUsers = 0, updatedUsers = 0, createdEmployers = 0;

    for (const u of arr) {
      const username = (u.username || (u.email ? String(u.email).split('@')[0] : '')).toString();
      const email = (u.email || '').toString().toLowerCase();
      if (!email || !username) continue;

      let doc = await User.findOne({ $or: [{ email }, { username }] });
      const payload = {
        username,
        email,
        firstName: u.first_name || u.firstName || '',
        lastName: u.last_name || u.lastName || '',
        userType: (u.user_type || u.userType || 'job_seeker').toString(),
        created_at: u.created_at ? new Date(u.created_at) : (u.createdAt ? new Date(u.createdAt) : new Date())
      };

      // Determine password to store
      let passwordHash = null;
      try {
        if (u.password_hash && typeof u.password_hash === 'string') {
          passwordHash = u.password_hash; // already hashed
        } else if (u.password && typeof u.password === 'string') {
          if (u.password.startsWith('$2')) passwordHash = u.password; // bcrypt already
          else passwordHash = await bcrypt.hash(u.password, 12);
        }
      } catch (_) {}
      if (!passwordHash) passwordHash = await bcrypt.hash('TempPass123!', 12);
      payload.password = passwordHash;

      if (!doc) {
        doc = new User(payload);
        await doc.save();
        createdUsers++;
      } else {
        await User.updateOne({ _id: doc._id }, { $set: payload });
        updatedUsers++;
      }

      // Create Employer doc for employer accounts
      const type = (payload.userType || '').toLowerCase();
      if (type === 'employer') {
        let emp = await Employer.findById(doc._id);
        if (!emp) emp = await Employer.findOne({ email });
        if (!emp) {
          emp = new Employer({
            _id: doc._id,
            name: [payload.firstName, payload.lastName].filter(Boolean).join(' ') || payload.username,
            email,
            company: u.company || u.companyName || ''
          });
          await emp.save();
          createdEmployers++;
        }
      }
    }

    console.log(`Users created: ${createdUsers}, updated: ${updatedUsers}`);
    console.log(`Employers created: ${createdEmployers}`);
    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
