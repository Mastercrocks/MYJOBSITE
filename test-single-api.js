const axios = require('axios');

async function testSingleEndpoint() {
    try {
        console.log('🧪 Testing /api/admin/stats endpoint directly...\n');
        
        const response = await axios.get('http://localhost:3000/api/admin/stats');
        console.log('✅ API Response received');
        console.log('Status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testSingleEndpoint();
