// EMPLOYERS.js
// This file will store new employer objects as they post jobs, before migration to MongoDB.
// Each employer will be appended as a JSON object in an array.

const fs = require('fs');
const path = require('path');

const EMPLOYERS_FILE = path.join(__dirname, 'EMPLOYERS.js');

function saveEmployer(employer) {
    let employers = [];
    if (fs.existsSync(EMPLOYERS_FILE)) {
        try {
            employers = JSON.parse(fs.readFileSync(EMPLOYERS_FILE, 'utf8'));
        } catch (e) {
            employers = [];
        }
    }
    // Prevent duplicates by email
    if (!employers.find(e => e.email === employer.email)) {
        employers.push(employer);
        fs.writeFileSync(EMPLOYERS_FILE, JSON.stringify(employers, null, 2));
    }
}

module.exports = { saveEmployer };
