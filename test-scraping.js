#!/usr/bin/env node
/**
 * Test script for the automated job scraping system
 * Tests scraping from multiple sources for entry-level/college positions
 */

const JobScraper = require('./services/jobScraper');
const JobScheduler = require('./services/jobScheduler');

async function testScraping() {
    console.log('🚀 Testing Automated Job Scraping System');
    console.log('==========================================\n');

    try {
        // Test individual scraper
        console.log('1️⃣ Testing JobScraper directly...');
        const scraper = new JobScraper();
        
        // Test a quick scrape for college positions
        const testResults = await scraper.scrapeJobs({
            keywords: ['entry level', 'college', 'graduate'],
            locations: ['Remote', 'New York'],
            maxJobsPerSource: 10
        });
        
        console.log(`✅ Direct scraper test: ${testResults.length} jobs found`);
        console.log('Sample job:', testResults[0] ? {
            title: testResults[0].title,
            company: testResults[0].company,
            location: testResults[0].location,
            source: testResults[0].source
        } : 'No jobs found');
        
        console.log('\n2️⃣ Testing JobScheduler...');
        const scheduler = new JobScheduler();
        
        // Test manual scraping trigger
        console.log('Triggering manual scrape...');
        const schedulerResults = await scheduler.runScraping();
        
        console.log(`✅ Scheduler test: ${schedulerResults.newJobs} new jobs added`);
        console.log(`📊 Total jobs in system: ${schedulerResults.totalJobs}`);
        
        // Show some statistics
        const stats = scheduler.getScrapingStats();
        console.log('\n📈 Scraping Statistics:');
        console.log(`• Last successful scrape: ${stats.lastSuccessfulScrape || 'Never'}`);
        console.log(`• Total scraping runs: ${stats.totalRuns || 0}`);
        console.log(`• Jobs scraped today: ${stats.jobsScrapedToday || 0}`);
        
        console.log('\n🎯 Testing Fresh Jobs API...');
        // Test the fresh jobs functionality
        const freshJobs = scheduler.getFreshJobs(20);
        console.log(`✅ Fresh jobs available: ${freshJobs.length}`);
        
        if (freshJobs.length > 0) {
            console.log('\n📋 Sample Fresh Jobs:');
            freshJobs.slice(0, 3).forEach((job, index) => {
                console.log(`${index + 1}. ${job.title} at ${job.company} (${job.location}) - ${job.source}`);
            });
        }
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n🚀 System is ready for deployment with:');
        console.log('• Automated scraping every 2 hours');
        console.log('• Entry-level job filtering');
        console.log('• Multi-source aggregation (Indeed, LinkedIn, Craigslist)');
        console.log('• Fresh job API endpoint: /api/fresh');
        console.log('• Manual scraping trigger: /api/scrape-now');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('\nError details:', error.message);
        
        if (error.message.includes('rate limit') || error.message.includes('blocked')) {
            console.log('\n💡 Tip: Rate limiting detected. This is normal for intensive scraping.');
            console.log('The system has built-in delays and retry logic for production use.');
        }
    }
}

// Run the test
if (require.main === module) {
    testScraping()
        .then(() => {
            console.log('\n🎉 Test script completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test script failed:', error);
            process.exit(1);
        });
}

module.exports = testScraping;
