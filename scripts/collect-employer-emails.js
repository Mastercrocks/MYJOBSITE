/*
  Collect local business emails around a given address using Google Places API (official),
  crawl their websites lightly for contact emails, and append them to data/email_list.json
  under type = 'employer'.

  Requirements:
  - Set GOOGLE_PLACES_API_KEY in your environment (.env)
  - Node 18+ (axios already in package.json)

  Usage examples (PowerShell):
    $env:GOOGLE_PLACES_API_KEY = 'YOUR_KEY'; node scripts/collect-employer-emails.js --address "160 Roseland Ave, Caldwell, NJ" --radius 15000 --target 2000
*/

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || process.env.PLACES_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY in environment');
  process.exit(1);
}

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name, def = undefined) {
  const i = args.findIndex(a => a === `--${name}`);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return def;
}
const ADDRESS = getArg('address', '160 Roseland Ave, Caldwell, NJ');
const RADIUS = parseInt(getArg('radius', '15000'), 10); // in meters (outer radius)
const TARGET = parseInt(getArg('target', '2000'), 10);  // desired number of employer emails
const GRID_STEP_METERS = parseInt(getArg('gridStep', '2000'), 10); // spacing between grid points
const MAX_PLACES = parseInt(getArg('maxPlaces', '12000'), 10); // cap on total places scanned
const TIMEOUT_MS = 12000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const EMAIL_LIST_FILE = path.join(DATA_DIR, 'email_list.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureArray(v) { return Array.isArray(v) ? v : []; }

function readEmailList() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(EMAIL_LIST_FILE)) return [];
    const raw = fs.readFileSync(EMAIL_LIST_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return ensureArray(arr);
  } catch (e) {
    console.warn('Could not read email_list.json:', e.message);
    return [];
  }
}

function writeEmailList(list) {
  try {
    fs.writeFileSync(EMAIL_LIST_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.error('Failed to write email_list.json:', e.message);
  }
}

function uniqId(prefix = 'employer') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Basic email regex (not overly strict)
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

function extractEmails(html) {
  if (!html) return [];
  const found = html.match(EMAIL_RE) || [];
  // Filter common throwaways
  const badHosts = ['example.com', 'email.com'];
  return Array.from(new Set(found)).filter(e => !badHosts.some(h => e.toLowerCase().endsWith('@' + h)));
}

async function httpGet(url) {
  try {
    const resp = await axios.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TalentSyncBot/1.0)' } });
    return String(resp.data || '');
  } catch (_) { return ''; }
}

async function geocode(address) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const { data } = await axios.get(url, { params: { address, key: API_KEY }, timeout: TIMEOUT_MS });
  if (!data || data.status !== 'OK' || !data.results?.length) throw new Error('Geocode failed');
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

async function placesNearby(lat, lng, radius) {
  const results = [];
  let pagetoken = undefined;
  do {
    const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const params = { location: `${lat},${lng}`, radius, key: API_KEY };
    if (pagetoken) params.pagetoken = pagetoken;
    const { data } = await axios.get(url, { params, timeout: TIMEOUT_MS });
    if (data?.results?.length) results.push(...data.results);
    pagetoken = data?.next_page_token;
    if (pagetoken) await sleep(2000); // token takes time to activate
  } while (pagetoken && results.length < 5000);
  return results;
}

async function placesTextSearch(lat, lng, radius, query = 'business') {
  const results = [];
  let pagetoken = undefined;
  do {
    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const params = { query, location: `${lat},${lng}`, radius, key: API_KEY };
    if (pagetoken) params.pagetoken = pagetoken;
    const { data } = await axios.get(url, { params, timeout: TIMEOUT_MS });
    if (data?.results?.length) results.push(...data.results);
    pagetoken = data?.next_page_token;
    if (pagetoken) await sleep(2000);
  } while (pagetoken && results.length < 5000);
  return results;
}

// Generate grid of lat/lng points around a center within radius
function gridAround(lat, lng, radius, step) {
  // Approx conversions
  const metersPerDegLat = 111320; // ~ at mid-latitudes
  const metersPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  const dLat = step / metersPerDegLat;
  const dLng = step / metersPerDegLng;
  const maxLat = radius / metersPerDegLat;
  const maxLng = radius / metersPerDegLng;
  const points = [];
  for (let dy = -maxLat; dy <= maxLat; dy += dLat) {
    for (let dx = -maxLng; dx <= maxLng; dx += dLng) {
      const plat = lat + dy;
      const plng = lng + dx;
      // Circle mask
      const distM = Math.sqrt(Math.pow(dy * metersPerDegLat, 2) + Math.pow(dx * metersPerDegLng, 2));
      if (distM <= radius) points.push({ lat: plat, lng: plng });
    }
  }
  return points;
}

