const cron = require('node-cron');
const RailwayJobScraper = require('./railwayJobScraper'); // Railway-optimized scraper
const fs = require('fs').promises;
const path = require('path');

class JobScrapingScheduler {
    constructor() {
        this.scraper = new RailwayJobScraper();
        this.isRunning = false;
        this.lastRunTime = null;
        this.successfulRuns = 0;
        this.failedRuns = 0;
        
        console.log('🤖 Railway Job Scraping Scheduler initialized');
    }

    // Start automated job scraping
    startScheduler() {
        console.log('⚡ Starting automated job scraping scheduler...');
        
        // Run every 2 hours (modify as needed)
        cron.schedule('0 */2 * * *', async () => {
            await this.runScrapingCycle();
        });

        // Run every day at 8 AM for comprehensive scraping
        cron.schedule('0 8 * * *', async () => {
            await this.runComprehensiveScraping();
        });

        // Run immediately on startup
        this.runScrapingCycle();
        
        console.log('✅ Scheduler started successfully!');
        console.log('📅 Jobs will be scraped every 2 hours');
        console.log('📅 Comprehensive scraping runs daily at 8 AM');
    }

    async runScrapingCycle() {
        if (this.isRunning) {
            console.log('⏳ Scraping already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        this.lastRunTime = new Date();
        
        console.log(`🚀 Starting scraping cycle at ${this.lastRunTime.toLocaleString()}`);
        
        try {
            // Quick scraping (focus on Indeed and LinkedIn)
            const jobs = await this.scraper.scrapeAllJobs();
            
            if (jobs && jobs.length > 0) {
                // Update the main jobs API endpoint
                await this.updateJobsAPI(jobs);
                this.successfulRuns++;
                console.log(`✅ Scraping cycle completed successfully! Found ${jobs.length} new jobs`);
            } else {
                console.log('ℹ️ No new jobs found in this cycle');
            }
            
        } catch (error) {
            this.failedRuns++;
            console.error('❌ Scraping cycle failed:', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    async runComprehensiveScraping() {
        console.log('🎯 Starting comprehensive daily scraping...');
        
        try {
            // Scrape from multiple locations and keywords
            const keywords = [
                'entry level college student',
                'recent graduate jobs',
                'internship',
                'junior developer',
                'entry level marketing',
                'college internship',
                'new graduate program'
            ];

            const locations = [
                'New York, NY',
                'Los Angeles, CA',
                'Chicago, IL',
                'Houston, TX',
                'Phoenix, AZ',
                'Philadelphia, PA',
                'San Antonio, TX',
                'San Diego, CA',
                'Dallas, TX',
                'Boston, MA'
            ];

            let allJobs = [];
            
            for (const keyword of keywords) {
                for (const location of locations.slice(0, 3)) { // Limit to prevent rate limiting
                    try {
                        console.log(`🔍 Scraping: "${keyword}" in ${location}`);
                        const jobs = await this.scraper.scrapeIndeedJobs(location, keyword);
                        allJobs.push(...jobs);
                        
                        // Add delay to prevent rate limiting
                        await this.delay(2000);
                    } catch (error) {
                        console.log(`⚠️ Error scraping ${keyword} in ${location}:`, error.message);
                    }
                }
            }

            // Remove duplicates and save
            const uniqueJobs = this.scraper.removeDuplicates(allJobs);
            await this.scraper.saveJobs(uniqueJobs);
            await this.updateJobsAPI(uniqueJobs);
            
            console.log(`🎉 Comprehensive scraping completed! Total jobs: ${uniqueJobs.length}`);
            
        } catch (error) {
            console.error('❌ Comprehensive scraping failed:', error.message);
        }
    }

    async updateJobsAPI(newJobs) {
        try {
            // Update the main jobs.json file that the API uses
            const mainJobsFile = path.join(__dirname, '../data/jobs.json');
            
            // Load existing jobs from main file
            let existingJobs = [];
            try {
                const data = await fs.readFile(mainJobsFile, 'utf8');
                existingJobs = JSON.parse(data);
            } catch (err) {
                // File doesn't exist, start fresh
            }

            // Merge with new jobs
            const allJobs = [...existingJobs, ...newJobs];
            const uniqueJobs = this.scraper.removeDuplicates(allJobs);

            // Keep only recent jobs (last 15 days for main API)
            const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
            const recentJobs = uniqueJobs.filter(job => 
                new Date(job.posted_date || job.scraped_at) > fifteenDaysAgo
            );

            // Save to main jobs file
            await fs.writeFile(mainJobsFile, JSON.stringify(recentJobs, null, 2));
            
            console.log(`💾 Updated main jobs API with ${recentJobs.length} jobs`);
            
        } catch (error) {
            console.error('❌ Error updating jobs API:', error.message);
        }
    }

    // Manual trigger for testing
    async runManualScraping() {
        console.log('🖱️ Manual scraping triggered...');
        await this.runScrapingCycle();
    }

    // Get scraping statistics
    getStats() {
        return {
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime,
            successfulRuns: this.successfulRuns,
            failedRuns: this.failedRuns,
            uptime: process.uptime()
        };
    }

    // Alias for compatibility with existing tests
    getScrapingStats() {
        return this.getStats();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobScrapingScheduler;
