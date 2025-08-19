// Remove mistakenly added test/basic-plan jobs from data/jobs.json
// Usage: node scripts/cleanup-test-jobs.js

const fs = require('fs');
const path = require('path');

function readJson(p, fallback = []) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

(function main() {
  const file = path.join(__dirname, '..', 'data', 'jobs.json');
  if (!fs.existsSync(file)) {
    console.error('jobs.json not found');
    process.exit(1);
  }

  const jobs = readJson(file, []);
  const before = jobs.length;

  const isTesty = (j) => {
    const t = (j && j.title) ? String(j.title) : '';
    const isBasic = /^Basic Plan Job \d+$/.test(t);
    const isTest = /^Test Job \d+$/.test(t);
    const isExampleApply = (j && j.apply_url && String(j.apply_url).includes('example.com/apply'));
    const isAcme = (j && j.company && String(j.company).toLowerCase() === 'acme inc');
    return isBasic || isTest || (isExampleApply && isAcme);
  };

  const cleaned = jobs.filter(j => !isTesty(j));
  const removed = before - cleaned.length;

  if (removed > 0) {
    // backup first
    const backup = path.join(__dirname, '..', 'data', `jobs.backup.${Date.now()}.json`);
    writeJson(backup, jobs);
    writeJson(file, cleaned);
    console.log(`Removed ${removed} erroneous job(s). Backup saved to ${backup}.`);
  } else {
    console.log('No erroneous jobs found to remove.');
  }
})();