async function placeDetails(place_id) {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  const fields = 'name,website,formatted_address';
  const { data } = await axios.get(url, { params: { place_id, fields, key: API_KEY }, timeout: TIMEOUT_MS });
  return data?.result || {};
}

function normalizeUrl(url) {
  try {
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
    const u = new URL(url);
    return u.origin;
  } catch { return ''; }
}

async function collect() {
  console.log(`📍 Address: ${ADDRESS}`);
  const { lat, lng } = await geocode(ADDRESS);
  console.log(`📡 Location: ${lat}, ${lng} | Radius: ${RADIUS}m | Target emails: ${TARGET}`);

  // Pull a broad set of candidates
  // Build grid and run multiple queries to broaden coverage
  console.log('�️  Building search grid...');
  const points = gridAround(lat, lng, RADIUS, GRID_STEP_METERS);
  console.log(`➡️  Grid points: ${points.length}`);

  const queries = [
    'business', 'company', 'office', 'corporate', 'store', 'shop', 'restaurant', 'cafe', 'bar',
    'construction', 'contractor', 'plumber', 'electrician', 'landscaping', 'auto repair',
    'medical', 'dental', 'chiropractic', 'veterinary', 'pharmacy',
    'law firm', 'accounting', 'real estate', 'insurance', 'bank',
    'school', 'college', 'gym', 'salon', 'spa', 'daycare'
  ];

  const byId = new Map();
  let scannedBatches = 0;
  for (const pt of points) {
    // Nearby search at this point
    const near = await placesNearby(pt.lat, pt.lng, Math.min(2000, GRID_STEP_METERS));
    near.forEach(p => { if (p.place_id && !byId.has(p.place_id)) byId.set(p.place_id, p); });

    // Text searches with a small subset of queries per point to limit quota
    for (const q of queries.slice(0, 6)) {
      const ts = await placesTextSearch(pt.lat, pt.lng, Math.min(2000, GRID_STEP_METERS), q);
      ts.forEach(p => { if (p.place_id && !byId.has(p.place_id)) byId.set(p.place_id, p); });
      await sleep(300);
    }

    scannedBatches++;
    if (byId.size >= MAX_PLACES) break;
    if (scannedBatches % 5 === 0) console.log(`... collected places so far: ${byId.size}`);
  }

  const places = Array.from(byId.values());
  console.log(`🧱 Unique places gathered: ${places.length}`);

  // Load existing list and index by email (employer segment only)
  let list = readEmailList().map(e => ({ type: 'student', ...e, type: e.type || 'student' }));
  const existing = new Set(list.filter(e => (e.type || 'student') === 'employer').map(e => (e.email || '').toLowerCase()));

  let added = 0, scanned = 0;
  for (const p of places) {
    if (added >= TARGET) break;
    scanned++;
    try {
      const details = await placeDetails(p.place_id);
      const name = details.name || p.name || '';
      const addr = details.formatted_address || p.vicinity || '';
      const origin = normalizeUrl(details.website || '');
      if (!origin || !name) continue;

      // Fetch homepage and contact page
      const html1 = await httpGet(origin);
      const html2 = await httpGet(origin + '/contact');
      const html3 = await httpGet(origin + '/contact-us');
      const emails = Array.from(new Set([...extractEmails(html1), ...extractEmails(html2), ...extractEmails(html3)]));
      if (!emails.length) continue;

      for (const email of emails) {
        const eLower = email.toLowerCase();
        if (existing.has(eLower)) continue;
        // Avoid obvious personal webmail addresses
        if (/@(gmail|yahoo|outlook|hotmail|aol)\.com$/i.test(eLower)) continue;
        list.push({
          id: uniqId(),
          email,
          name,
          tags: ['employer', 'local', 'caldwell-nj'],
          status: 'active',
          type: 'employer',
          addedDate: new Date().toISOString(),
          lastEmailSent: null,
          totalEmailsSent: 0,
          source: 'google-places',
          address: addr,
          website: origin
        });
        existing.add(eLower);
        added++;
        if (added >= TARGET) break;
      }
  // Be a good citizen with rate limiting
  await sleep(300);
    } catch (e) {
      // Skip on failure, continue
      await sleep(200);
    }
  }

  writeEmailList(list);
  console.log(`✅ Done. Scanned places=${scanned}, added employer emails=${added}, total list size=${list.length}`);
}

collect().catch(err => {
  console.error('Collector failed:', err && err.message ? err.message : err);
  process.exit(1);
});
