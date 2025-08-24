// Script to migrate jobs from jobs.json to MongoDB using Mongoose
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Job = require('./models/Job');
const Employer = require('./models/Employer');
require('dotenv').config();

const jobsPath = path.join(__dirname, 'data', 'jobs.json');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MongoDB URI not found in environment variables.');
  process.exit(1);
}

async function migrateJobs() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  if (!fs.existsSync(jobsPath)) {
    console.error('jobs.json not found.');
    process.exit(1);
  }

  const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  let migrated = 0;

  for (const job of jobsData) {
    // Try to find employer by ID if present, else leave null
    let employer = null;
    if (job.employerId) {
      employer = await Employer.findById(job.employerId).catch(() => null);
    }
    const newJob = new Job({
      title: job.title,
      description: job.description,
      company: job.company,
      location: job.location,
      salary: job.salary,
      job_type: job.job_type || job.type,
      posted_date: job.posted_date ? new Date(job.posted_date) : new Date(),
      employer: employer ? employer._id : undefined
    });
    await newJob.save();
    migrated++;
  }

  console.log(`Migration complete. Migrated ${migrated} jobs.`);
  await mongoose.disconnect();
}

migrateJobs().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
