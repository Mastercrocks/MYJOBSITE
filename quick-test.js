const axios = require('axios');

async function testAPI() {
    try {
        console.log('Testing fresh jobs API...');
        const response = await axios.get('http://localhost:3000/api/fresh?limit=5');
        console.log('✅ API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ API Error:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testAPI();
