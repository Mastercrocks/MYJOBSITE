const fs = require('fs').promises;

async function createNewSiteData() {
    console.log('🚀 Creating realistic data for a NEW job site...');
    
    // For a brand new site, we should have:
    // - Very low traffic (maybe 5-50 views per day)
    // - NO revenue yet (site is new, no subscriptions set up)
    // - Minimal user activity
    
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 7); // Only 7 days of data for a new site
    
    const newAnalytics = {
        pageViews: {
            total: 0,
            daily: {},
            pages: {
                "/": 0,
                "/jobs": 0,
                "/register": 0,
                "/login": 0,
                "/employers": 0
            }
        },
        visitors: {
            unique: 0,
            returning: 0,
            sessions: {}
        },
        lastUpdated: new Date().toISOString()
    };
    
    const newRevenue = {
        revenue: {
            total: 0, // NO revenue for new site
            monthly: {},
            daily: {},
            sources: {
                job_postings: 0,
                premium_listings: 0,
                employer_subscriptions: 0,
                featured_jobs: 0,
                resume_database_access: 0,
                advertising: 0
            }
        },
        transactions: [], // NO transactions yet
        subscriptions: {
            active: 0, // NO subscriptions yet
            expired: 0,
            trial: 0
        },
        lastUpdated: new Date().toISOString()
    };
    
    // Generate realistic LOW traffic for past 7 days
    let totalViews = 0;
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // Very low traffic for new site: 5-25 views per day
        const dailyViews = Math.floor(Math.random() * 20) + 5; // 5-25 views
        
        newAnalytics.pageViews.daily[dateString] = dailyViews;
        newRevenue.revenue.daily[dateString] = 0; // NO revenue
        
        totalViews += dailyViews;
    }
    
    newAnalytics.pageViews.total = totalViews;
    
    // Distribute page views realistically for new site
    newAnalytics.pageViews.pages["/"] = Math.floor(totalViews * 0.4); // 40% home page
    newAnalytics.pageViews.pages["/jobs"] = Math.floor(totalViews * 0.3); // 30% jobs page
    newAnalytics.pageViews.pages["/register"] = Math.floor(totalViews * 0.1); // 10% register
    newAnalytics.pageViews.pages["/login"] = Math.floor(totalViews * 0.1); // 10% login
    newAnalytics.pageViews.pages["/employers"] = Math.floor(totalViews * 0.1); // 10% employers
    
    // Very few unique visitors for new site
    newAnalytics.visitors.unique = Math.floor(totalViews * 0.6); // 60% unique visitors
    newAnalytics.visitors.returning = Math.floor(totalViews * 0.1); // 10% returning
    
    // Create a few session records
    for (let i = 0; i < newAnalytics.visitors.unique; i++) {
        const sessionId = `session_new_${Date.now()}_${i}`;
        const visitDate = new Date();
        visitDate.setDate(today.getDate() - Math.floor(Math.random() * 7));
        
        newAnalytics.visitors.sessions[sessionId] = {
            firstVisit: visitDate.toISOString(),
            lastVisit: visitDate.toISOString(),
            pageViews: Math.floor(Math.random() * 3) + 1 // 1-3 page views per session
        };
    }
    
    // Set current month to 0 revenue
    const currentMonth = today.toISOString().slice(0, 7);
    newRevenue.revenue.monthly[currentMonth] = 0;
    
    try {
        await fs.writeFile('./data/analytics.json', JSON.stringify(newAnalytics, null, 2));
        await fs.writeFile('./data/revenue.json', JSON.stringify(newRevenue, null, 2));
        
        console.log('✅ Created realistic NEW SITE data:');
        console.log(`📊 Total Page Views: ${totalViews} (past 7 days only)`);
        console.log(`💰 Total Revenue: $0 (no subscriptions set up yet)`);
        console.log(`👥 Unique Visitors: ${newAnalytics.visitors.unique}`);
        console.log(`🔄 Active Subscriptions: 0 (new site)`);
        console.log(`📅 Days of data: 7 (new site)`);
        console.log('');
        console.log('🎯 This reflects a realistic NEW job site:');
        console.log('   - Low traffic (5-25 views/day)');
        console.log('   - No revenue streams set up yet');
        console.log('   - Just starting to get visitors');
        console.log('   - No premium features launched');
        
    } catch (error) {
        console.error('❌ Error creating new site data:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    createNewSiteData();
}

module.exports = createNewSiteData;
