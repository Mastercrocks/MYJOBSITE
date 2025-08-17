const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(express.json());
app.use(express.static('Public'));

// Read JSON file helper
async function readJSONFile(filename) {
    try {
        const filePath = path.join(__dirname, 'data', filename);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
}

// Applications API endpoint
app.get('/api/admin/applications', async (req, res) => {
    try {
        console.log('📋 Applications API called at', new Date().toISOString());
        console.log('📍 Request headers:', req.headers);
        
        const applications = await readJSONFile('career_applications.json');
        console.log(`✅ Found ${applications.length} applications`);
        
        if (applications.length > 0) {
            console.log('📄 First application:', JSON.stringify(applications[0], null, 2));
        }
        
        const response = { applications };
        console.log('📤 Sending response:', JSON.stringify(response, null, 2));
        
        res.json(response);
    } catch (error) {
        console.error('❌ Error in applications API:', error);
        res.status(500).json({ error: 'Failed to load applications' });
    }
});

// Admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin', 'dashboard.html'));
});

const port = 3000;
const server = app.listen(port, () => {
    console.log(`🚀 Minimal server running on http://localhost:${port}`);
    console.log(`📋 Admin dashboard: http://localhost:${port}/admin`);
    console.log(`🔗 Applications API: http://localhost:${port}/api/admin/applications`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
