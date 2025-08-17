const fs = require('fs').promises;
const path = require('path');

async function initializeAnalytics() {
    console.log('🔧 Initializing realistic analytics data...');
    
    const analyticsPath = path.join(__dirname, 'data', 'analytics.json');
    
    // Generate realistic historical data for the past 30 days
    const now = new Date();
    const dailyData = {};
    let totalViews = 0;
    
    // Generate daily page views for the past 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // Simulate realistic daily traffic (varying between 200-800 views per day)
        const baseViews = 300;
        const variance = Math.floor(Math.random() * 400) + 100; // 100-500 additional views
        const weekendReduction = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1; // Less traffic on weekends
        
        const dayViews = Math.floor((baseViews + variance) * weekendReduction);
        dailyData[dateString] = dayViews;
        totalViews += dayViews;
    }
    
    // Generate realistic page distribution
    const pages = {
        '/': Math.floor(totalViews * 0.25), // Home page gets 25% of traffic
        '/jobs': Math.floor(totalViews * 0.30), // Jobs page gets 30%
        '/job-detail.html': Math.floor(totalViews * 0.20), // Job details get 20%
        '/register': Math.floor(totalViews * 0.08), // Registration gets 8%
        '/login': Math.floor(totalViews * 0.05), // Login gets 5%
        '/careers': Math.floor(totalViews * 0.04), // Careers gets 4%
        '/contact': Math.floor(totalViews * 0.03), // Contact gets 3%
        '/employers': Math.floor(totalViews * 0.03), // Employers gets 3%
        '/blog': Math.floor(totalViews * 0.02) // Blog gets 2%
    };
    
    // Generate visitor sessions (simulating unique visitors)
    const sessions = {};
    const uniqueVisitors = Math.floor(totalViews * 0.3); // Assume 30% conversion rate from views to unique visitors
    
    for (let i = 0; i < uniqueVisitors; i++) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const visitDate = new Date();
        visitDate.setDate(now.getDate() - Math.floor(Math.random() * 30));
        
        sessions[sessionId] = {
            firstVisit: visitDate.toISOString(),
            lastVisit: visitDate.toISOString(),
            pageViews: Math.floor(Math.random() * 5) + 1 // 1-5 page views per session
        };
    }
    
    const analyticsData = {
        pageViews: {
            total: totalViews,
            daily: dailyData,
            pages: pages
        },
        visitors: {
            unique: uniqueVisitors,
            returning: Math.floor(uniqueVisitors * 0.4), // 40% returning visitors
            sessions: sessions
        },
        lastUpdated: new Date().toISOString()
    };
    
    try {
        await fs.writeFile(analyticsPath, JSON.stringify(analyticsData, null, 2));
        console.log(`✅ Analytics initialized with ${totalViews.toLocaleString()} total page views`);
        console.log(`📊 Daily average: ${Math.floor(totalViews / 30).toLocaleString()} views`);
        console.log(`👥 Unique visitors: ${uniqueVisitors.toLocaleString()}`);
        console.log(`🔄 Returning visitors: ${Math.floor(uniqueVisitors * 0.4).toLocaleString()}`);
    } catch (error) {
        console.error('❌ Error initializing analytics:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    initializeAnalytics();
}

module.exports = initializeAnalytics;
