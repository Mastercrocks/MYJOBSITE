// Import all JSON-based jobs into MongoDB so the live site matches local inventory
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Job = require('../models/Job');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'talentsync';

if (!MONGO_URI) {
  console.error('❌ Missing MONGO_URI/MONGODB_URI in env');
  process.exit(1);
}

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Failed to read', file, e.message);
    return [];
  }
}

function normalize(job) {
  const url = job.url || job.apply_url || job.applyUrl || job.applyLink || job.application_url || job.apply || job.link || '';
  const job_type = job.job_type || job.type || 'Full-time';
  const posted_date = job.posted_date || job.datePosted || job.scraped_at || job.created_at || new Date().toISOString();
  const status = (job.status || 'active').toLowerCase() === 'expired' ? 'inactive' : (job.status || 'active');
  return {
    title: String(job.title || '').trim(),
    company: String(job.company || '').trim(),
    location: String(job.location || '').trim(),
    description: String(job.description || '').trim(),
    salary: String(job.salary || '').trim(),
    job_type,
    url,
    status,
    posted_date: new Date(posted_date)
  };
}

(async () => {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log('✅ Connected to MongoDB');

  // Collect candidate files
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^(jobs|indeed_jobs|jobs_backup).*\.json$/i.test(f))
    .map(f => path.join(DATA_DIR, f));

  if (files.length === 0) {
    console.log('No job JSON files found in data/. Nothing to import.');
    await mongoose.disconnect();
    return;
  }

  console.log('📦 Import sources:', files.map(f => path.basename(f)).join(', '));

  // Load and combine
  let records = [];
  for (const f of files) records = records.concat(readJson(f));
  console.log('📄 Raw records:', records.length);

  // Normalize and filter
  const norm = records.map(normalize).filter(j => j.title && j.company && j.location);
  console.log('🧹 Normalized records:', norm.length);

  // Deduplicate by title+company+location+job_type
  const key = j => `${j.title.toLowerCase()}|${j.company.toLowerCase()}|${j.location.toLowerCase()}|${(j.job_type||'').toLowerCase()}`;
  const map = new Map();
  norm.forEach(j => { if (!map.has(key(j))) map.set(key(j), j); });
  const unique = Array.from(map.values());
  console.log('🔁 Unique records:', unique.length);

  // Insert/update
  let created = 0, updated = 0, skipped = 0;
  for (const j of unique) {
    try {
      const existing = await Job.findOne({ title: j.title, company: j.company, location: j.location }).lean();
      if (!existing) {
        await Job.create(j);
        created++;
      } else {
        // Update URL/description/salary if newly available
        const patch = {};
        if (j.url && j.url !== existing.url) patch.url = j.url;
        if (j.description && j.description.length > (existing.description||'').length) patch.description = j.description;
        if (j.salary && j.salary !== existing.salary) patch.salary = j.salary;
        if (Object.keys(patch).length) {
          await Job.updateOne({ _id: existing._id }, { $set: patch });
          updated++;
        } else {
          skipped++;
        }
      }
    } catch (e) {
      console.warn('⚠️  Upsert failed for', j.title, '-', j.company, e.message);
    }
  }

  console.log(`✅ Done. Created=${created}, Updated=${updated}, Skipped=${skipped}`);
  await mongoose.disconnect();
})();
