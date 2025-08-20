#!/usr/bin/env node
// Backfill expires_at for existing jobs and mark expired ones.
// Creates a timestamped backup before writing.

const fs = require('fs');
const path = require('path');

function backupFile(file) {
  const dir = path.dirname(file);
  const base = path.basename(file, '.json');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(dir, `${base}.backup.${ts}.json`);
  fs.copyFileSync(file, backup);
  return backup;
}

function main() {
  const jobsPath = path.join(__dirname, '..', 'data', 'jobs.json');
  if (!fs.existsSync(jobsPath)) {
    console.log('No jobs.json file found. Nothing to do.');
    process.exit(0);
  }
  const raw = fs.readFileSync(jobsPath, 'utf8');
  let jobs = [];
  try { jobs = JSON.parse(raw) || []; } catch (_) {}
  const before = JSON.stringify(jobs);

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  let added = 0, expired = 0;

  const updated = jobs.map(j => {
    const job = { ...j };
    const base = new Date(job.posted_date || job.datePosted || job.scraped_at || job.created_at || job.createdAt || now);
    if (!job.expires_at) {
      job.expires_at = new Date(base.getTime() + THIRTY_DAYS).toISOString();
      added++;
    }
    const exp = new Date(job.expires_at);
    if (!isNaN(exp) && exp.getTime() < now && (job.status || 'active') === 'active') {
      job.status = 'expired';
      job.updated_at = new Date().toISOString();
      expired++;
    }
    return job;
  });

  const after = JSON.stringify(updated);
  if (after === before) {
    console.log('No changes needed. All jobs already had expires_at and statuses up to date.');
    process.exit(0);
  }

  const backup = backupFile(jobsPath);
  fs.writeFileSync(jobsPath, JSON.stringify(updated, null, 2));
  console.log(`Backfill complete. Added expires_at to ${added} job(s), marked ${expired} as expired.`);
  console.log(`Backup saved to: ${backup}`);
}

main();
