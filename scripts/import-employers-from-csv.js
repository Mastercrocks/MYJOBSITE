/**
 * Import employer emails from a CSV into data/email_list.json (type='employer').
 * CSV format: email,name,tags
 * Usage (PowerShell):
 *   node scripts/import-employers-from-csv.js --file "C:\\path\\to\\employers.csv"
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function getArg(name) {
  const idx = argv.findIndex(a => a === `--${name}`);
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  const kv = argv.find(a => a.startsWith(`--${name}=`));
  if (kv) return kv.split('=')[1];
  return undefined;
}

const filePath = getArg('file');
if (!filePath) {
  console.error('Usage: node scripts/import-employers-from-csv.js --file "C:\\path\\to\\file.csv"');
  process.exit(1);
}

function dataPath(file) { return path.join(__dirname, '..', 'data', file); }
function readJsonSafe(fp, fallback) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { return fallback; } }
function writeJson(fp, obj) { fs.writeFileSync(fp, JSON.stringify(obj, null, 2)); }

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  for (const line of lines) {
    // Simple CSV split; handles basic quoted fields
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols.map(c => c.trim()));
  }
  return rows;
}

(async () => {
  const csv = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(csv);
  // Detect header
  let start = 0;
  const header = rows[0]?.map(h => h.toLowerCase());
  const hasHeader = header && (header.includes('email') || header.includes('name'));
  if (hasHeader) start = 1;

  const emailListFile = dataPath('email_list.json');
  const list = readJsonSafe(emailListFile, []);
  const normalized = (list || []).map(e => ({ type: e.type || 'student', ...e, type: (e.type || 'student') }));
  const existing = new Set(normalized.filter(e => e.type === 'employer').map(e => (e.email || '').toLowerCase()));

  let added = 0, skipped = 0;
  for (let i = start; i < rows.length; i++) {
    const [emailRaw, nameRaw, tagsRaw] = rows[i];
    const email = (emailRaw || '').toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
    if (existing.has(email)) { skipped++; continue; }
    const name = nameRaw || '';
    const tags = (tagsRaw || '').split('|').join(',').split(',').map(t => t.trim()).filter(Boolean);
    normalized.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      email,
      name,
      tags,
      status: 'active',
      type: 'employer',
      addedDate: new Date().toISOString(),
      lastEmailSent: null,
      totalEmailsSent: 0
    });
    existing.add(email);
    added++;
  }

  writeJson(emailListFile, normalized);
  console.log(`✅ CSV import complete. Added ${added}, skipped ${skipped}. Total emails: ${normalized.length}.`);
})();
