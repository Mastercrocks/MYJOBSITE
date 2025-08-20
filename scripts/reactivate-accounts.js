// Reactivate all users and employers by setting status to 'active'.
// Creates timestamped backups before writing.

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');
const employersFile = path.join(dataDir, 'employers.json');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readJsonSafe(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(txt);
    if (!Array.isArray(json)) throw new Error('Expected array JSON');
    return json;
  } catch (e) {
    return [];
  }
}

function backupFile(file) {
  try {
    const backup = file.replace(/\.json$/i, `.backup.${ts()}.json`);
    fs.copyFileSync(file, backup);
    return backup;
  } catch (_) {
    return null;
  }
}

function reactivate(list) {
  let changed = 0;
  const normalized = list.map(rec => {
    const clone = { ...rec };
    if ((clone.status || '').toString().toLowerCase() !== 'active') {
      clone.status = 'active';
      changed++;
    }
    return clone;
  });
  return { normalized, changed };
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

(function main() {
  let totalChanged = 0;
  if (fs.existsSync(usersFile)) {
    const users = readJsonSafe(usersFile);
    const { normalized, changed } = reactivate(users);
    const backup = backupFile(usersFile);
    writeJson(usersFile, normalized);
    console.log(`Users: ${normalized.length} records processed, ${changed} updated${backup ? ` (backup: ${path.basename(backup)})` : ''}.`);
    totalChanged += changed;
  } else {
    console.log('Users file not found; skipping.');
  }

  if (fs.existsSync(employersFile)) {
    const employers = readJsonSafe(employersFile);
    const { normalized, changed } = reactivate(employers);
    const backup = backupFile(employersFile);
    writeJson(employersFile, normalized);
    console.log(`Employers: ${normalized.length} records processed, ${changed} updated${backup ? ` (backup: ${path.basename(backup)})` : ''}.`);
    totalChanged += changed;
  } else {
    console.log('Employers file not found; skipping.');
  }

  console.log(`Done. Total records updated: ${totalChanged}.`);
})();
