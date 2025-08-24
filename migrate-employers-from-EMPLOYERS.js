// migrate-employers-from-EMPLOYERS.js
// This script migrates unique employers from EMPLOYERS.js to MongoDB using the Employer model.

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Employer = require('./models/Employer');

const EMPLOYERS_FILE = path.join(__dirname, 'EMPLOYERS.js');

async function migrate() {
  // Connect to MongoDB (update your connection string as needed)
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myjobsite');
  console.log('Connected to MongoDB');

  if (!fs.existsSync(EMPLOYERS_FILE)) {
    console.log('EMPLOYERS.js file not found.');
    return;
  }

  let employers = [];
  try {
    employers = JSON.parse(fs.readFileSync(EMPLOYERS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to parse EMPLOYERS.js:', e);
    return;
  }

  let migrated = 0;
  for (const emp of employers) {
    if (!emp.email) continue;
    // Check if already exists in MongoDB
    const exists = await Employer.findOne({ email: emp.email });
    if (!exists) {
      await Employer.create({
        name: emp.name,
        email: emp.email,
        company: emp.company,
        created_at: emp.created_at || new Date()
      });
      migrated++;
    }
  }
  console.log(`Migration complete. Migrated ${migrated} employers.`);
  await mongoose.disconnect();
}

migrate();
