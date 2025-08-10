const express = require('express');
const router = express.Router();
const JobScraper = require('../services/jobScraper');
const JobScrapingScheduler = require('../services/jobScheduler');
const fs = require('fs').promises;
const path = require('path');

// Initialize scraper and scheduler
const scraper = new JobScraper();
const scheduler = new JobScrapingScheduler();

// GET /api/scraped-jobs - Get latest scraped jobs
router.get('/scraped-jobs', async (req, res) => {
    try {
        const { limit = 50, filter = 'all', location = 'all' } = req.query;
        
        let jobs = await scraper.getLatestJobs(parseInt(limit));
        
        // Apply filters
        if (filter !== 'all') {
            jobs = jobs.filter(job => 
                job.job_type.toLowerCase().includes(filter.toLowerCase()) ||
                job.title.toLowerCase().includes(filter.toLowerCase())
            );
        }
        
        if (location !== 'all') {
            jobs = jobs.filter(job => 
                job.location.toLowerCase().includes(location.toLowerCase())
            );
        }
        
        res.json({
            success: true,
            total: jobs.length,
            jobs: jobs,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error fetching scraped jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scraped jobs',
            jobs: []
        });
    }
});

// POST /api/scrape-now - Manually trigger scraping
router.post('/scrape-now', async (req, res) => {
    try {
        // Start scraping in background
        scheduler.runManualScraping().catch(err => {
            console.error('Manual scraping error:', err);
        });
        
        res.json({
            success: true,
            message: 'Job scraping started successfully',
            status: 'Running in background'
        });
        
    } catch (error) {
        console.error('Error starting manual scraping:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start scraping'
        });
    }
});

// GET /api/scraping-stats - Get scraping statistics
router.get('/scraping-stats', (req, res) => {
    try {
        const stats = scheduler.getStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get stats'
        });
    }
});

// GET /api/jobs/fresh - Get freshest jobs (combination of scraped + API)
router.get('/fresh', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        
        // Get scraped jobs
        const scrapedJobs = await scraper.getLatestJobs(parseInt(limit / 2));
        
        // Get API jobs (from your existing job service)
        let apiJobs = [];
        
        try {
            const jobApiService = require('../services/jobApiService');
            // Check if it's a class or direct functions
            if (typeof jobApiService === 'function') {
                const jobService = new jobApiService();
                const indeedJobs = await jobService.getIndeedJobs('entry level college student', 'United States');
                apiJobs = indeedJobs.slice(0, parseInt(limit / 2));
            } else if (jobApiService.getIndeedJobs) {
                const indeedJobs = await jobApiService.getIndeedJobs('entry level college student', 'United States');
                apiJobs = indeedJobs.slice(0, parseInt(limit / 2));
            }
        } catch (apiError) {
            console.log('API jobs unavailable, using only scraped jobs:', apiError.message);
        }
        
        // Combine and remove duplicates
        const allJobs = [...scrapedJobs, ...apiJobs];
        const uniqueJobs = scraper.removeDuplicates(allJobs);
        
        // Sort by posted date
        uniqueJobs.sort((a, b) => 
            new Date(b.posted_date || b.scraped_at) - new Date(a.posted_date || a.scraped_at)
        );
        
        res.json({
            success: true,
            total: uniqueJobs.length,
            jobs: uniqueJobs.slice(0, parseInt(limit)),
            sources: {
                scraped: scrapedJobs.length,
                api: apiJobs.length,
                unique: uniqueJobs.length
            },
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error fetching fresh jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch fresh jobs',
            jobs: []
        });
    }
});

// POST /api/jobs/refresh-all - Refresh all job sources
router.post('/refresh-all', async (req, res) => {
    try {
        console.log('🔄 Starting comprehensive job refresh...');
        
        // Run comprehensive scraping
        scheduler.runComprehensiveScraping().catch(err => {
            console.error('Comprehensive scraping error:', err);
        });
        
        res.json({
            success: true,
            message: 'Comprehensive job refresh started',
            status: 'This will take several minutes to complete',
            estimated_time: '10-15 minutes'
        });
        
    } catch (error) {
        console.error('Error starting comprehensive refresh:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start comprehensive refresh'
        });
    }
});

// GET /api/jobs/sources - Get available job sources and their status
router.get('/sources', async (req, res) => {
    try {
        const sources = [
            {
                name: 'Indeed',
                status: 'active',
                last_scraped: new Date().toISOString(),
                job_count: 0,
                description: 'Entry-level and college student positions'
            },
            {
                name: 'LinkedIn',
                status: 'active',
                last_scraped: new Date().toISOString(),
                job_count: 0,
                description: 'Professional entry-level opportunities'
            },
            {
                name: 'Craigslist',
                status: 'active',
                last_scraped: new Date().toISOString(),
                job_count: 0,
                description: 'Local job opportunities'
            }
        ];
        
        // Get actual job counts
        try {
            const jobs = await scraper.getLatestJobs(1000);
            sources[0].job_count = jobs.filter(j => j.source === 'Indeed').length;
            sources[1].job_count = jobs.filter(j => j.source === 'LinkedIn').length;
            sources[2].job_count = jobs.filter(j => j.source === 'Craigslist').length;
        } catch (err) {
            console.log('Could not get job counts');
        }
        
        res.json({
            success: true,
            sources: sources,
            total_active_sources: sources.filter(s => s.status === 'active').length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get source information'
        });
    }
});

module.exports = router;
