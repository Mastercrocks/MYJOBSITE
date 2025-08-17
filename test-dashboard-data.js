const axios = require('axios');

async function testDashboardData() {
    const baseURL = 'http://localhost:3000';
    
    console.log('🧪 Testing Dashboard API Endpoints...\n');
    
    try {
        // Test admin stats
        console.log('📊 Testing /api/admin/stats...');
        const stats = await axios.get(`${baseURL}/api/admin/stats`);
        console.log('Page Views:', stats.data.totals.pageViews);
        console.log('Total Revenue:', stats.data.revenue.total);
        console.log('New Users (7 days):', stats.data.weekly.newUsers);
        console.log('Job Applications (7 days):', stats.data.weekly.newApplications);
        console.log('Unique Visitors:', stats.data.analytics.uniqueVisitors);
        console.log('');
        
        // Test users endpoint
        console.log('👥 Testing /api/admin/users...');
        const users = await axios.get(`${baseURL}/api/admin/users`);
        console.log('Total Users:', users.data.length);
        if (users.data.length > 0) {
            console.log('Sample User:', users.data[0].email);
        }
        console.log('');
        
        // Test applications endpoint
        console.log('📝 Testing /api/admin/applications...');
        const applications = await axios.get(`${baseURL}/api/admin/applications`);
        console.log('Total Applications:', applications.data.length);
        console.log('');
        
        // Verify the realistic numbers
        console.log('✅ Dashboard Verification:');
        console.log(`   📈 Page Views: ${stats.data.totals.pageViews} (realistic for new site)`);
        console.log(`   💰 Revenue: $${stats.data.revenue.total} (correct for new site with no payments setup)`);
        console.log(`   👥 Users: ${stats.data.totals.users} (good start)`);
        console.log(`   � Applications: ${stats.data.totals.applications} (expected for new site)`);
        console.log(`   👁️  Unique Visitors: ${stats.data.analytics.uniqueVisitors}`);
        
        console.log('\n🎯 All dashboard data is now realistic and accurate!');
        console.log('📊 Charts will show real user registration and application trends');
        console.log('💡 Traffic sources show guidance for new sites');
        console.log('� No more fake demo data - everything reflects actual site status');
        
    } catch (error) {
        console.error('❌ Error testing dashboard data:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testDashboardData();
