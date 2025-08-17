const fs = require('fs').promises;
const path = require('path');

// Analytics tracking middleware
async function trackPageView(req, res, next) {
    try {
        // Only track GET requests for HTML pages
        if (req.method !== 'GET') {
            return next();
        }

        // Skip API routes and static files
        if (req.path.startsWith('/api/') || 
            req.path.startsWith('/js/') || 
            req.path.startsWith('/css/') || 
            req.path.startsWith('/images/') ||
            req.path.includes('.')) {
            return next();
        }

        // Load current analytics data
        const analyticsPath = path.join(__dirname, '../data/analytics.json');
        let analytics;
        
        try {
            const data = await fs.readFile(analyticsPath, 'utf8');
            analytics = JSON.parse(data);
        } catch (error) {
            // Initialize analytics if file doesn't exist
            analytics = {
                pageViews: {
                    total: 0,
                    daily: {},
                    pages: {}
                },
                visitors: {
                    unique: 0,
                    returning: 0,
                    sessions: {}
                },
                lastUpdated: null
            };
        }

        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Track page view
        analytics.pageViews.total += 1;
        analytics.pageViews.daily[today] = (analytics.pageViews.daily[today] || 0) + 1;
        analytics.pageViews.pages[req.path] = (analytics.pageViews.pages[req.path] || 0) + 1;
        
        // Track visitor (basic session tracking)
        const sessionId = req.sessionID || req.ip + req.headers['user-agent'];
        if (!analytics.visitors.sessions[sessionId]) {
            analytics.visitors.unique += 1;
            analytics.visitors.sessions[sessionId] = {
                firstVisit: new Date().toISOString(),
                lastVisit: new Date().toISOString(),
                pageViews: 0
            };
        } else {
            analytics.visitors.returning += 1;
            analytics.visitors.sessions[sessionId].lastVisit = new Date().toISOString();
        }
        
        analytics.visitors.sessions[sessionId].pageViews += 1;
        analytics.lastUpdated = new Date().toISOString();

        // Update revenue tracking based on page views (simulate conversions)
        // Only track revenue for certain actions - BUT DISABLED FOR NEW SITES
        const revenueGeneratingPages = ['/employers', '/job-detail.html', '/register'];
        const isRevenueGenerating = revenueGeneratingPages.some(page => req.path.includes(page)) || 
                                   req.path.includes('premium') || 
                                   req.path.includes('featured');
        
        // DISABLED: Don't generate fake revenue for new sites
        // Real revenue will be tracked when actual payment processing is implemented
        /*
        if (isRevenueGenerating && Math.random() < 0.02) { // 2% chance of generating revenue
            try {
                const revenueData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/revenue.json'), 'utf8'));
                
                // Simulate a transaction
                const transactionAmounts = [29, 49, 99, 149, 199, 299];
                const amount = transactionAmounts[Math.floor(Math.random() * transactionAmounts.length)];
                
                revenueData.revenue.total += amount;
                revenueData.revenue.daily[today] = (revenueData.revenue.daily[today] || 0) + amount;
                
                // Update current month
                const currentMonth = today.slice(0, 7);
                revenueData.revenue.monthly[currentMonth] = (revenueData.revenue.monthly[currentMonth] || 0) + amount;
                
                // Add transaction record
                const transaction = {
                    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    date: new Date().toISOString(),
                    type: 'job_posting',
                    amount: amount,
                    description: 'Online Job Posting',
                    status: 'completed',
                    page: req.path
                };
                
                revenueData.transactions.unshift(transaction);
                if (revenueData.transactions.length > 50) {
                    revenueData.transactions = revenueData.transactions.slice(0, 50); // Keep only latest 50
                }
                
                revenueData.lastUpdated = new Date().toISOString();
                
                await fs.writeFile(path.join(__dirname, '../data/revenue.json'), JSON.stringify(revenueData, null, 2));
                
            } catch (revenueError) {
                console.error('Revenue tracking error:', revenueError);
            }
        }
        */

        // Clean up old sessions (keep only last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        Object.keys(analytics.visitors.sessions).forEach(sessionId => {
            const session = analytics.visitors.sessions[sessionId];
            if (new Date(session.lastVisit) < thirtyDaysAgo) {
                delete analytics.visitors.sessions[sessionId];
            }
        });

        // Save updated analytics
        await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2));
        
        // Add analytics data to response locals for potential use
        res.locals.analytics = analytics;
        
    } catch (error) {
        console.error('Analytics tracking error:', error);
        // Don't let analytics errors break the app
    }
    
    next();
}

module.exports = trackPageView;
