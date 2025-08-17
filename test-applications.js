const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Simple test to read applications data
async function testApplications() {
    try {
        console.log('🔍 Testing applications data...');
        
        const filePath = path.join(__dirname, 'data', 'career_applications.json');
        console.log('📂 Reading from:', filePath);
        
        const data = await fs.readFile(filePath, 'utf8');
        const applications = JSON.parse(data);
        
        console.log('✅ Applications found:', applications.length);
        applications.forEach((app, index) => {
            console.log(`${index + 1}. ${app.firstName} ${app.lastName} - ${app.position}`);
        });
        
        // Test API endpoint
        app.get('/api/admin/applications', (req, res) => {
            res.json({ applications });
        });
        
        const server = app.listen(3001, () => {
            console.log('🚀 Test server running on http://localhost:3001');
            console.log('📝 Test API: http://localhost:3001/api/admin/applications');
        });
        
        // Keep server running for testing
        setTimeout(() => {
            console.log('🛑 Stopping test server...');
            server.close();
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testApplications();
