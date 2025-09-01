// Export all jobs from MongoDB to data/scraped_jobs.json so production can use the same dataset as local
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Job = require('../models/Job');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'talentsync';

async function main() {
  try {
    if (!MONGO_URI) {
      console.error('❌ Missing MONGODB_URI (or MONGO_URI) in environment.');
      process.exit(1);
    }
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('✅ Connected to MongoDB');

    const docs = await Job.find({}).lean();
    console.log(`📦 Loaded ${docs.length} jobs from Mongo`);

    const rows = (docs || []).map(j => ({
      // Keep plain JSON fields used by legacy feed
      id: j._id?.toString(),
      title: j.title || '',
      company: j.company || '',
      location: j.location || '',
      description: j.description || '',
      salary: j.salary || '',
      job_type: j.job_type || 'Full-time',
      status: j.status || 'active',
      posted_date: j.posted_date || j.created_at || j.createdAt || new Date().toISOString(),
      url: j.url || ''
    })).filter(j => j.title && j.company && j.location);

    // Ensure data directory exists
    const outDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'scraped_jobs.json');

    fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
    console.log(`💾 Wrote ${rows.length} jobs to ${outFile}`);

    await mongoose.disconnect();
    console.log('✅ Done.');
  } catch (e) {
    console.error('❌ Export failed:', e.message);
    process.exit(1);
  }
}

main();
