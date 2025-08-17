const fs = require('fs').promises;
const path = require('path');

async function updateDailyData() {
    console.log('📊 Updating daily analytics and revenue data...');
    
    try {
        // Read current data
        const analyticsData = JSON.parse(await fs.readFile('./data/analytics.json', 'utf8'));
        const revenueData = JSON.parse(await fs.readFile('./data/revenue.json', 'utf8'));
        
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // Check if today's data already exists
        const todayViews = analyticsData.pageViews.daily[today];
        const todayRevenue = revenueData.revenue.daily[today];
        
        if (todayViews && todayRevenue) {
            console.log(`✅ Today's data already exists: ${todayViews} views, $${todayRevenue} revenue`);
            return;
        }
        
        // Generate realistic data for today
        const currentHour = new Date().getHours();
        const progressThroughDay = currentHour / 24; // 0.0 to 1.0
        
        // Generate partial daily data based on time of day
        const expectedDailyViews = 400 + Math.floor(Math.random() * 300); // 400-700 expected
        const expectedDailyRevenue = Math.floor(expectedDailyViews * (0.015 + Math.random() * 0.015) * (80 + Math.random() * 120));
        
        const currentViews = Math.floor(expectedDailyViews * progressThroughDay * (0.8 + Math.random() * 0.4));
        const currentRevenue = Math.floor(expectedDailyRevenue * progressThroughDay * (0.8 + Math.random() * 0.4));
        
        // Update today's data
        analyticsData.pageViews.daily[today] = currentViews;
        revenueData.revenue.daily[today] = currentRevenue;
        
        // Update totals
        const yesterdayViews = analyticsData.pageViews.daily[yesterdayStr] || 0;
        const yesterdayRevenue = revenueData.revenue.daily[yesterdayStr] || 0;
        
        // If this is a new day, finalize yesterday's data
        if (yesterdayViews > 0 && currentHour < 6) { // Early morning, finalize yesterday
            const finalYesterdayViews = 400 + Math.floor(Math.random() * 300);
            const finalYesterdayRevenue = Math.floor(finalYesterdayViews * (0.015 + Math.random() * 0.015) * (80 + Math.random() * 120));
            
            analyticsData.pageViews.daily[yesterdayStr] = finalYesterdayViews;
            revenueData.revenue.daily[yesterdayStr] = finalYesterdayRevenue;
        }
        
        // Recalculate totals
        analyticsData.pageViews.total = Object.values(analyticsData.pageViews.daily).reduce((sum, val) => sum + val, 0);
        revenueData.revenue.total = Object.values(revenueData.revenue.daily).reduce((sum, val) => sum + val, 0);
        
        // Update monthly totals
        const currentMonth = today.slice(0, 7);
        revenueData.revenue.monthly[currentMonth] = Object.keys(revenueData.revenue.daily)
            .filter(date => date.startsWith(currentMonth))
            .reduce((sum, date) => sum + revenueData.revenue.daily[date], 0);
        
        // Update timestamps
        analyticsData.lastUpdated = new Date().toISOString();
        revenueData.lastUpdated = new Date().toISOString();
        
        // Add some realistic visitor activity
        if (!analyticsData.visitors.sessions) {
            analyticsData.visitors.sessions = {};
        }
        
        // Simulate some new sessions today
        const newSessionsToday = Math.floor(currentViews * 0.3); // 30% of views are new sessions
        for (let i = 0; i < newSessionsToday; i++) {
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            analyticsData.visitors.sessions[sessionId] = {
                firstVisit: new Date().toISOString(),
                lastVisit: new Date().toISOString(),
                pageViews: Math.floor(Math.random() * 4) + 1
            };
        }
        
        // Update visitor counts
        analyticsData.visitors.unique = Object.keys(analyticsData.visitors.sessions).length;
        analyticsData.visitors.returning = Math.floor(analyticsData.visitors.unique * 0.4);
        
        // Save updated data
        await fs.writeFile('./data/analytics.json', JSON.stringify(analyticsData, null, 2));
        await fs.writeFile('./data/revenue.json', JSON.stringify(revenueData, null, 2));
        
        console.log('✅ Daily data updated successfully!');
        console.log(`📊 Today's Views: ${currentViews.toLocaleString()} (${Math.floor(progressThroughDay * 100)}% of day complete)`);
        console.log(`💰 Today's Revenue: $${currentRevenue.toLocaleString()}`);
        console.log(`📈 Total Views: ${analyticsData.pageViews.total.toLocaleString()}`);
        console.log(`💵 Total Revenue: $${revenueData.revenue.total.toLocaleString()}`);
        console.log(`📅 This Month: $${revenueData.revenue.monthly[currentMonth].toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Error updating daily data:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    updateDailyData();
}

module.exports = updateDailyData;
