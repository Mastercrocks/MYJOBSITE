#!/usr/bin/env node
// Usage: node scripts/set-password.js <email> <newPassword>
// Updates data/users.json: sets password_hash for the user with given email.

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , emailArg, passArg] = process.argv;
  if (!emailArg || !passArg) {
    console.error('Provide: <email> <newPassword>');
    process.exit(1);
  }
  const email = emailArg.toLowerCase();
  const pwd = String(passArg);
  if (pwd.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  if (!fs.existsSync(usersFile)) {
    console.error('users.json not found at', usersFile);
    process.exit(1);
  }
  const raw = await fsp.readFile(usersFile, 'utf8');
  const users = JSON.parse(raw);
  const idx = users.findIndex(u => (u?.email || '').toLowerCase() === email);
  if (idx === -1) {
    console.error('No user found for email:', email);
    process.exit(1);
  }
  users[idx].password_hash = await bcrypt.hash(pwd, 12);
  delete users[idx].password; // remove legacy/plaintext if any
  users[idx].reset_token = null;
  users[idx].reset_token_expires = null;
  await fsp.writeFile(usersFile, JSON.stringify(users, null, 2));
  console.log('Password updated for', email);
}

main().catch(err => { console.error(err); process.exit(1); });
