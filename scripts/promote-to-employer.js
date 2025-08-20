// Promote a specific user (by email) to employer and set status active.
// Usage: node scripts/promote-to-employer.js "email@example.com" [companyName]

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function backupFile(file) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = file.replace(/\.json$/i, `.backup.${ts}.json`);
    fs.copyFileSync(file, backup);
    return backup;
  } catch (_) {
    return null;
  }
}

(function main() {
  const email = (process.argv[2] || '').toLowerCase();
  const companyName = process.argv[3] || '';
  if (!email) {
    console.error('Email is required. Example: node scripts/promote-to-employer.js "user@example.com" "Company Name"');
    process.exit(1);
  }
  if (!fs.existsSync(usersFile)) {
    console.error('users.json not found.');
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === email);
  if (idx === -1) {
    console.error('User not found for email:', email);
    process.exit(2);
  }
  const user = users[idx];
  const beforeType = user.user_type || user.userType;
  user.user_type = 'employer';
  user.status = 'active';
  user.company = user.company || companyName || 'Unknown Company';
  user.billing = user.billing || { plan: 'free', status: 'inactive', provider: 'none' };
  const backup = backupFile(usersFile);
  writeJson(usersFile, users);
  console.log(`Promoted ${email} to employer. Type: ${beforeType} -> employer. Company: ${user.company}. ${backup ? `Backup: ${path.basename(backup)}` : ''}`);
})();
