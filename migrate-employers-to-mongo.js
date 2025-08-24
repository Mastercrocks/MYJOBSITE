// Script to migrate employers from employers.json to MongoDB using Mongoose
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Employer = require('./models/Employer');
require('dotenv').config();

const employersPath = path.join(__dirname, 'data', 'employers.json');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MongoDB URI not found in environment variables.');
  process.exit(1);
}

async function migrateEmployers() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  if (!fs.existsSync(employersPath)) {
    console.error('employers.json not found.');
    process.exit(1);
  }

  const employersData = JSON.parse(fs.readFileSync(employersPath, 'utf8'));
  let migrated = 0;

  for (const emp of employersData) {
    // Check if already exists by email
    const exists = await Employer.findOne({ email: emp.email });
    if (exists) continue;
    const newEmp = new Employer({
      name: emp.firstName && emp.lastName ? emp.firstName + ' ' + emp.lastName : emp.username || emp.companyName || 'Employer',
      email: emp.email,
      password: emp.password,
      company: emp.companyName || emp.company || '',
      created_at: emp.createdAt ? new Date(emp.createdAt) : new Date()
    });
    await newEmp.save();
    migrated++;
  }

  console.log(`Migration complete. Migrated ${migrated} employers.`);
  await mongoose.disconnect();
}

migrateEmployers().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
