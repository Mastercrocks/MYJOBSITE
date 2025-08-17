const fs = require('fs').promises;
const path = require('path');

async function initializeRevenue() {
    console.log('💰 Initializing realistic revenue data...');
    
    const revenuePath = path.join(__dirname, 'data', 'revenue.json');
    
    // Generate realistic revenue data for the past 12 months
    const now = new Date();
    const monthlyData = {};
    const dailyData = {};
    let totalRevenue = 0;
    
    // Generate monthly revenue for the past 12 months
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(now.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        
        // Simulate growing revenue (between $2,000-$8,000 per month)
        const baseRevenue = 2000;
        const growth = (11 - i) * 200; // Growing trend
        const variance = Math.floor(Math.random() * 2000); // Random variance
        const monthlyRevenue = baseRevenue + growth + variance;
        
        monthlyData[monthKey] = monthlyRevenue;
        totalRevenue += monthlyRevenue;
    }
    
    // Generate daily revenue for the past 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // Daily revenue between $50-$400
        const dailyRevenue = Math.floor(Math.random() * 350) + 50;
        dailyData[dateString] = dailyRevenue;
    }
    
    // Revenue sources breakdown
    const sources = {
        job_postings: Math.floor(totalRevenue * 0.40), // 40% from job postings
        premium_listings: Math.floor(totalRevenue * 0.25), // 25% from premium listings
        employer_subscriptions: Math.floor(totalRevenue * 0.20), // 20% from subscriptions
        featured_jobs: Math.floor(totalRevenue * 0.10), // 10% from featured jobs
        resume_database_access: Math.floor(totalRevenue * 0.03), // 3% from resume access
        advertising: Math.floor(totalRevenue * 0.02) // 2% from advertising
    };
    
    // Sample transactions for recent activity
    const transactions = [];
    for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setDate(now.getDate() - Math.floor(Math.random() * 30));
        
        const transactionTypes = [
            { type: 'job_posting', amount: [29, 49, 99], description: 'Job Posting Fee' },
            { type: 'premium_listing', amount: [149, 199, 299], description: 'Premium Job Listing' },
            { type: 'subscription', amount: [299, 499, 999], description: 'Employer Subscription' },
            { type: 'featured_job', amount: [79, 129], description: 'Featured Job Promotion' }
        ];
        
        const randomType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = randomType.amount[Math.floor(Math.random() * randomType.amount.length)];
        
        transactions.push({
            id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            date: date.toISOString(),
            type: randomType.type,
            amount: amount,
            description: randomType.description,
            status: 'completed',
            employer: `Company ${Math.floor(Math.random() * 100) + 1}`
        });
    }
    
    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const revenueData = {
        revenue: {
            total: totalRevenue,
            monthly: monthlyData,
            daily: dailyData,
            sources: sources
        },
        transactions: transactions,
        subscriptions: {
            active: Math.floor(Math.random() * 25) + 15, // 15-40 active subscriptions
            expired: Math.floor(Math.random() * 10) + 5, // 5-15 expired
            trial: Math.floor(Math.random() * 8) + 2 // 2-10 trial
        },
        lastUpdated: new Date().toISOString()
    };
    
    try {
        await fs.writeFile(revenuePath, JSON.stringify(revenueData, null, 2));
        console.log(`✅ Revenue data initialized`);
        console.log(`💰 Total Revenue: $${totalRevenue.toLocaleString()}`);
        console.log(`📊 Monthly Average: $${Math.floor(totalRevenue / 12).toLocaleString()}`);
        console.log(`🏢 Active Subscriptions: ${revenueData.subscriptions.active}`);
        console.log(`💳 Recent Transactions: ${transactions.length}`);
    } catch (error) {
        console.error('❌ Error initializing revenue:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    initializeRevenue();
}

module.exports = initializeRevenue;
