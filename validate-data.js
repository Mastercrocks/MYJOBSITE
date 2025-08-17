const fs = require('fs').promises;

async function validateDailyData() {
    console.log('🔍 Validating daily data accuracy...');
    
    try {
        const analytics = JSON.parse(await fs.readFile('./data/analytics.json', 'utf8'));
        const revenue = JSON.parse(await fs.readFile('./data/revenue.json', 'utf8'));
        
        const today = new Date().toISOString().split('T')[0];
        const issues = [];
        
        // Validation 1: Check if totals match daily sums
        const calculatedViewsTotal = Object.values(analytics.pageViews.daily).reduce((sum, val) => sum + val, 0);
        const calculatedRevenueTotal = Object.values(revenue.revenue.daily).reduce((sum, val) => sum + val, 0);
        
        if (analytics.pageViews.total !== calculatedViewsTotal) {
            issues.push(`❌ Views total mismatch: ${analytics.pageViews.total} vs ${calculatedViewsTotal}`);
            analytics.pageViews.total = calculatedViewsTotal;
        } else {
            console.log('✅ Page views total is accurate');
        }
        
        if (Math.abs(revenue.revenue.total - calculatedRevenueTotal) > 100) { // Allow small difference
            issues.push(`❌ Revenue total mismatch: ${revenue.revenue.total} vs ${calculatedRevenueTotal}`);
            revenue.revenue.total = calculatedRevenueTotal;
        } else {
            console.log('✅ Revenue total is accurate');
        }
        
        // Validation 2: Check revenue/views correlation
        const avgRevenuePerView = revenue.revenue.total / analytics.pageViews.total;
        if (avgRevenuePerView < 2 || avgRevenuePerView > 10) {
            issues.push(`⚠️  Revenue per view seems off: $${avgRevenuePerView.toFixed(2)} (should be $2-$10)`);
        } else {
            console.log(`✅ Revenue per view is realistic: $${avgRevenuePerView.toFixed(2)}`);
        }
        
        // Validation 3: Check for missing dates
        const dates = Object.keys(analytics.pageViews.daily).sort();
        const revenueDate = Object.keys(revenue.revenue.daily).sort();
        
        if (dates.length !== revenueDate.length) {
            issues.push(`❌ Date mismatch: ${dates.length} analytics dates vs ${revenueDate.length} revenue dates`);
        }
        
        // Validation 4: Check monthly totals
        const monthlyCalculated = {};
        Object.keys(revenue.revenue.daily).forEach(date => {
            const month = date.slice(0, 7);
            monthlyCalculated[month] = (monthlyCalculated[month] || 0) + revenue.revenue.daily[date];
        });
        
        let monthlyIssues = 0;
        Object.keys(revenue.revenue.monthly).forEach(month => {
            const expected = monthlyCalculated[month] || 0;
            const actual = revenue.revenue.monthly[month];
            if (Math.abs(expected - actual) > 50) {
                monthlyIssues++;
                revenue.revenue.monthly[month] = expected;
            }
        });
        
        if (monthlyIssues > 0) {
            issues.push(`❌ Fixed ${monthlyIssues} monthly total mismatches`);
        } else {
            console.log('✅ Monthly revenue totals are accurate');
        }
        
        // Validation 5: Check today's data exists and is reasonable
        const todayViews = analytics.pageViews.daily[today];
        const todayRevenue = revenue.revenue.daily[today];
        
        if (!todayViews || !todayRevenue) {
            issues.push(`❌ Missing today's data: ${todayViews || 0} views, $${todayRevenue || 0} revenue`);
        } else {
            const todayRatio = todayRevenue / todayViews;
            if (todayRatio < 1 || todayRatio > 15) {
                issues.push(`⚠️  Today's revenue/view ratio seems off: $${todayRatio.toFixed(2)}`);
            } else {
                console.log(`✅ Today's data looks good: ${todayViews} views → $${todayRevenue}`);
            }
        }
        
        // Validation 6: Revenue sources should add up
        const sourcesTotal = Object.values(revenue.revenue.sources).reduce((sum, val) => sum + val, 0);
        if (Math.abs(sourcesTotal - revenue.revenue.total) > revenue.revenue.total * 0.1) {
            issues.push(`❌ Revenue sources don't match total: $${sourcesTotal} vs $${revenue.revenue.total}`);
            
            // Fix revenue sources proportionally
            const ratio = revenue.revenue.total / sourcesTotal;
            Object.keys(revenue.revenue.sources).forEach(source => {
                revenue.revenue.sources[source] = Math.floor(revenue.revenue.sources[source] * ratio);
            });
        } else {
            console.log('✅ Revenue sources add up correctly');
        }
        
        // If we fixed issues, save the corrected data
        if (issues.length > 0) {
            analytics.lastUpdated = new Date().toISOString();
            revenue.lastUpdated = new Date().toISOString();
            
            await fs.writeFile('./data/analytics.json', JSON.stringify(analytics, null, 2));
            await fs.writeFile('./data/revenue.json', JSON.stringify(revenue, null, 2));
            
            console.log('\n🔧 Fixed Issues:');
            issues.forEach(issue => console.log(issue));
        }
        
        // Summary
        console.log('\n📊 Data Summary:');
        console.log(`📈 Total Page Views: ${analytics.pageViews.total.toLocaleString()}`);
        console.log(`💰 Total Revenue: $${revenue.revenue.total.toLocaleString()}`);
        console.log(`📅 Days of data: ${Object.keys(analytics.pageViews.daily).length}`);
        console.log(`💳 Transactions: ${revenue.transactions.length}`);
        console.log(`👥 Unique visitors: ${analytics.visitors.unique.toLocaleString()}`);
        console.log(`🔄 Active subscriptions: ${revenue.subscriptions.active}`);
        
        const currentMonth = today.slice(0, 7);
        console.log(`📆 This month: ${analytics.pageViews.daily[today] || 0} views today, $${revenue.revenue.monthly[currentMonth].toLocaleString()} total`);
        
        if (issues.length === 0) {
            console.log('\n✅ All data is accurate and consistent!');
        } else {
            console.log(`\n🔧 Fixed ${issues.length} data consistency issues`);
        }
        
    } catch (error) {
        console.error('❌ Error validating data:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    validateDailyData();
}

module.exports = validateDailyData;
