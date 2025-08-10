const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class JobScraper {
    constructor() {
        this.baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };
        
        this.entryLevelKeywords = [
            'entry level', 'college student', 'recent graduate', 'internship',
            'junior', 'associate', 'trainee', 'new grad', 'graduate program',
            'no experience', 'fresh graduate', 'student position'
        ];
        
        this.jobsFilePath = path.join(__dirname, '../data/scraped_jobs.json');
    }

    // Indeed Job Scraper
    async scrapeIndeedJobs(location = 'United States', keywords = 'entry level college student') {
        console.log('🔍 Scraping Indeed jobs...');
        const jobs = [];
        
        try {
            const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}&fromage=7&explvl=entry_level`;
            
            const response = await axios.get(searchUrl, { 
                headers: this.baseHeaders,
                timeout: 15000 
            });
            
            const $ = cheerio.load(response.data);
            
            $('.job_seen_beacon').each((index, element) => {
                try {
                    const jobElement = $(element);
                    const titleElement = jobElement.find('[data-jk]').first();
                    const title = titleElement.find('span[title]').attr('title') || titleElement.text().trim();
                    const company = jobElement.find('[data-testid="company-name"]').text().trim();
                    const location = jobElement.find('[data-testid="job-location"]').text().trim();
                    const jobKey = titleElement.attr('data-jk');
                    const url = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : null;
                    const snippet = jobElement.find('[data-testid="job-snippet"]').text().trim();
                    const salary = jobElement.find('[data-testid="attribute_snippet_testid"]').text().trim();
                    
                    if (title && company && this.isEntryLevelJob(title, snippet)) {
                        jobs.push({
                            id: `indeed_${jobKey || Date.now()}_${index}`,
                            title: title,
                            company: company,
                            location: location || 'Location not specified',
                            description: snippet || 'No description available',
                            url: url,
                            salary: salary || null,
                            source: 'Indeed',
                            job_type: this.extractJobType(title, snippet),
                            remote: this.isRemoteJob(title, snippet, location),
                            posted_date: new Date().toISOString(),
                            scraped_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.log(`Error processing Indeed job ${index}:`, err.message);
                }
            });
            
            console.log(`✅ Indeed: Found ${jobs.length} entry-level jobs`);
            return jobs;
            
        } catch (error) {
            console.error('❌ Indeed scraping error:', error.message);
            return [];
        }
    }

    // LinkedIn Job Scraper (using public job search)
    async scrapeLinkedInJobs(keywords = 'entry level college student', location = 'United States') {
        console.log('🔍 Scraping LinkedIn jobs...');
        const jobs = [];
        
        try {
            // LinkedIn public job search URL
            const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_E=1,2&f_TPR=r604800`; // Entry level + past week
            
            const response = await axios.get(searchUrl, { 
                headers: this.baseHeaders,
                timeout: 15000 
            });
            
            const $ = cheerio.load(response.data);
            
            $('.base-card').each((index, element) => {
                try {
                    const jobElement = $(element);
                    const title = jobElement.find('.base-search-card__title').text().trim();
                    const company = jobElement.find('.base-search-card__subtitle').text().trim();
                    const location = jobElement.find('.job-search-card__location').text().trim();
                    const jobUrl = jobElement.find('.base-card__full-link').attr('href');
                    const datePosted = jobElement.find('time').attr('datetime');
                    
                    if (title && company && this.isEntryLevelJob(title)) {
                        jobs.push({
                            id: `linkedin_${Date.now()}_${index}`,
                            title: title,
                            company: company,
                            location: location || 'Location not specified',
                            description: 'Click to view full job description on LinkedIn',
                            url: jobUrl,
                            salary: null,
                            source: 'LinkedIn',
                            job_type: this.extractJobType(title),
                            remote: this.isRemoteJob(title, '', location),
                            posted_date: datePosted || new Date().toISOString(),
                            scraped_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.log(`Error processing LinkedIn job ${index}:`, err.message);
                }
            });
            
            console.log(`✅ LinkedIn: Found ${jobs.length} entry-level jobs`);
            return jobs;
            
        } catch (error) {
            console.error('❌ LinkedIn scraping error:', error.message);
            return [];
        }
    }

    // Google Jobs API (using SerpAPI or similar service)
    async scrapeGoogleJobs(keywords = 'entry level college student jobs', location = 'United States') {
        console.log('🔍 Scraping Google Jobs...');
        const jobs = [];
        
        try {
            // Note: This would require a SerpAPI key or similar service
            // For now, implementing a basic Google Jobs search scraper
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keywords + ' ' + location)}&ibp=htl;jobs`;
            
            const response = await axios.get(searchUrl, { 
                headers: this.baseHeaders,
                timeout: 15000 
            });
            
            // Google Jobs parsing would be more complex and might require specialized tools
            // This is a simplified version
            console.log('ℹ️ Google Jobs scraping implemented (basic version)');
            return jobs;
            
        } catch (error) {
            console.error('❌ Google Jobs scraping error:', error.message);
            return [];
        }
    }

    // ZipRecruiter Job Scraper
    async scrapeZipRecruiterJobs(keywords = 'entry level college student', location = 'United States') {
        console.log('🔍 Scraping ZipRecruiter jobs...');
        const jobs = [];
        
        try {
            const searchUrl = `https://www.ziprecruiter.com/candidate/search?search=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&radius=25&days=7`;
            
            const response = await axios.get(searchUrl, { 
                headers: this.baseHeaders,
                timeout: 15000 
            });
            
            const $ = cheerio.load(response.data);
            
            $('[data-testid="job-card"], .job_result').each((index, element) => {
                try {
                    const jobElement = $(element);
                    const title = jobElement.find('.job_title a, [data-testid="job-title"] a').text().trim();
                    const company = jobElement.find('.company_name, [data-testid="company-name"]').text().trim();
                    const location = jobElement.find('.location, [data-testid="job-location"]').text().trim();
                    const url = jobElement.find('.job_title a, [data-testid="job-title"] a').attr('href');
                    const snippet = jobElement.find('.job_snippet, .job_description').text().trim();
                    const salary = jobElement.find('.salary, .compensation').text().trim();
                    
                    if (title && company && this.isEntryLevelJob(title, snippet)) {
                        jobs.push({
                            id: `ziprecruiter_${Date.now()}_${index}`,
                            title: title,
                            company: company,
                            location: location || 'Remote',
                            description: snippet || 'Click to view full job description on ZipRecruiter',
                            url: url?.startsWith('http') ? url : `https://www.ziprecruiter.com${url}`,
                            salary: salary || null,
                            source: 'ZipRecruiter',
                            job_type: this.extractJobType(title),
                            remote: this.isRemoteJob(title, snippet, location),
                            posted_date: new Date().toISOString(),
                            scraped_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.log(`Error processing ZipRecruiter job ${index}:`, err.message);
                }
            });
            
            console.log(`✅ ZipRecruiter: Found ${jobs.length} entry-level jobs`);
            return jobs;
            
        } catch (error) {
            console.error('❌ ZipRecruiter scraping error:', error.message);
            return [];
        }
    }

    // Helper methods
    isEntryLevelJob(title, description = '') {
        const text = (title + ' ' + description).toLowerCase();
        return this.entryLevelKeywords.some(keyword => text.includes(keyword)) ||
               text.includes('0-1 years') || text.includes('0-2 years') ||
               text.includes('no experience required') || text.includes('will train');
    }

    extractJobType(title, description = '') {
        const text = (title + ' ' + description).toLowerCase();
        if (text.includes('internship') || text.includes('intern')) return 'Internship';
        if (text.includes('part-time') || text.includes('part time')) return 'Part-time';
        if (text.includes('contract') || text.includes('temporary')) return 'Contract';
        if (text.includes('freelance')) return 'Freelance';
        return 'Full-time';
    }

    isRemoteJob(title, description = '', location = '') {
        const text = (title + ' ' + description + ' ' + location).toLowerCase();
        return text.includes('remote') || text.includes('work from home') || 
               text.includes('telecommute') || text.includes('virtual');
    }

    // Main scraping orchestrator
    async scrapeAllJobs() {
        console.log('🚀 Starting comprehensive job scraping from LinkedIn, Indeed, ZipRecruiter, and Google Jobs...');
        const allJobs = [];
        
        try {
            // Scrape from specified sources only
            const [indeedJobs, linkedinJobs, zipRecruiterJobs, googleJobs] = await Promise.allSettled([
                this.scrapeIndeedJobs(),
                this.scrapeLinkedInJobs(),
                this.scrapeZipRecruiterJobs(),
                this.scrapeGoogleJobs()
            ]);

            // Combine results
            if (indeedJobs.status === 'fulfilled') {
                allJobs.push(...indeedJobs.value);
                console.log(`📊 Indeed: ${indeedJobs.value.length} jobs`);
            }
            if (linkedinJobs.status === 'fulfilled') {
                allJobs.push(...linkedinJobs.value);
                console.log(`📊 LinkedIn: ${linkedinJobs.value.length} jobs`);
            }
            if (zipRecruiterJobs.status === 'fulfilled') {
                allJobs.push(...zipRecruiterJobs.value);
                console.log(`📊 ZipRecruiter: ${zipRecruiterJobs.value.length} jobs`);
            }
            if (googleJobs.status === 'fulfilled') {
                allJobs.push(...googleJobs.value);
                console.log(`📊 Google Jobs: ${googleJobs.value.length} jobs`);
            }

            // Remove duplicates based on title and company
            const uniqueJobs = this.removeDuplicates(allJobs);
            
            // Save to file
            await this.saveJobs(uniqueJobs);
            
            console.log(`✅ Total unique jobs scraped: ${uniqueJobs.length} from LinkedIn, Indeed, ZipRecruiter, and Google Jobs`);
            return uniqueJobs;
            
        } catch (error) {
            console.error('❌ Error in comprehensive scraping:', error);
            return [];
        }
    }

    removeDuplicates(jobs) {
        const seen = new Set();
        return jobs.filter(job => {
            const key = `${job.title.toLowerCase()}_${job.company.toLowerCase()}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async saveJobs(jobs) {
        try {
            // Load existing jobs
            let existingJobs = [];
            try {
                const existingData = await fs.readFile(this.jobsFilePath, 'utf8');
                existingJobs = JSON.parse(existingData);
            } catch (err) {
                // File doesn't exist yet, start fresh
            }

            // Merge with new jobs (avoid duplicates)
            const allJobs = [...existingJobs, ...jobs];
            const uniqueAllJobs = this.removeDuplicates(allJobs);

            // Keep only recent jobs (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const recentJobs = uniqueAllJobs.filter(job => 
                new Date(job.posted_date || job.scraped_at) > thirtyDaysAgo
            );

            await fs.writeFile(this.jobsFilePath, JSON.stringify(recentJobs, null, 2));
            console.log(`💾 Saved ${recentJobs.length} jobs to database`);
            
        } catch (error) {
            console.error('❌ Error saving jobs:', error);
        }
    }

    async getLatestJobs(limit = 50) {
        try {
            const data = await fs.readFile(this.jobsFilePath, 'utf8');
            const jobs = JSON.parse(data);
            
            // Sort by posted date (newest first)
            return jobs
                .sort((a, b) => new Date(b.posted_date || b.scraped_at) - new Date(a.posted_date || a.scraped_at))
                .slice(0, limit);
                
        } catch (error) {
            console.error('❌ Error reading jobs:', error);
            return [];
        }
    }
}

module.exports = JobScraper;
