const http = require('http');

// Test the stats API
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/stats',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const stats = JSON.parse(data);
            console.log('✅ Stats API Response:');
            console.log('📊 Total Page Views:', stats.totals.pageViews?.toLocaleString() || 'Not available');
            console.log('👥 Total Users:', stats.totals.users?.toLocaleString() || 'Not available');
            console.log('💼 Total Jobs:', stats.totals.jobs?.toLocaleString() || 'Not available');
            console.log('📈 Weekly Page Views:', stats.weekly.pageViews?.toLocaleString() || 'Not available');
            console.log('🎯 Unique Visitors:', stats.analytics?.uniqueVisitors?.toLocaleString() || 'Not available');
        } catch (error) {
            console.error('❌ Error parsing response:', error);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error making request:', error.message);
});

req.end();
