/**
 * Import employer emails from data/users.json into data/email_list.json (type='employer').
 * Usage (PowerShell):
 *   node scripts/import-employers-from-users.js
 */
const fs = require('fs');
const path = require('path');

function dataPath(file) {
  return path.join(__dirname, '..', 'data', file);
}

function readJsonSafe(fp, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2));
}

(async () => {
  const usersFile = dataPath('users.json');
  const emailListFile = dataPath('email_list.json');

  const users = readJsonSafe(usersFile, []);
  const emailList = readJsonSafe(emailListFile, []);

  // Normalize existing list and build fast lookup per type=employer
  const normalized = (emailList || []).map(e => ({ type: e.type || 'student', ...e, type: (e.type || 'student') }));
  const existingEmployerEmails = new Set(normalized.filter(e => e.type === 'employer').map(e => (e.email || '').toLowerCase()));

  let added = 0;
  const nowIso = new Date().toISOString();
  for (const u of users) {
    const email = (u.email || '').toLowerCase();
    const isEmployer = (u.userType === 'employer') || (u.user_type === 'employer');
    if (!email || !isEmployer) continue;
    if (existingEmployerEmails.has(email)) continue;

    const entry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      email,
      name: u.companyName || u.company || u.first_name && u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (u.name || ''),
      tags: ['employer-user'],
      status: 'active',
      type: 'employer',
      addedDate: nowIso,
      lastEmailSent: null,
      totalEmailsSent: 0
    };
    normalized.push(entry);
    existingEmployerEmails.add(email);
    added++;
  }

  writeJson(emailListFile, normalized);
  console.log(`✅ Import complete. Added ${added} employer emails from users.json. Total emails now: ${normalized.length}.`);
})();
