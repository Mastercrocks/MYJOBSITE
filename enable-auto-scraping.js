#!/usr/bin/env node
/**
 * Enable Auto-Scraping System
 * Starts the automated job scraping with schedule
 */

const JobScheduler = require('./services/jobScheduler');

async function enableAutoScraping() {
    console.log('🤖 Enabling Automated Job Scraping System');
    console.log('==========================================\n');

    try {
        // Set environment variable
        process.env.ENABLE_AUTO_SCRAPING = 'true';
        
        console.log('✅ Environment variable set: ENABLE_AUTO_SCRAPING=true');
        
        // Initialize scheduler
        const scheduler = new JobScheduler();
        console.log('✅ Job scheduler initialized');
        
        // Start the automated scheduling
        scheduler.startScheduler();
        console.log('✅ Automated scraping started!');
        
        console.log('\n📅 Scraping Schedule:');
        console.log('• Every 2 hours: Quick scrape for new jobs');
        console.log('• Daily at 6 AM: Comprehensive scrape across all sources');
        console.log('• Sources: Indeed, LinkedIn, Craigslist, Google Jobs');
        
        console.log('\n🎯 Job Targeting:');
        console.log('• Entry-level positions');
        console.log('• College student opportunities');
        console.log('• Recent graduate roles');
        console.log('• Internships and trainee positions');
        
        // Run an immediate scrape to test
        console.log('\n🚀 Running initial scrape test...');
        const result = await scheduler.runScraping();
        
        console.log('✅ Initial scrape completed!');
        console.log(`📊 Results: ${result.newJobs} new jobs added (${result.totalJobs} total)`);
        
        console.log('\n🎉 Automated Job Scraping is now ACTIVE!');
        console.log('\n📱 Monitor with these endpoints:');
        console.log('• GET /api/scraping/stats - View scraping statistics');
        console.log('• GET /api/fresh - Get fresh scraped jobs');
        console.log('• POST /api/scrape-now - Manual scraping trigger');
        
        console.log('\n🚀 For Railway deployment, set this environment variable:');
        console.log('ENABLE_AUTO_SCRAPING=true');
        
        // Keep the process running
        console.log('\n⏰ System will continue running and scraping automatically...');
        console.log('Press Ctrl+C to stop the auto-scraping system');
        
        // Keep process alive
        setInterval(() => {
            const stats = scheduler.getScrapingStats();
            console.log(`\n📊 [${new Date().toLocaleTimeString()}] Scraping Stats:`, {
                lastRun: stats.lastSuccessfulScrape || 'Never',
                totalRuns: stats.totalRuns || 0,
                jobsToday: stats.jobsScrapedToday || 0
            });
        }, 300000); // Every 5 minutes
        
    } catch (error) {
        console.error('❌ Error enabling auto-scraping:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('1. Make sure all dependencies are installed: npm install');
        console.error('2. Check that services/jobScheduler.js exists');
        console.error('3. Verify data directory has write permissions');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping automated job scraping...');
    console.log('✅ Auto-scraping disabled. Restart with this script to re-enable.');
    process.exit(0);
});

// Run the auto-scraping enabler
if (require.main === module) {
    enableAutoScraping().catch(error => {
        console.error('💥 Failed to enable auto-scraping:', error);
        process.exit(1);
    });
}

module.exports = enableAutoScraping;
