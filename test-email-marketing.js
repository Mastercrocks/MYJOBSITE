// Test Email Marketing API Endpoints
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Email Marketing API Endpoints...\n');

// Test 1: Check if email_list.json exists and is readable
console.log('1. Testing email_list.json file:');
try {
    const emailListPath = path.join(__dirname, 'data', 'email_list.json');
    const emailData = fs.readFileSync(emailListPath, 'utf8');
    const emails = JSON.parse(emailData);
    console.log(`   ✅ File exists with ${emails.length} emails`);
    console.log(`   📋 First email: ${emails[0]?.email || 'None'}`);
} catch (error) {
    console.log(`   ❌ Error reading email_list.json: ${error.message}`);
}

// Test 2: Test API endpoints with fetch
async function testAPIEndpoints() {
    console.log('\n2. Testing API endpoints:');
    
    const baseURL = 'http://localhost:3000/api/admin';
    const endpoints = [
        { method: 'GET', path: '/email-list', name: 'Get Email List' },
        { method: 'GET', path: '/stats', name: 'Get Dashboard Stats' },
        { method: 'GET', path: '/users', name: 'Get Users' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`   Testing ${endpoint.name}...`);
            
            const response = await fetch(`${baseURL}${endpoint.path}`, {
                method: endpoint.method,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`   ✅ ${endpoint.name}: ${response.status} - Success`);
                if (endpoint.path === '/email-list' && data.emails) {
                    console.log(`      📊 Found ${data.emails.length} emails`);
                }
            } else {
                console.log(`   ❌ ${endpoint.name}: ${response.status} - ${response.statusText}`);
            }
        } catch (error) {
            console.log(`   ❌ ${endpoint.name}: Network error - ${error.message}`);
        }
    }
}

// Test 3: Check server status
console.log('\n3. Testing server connectivity:');
fetch('http://localhost:3000')
    .then(response => {
        if (response.ok) {
            console.log('   ✅ Server is responding');
            return testAPIEndpoints();
        } else {
            console.log('   ❌ Server returned error:', response.status);
        }
    })
    .catch(error => {
        console.log('   ❌ Cannot connect to server:', error.message);
        console.log('   💡 Make sure the server is running with: npm start');
    })
    .finally(() => {
        console.log('\n🏁 Test complete!');
        process.exit(0);
    });
