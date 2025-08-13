const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

class MassJobScraper {
    constructor() {
        this.baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };
        
        this.jobsFilePath = path.join(__dirname, '../data/jobs.json');
        this.targetJobCount = 15000; // Target 15k jobs
        
        // Major US cities for location diversity
        this.locations = [
            'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
            'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
            'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
            'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
            'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK',
            'Portland, OR', 'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD',
            'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA',
            'Kansas City, MO', 'Mesa, AZ', 'Atlanta, GA', 'Omaha, NE', 'Colorado Springs, CO',
            'Raleigh, NC', 'Virginia Beach, VA', 'Miami, FL', 'Oakland, CA', 'Minneapolis, MN',
            'Tulsa, OK', 'Arlington, TX', 'Tampa, FL', 'New Orleans, LA', 'Wichita, KS'
        ];
        
        // Entry-level keywords for targeting college students
        this.keywords = [
            'entry level', 'college student', 'recent graduate', 'internship',
            'junior', 'associate', 'trainee', 'new grad', 'graduate program',
            'part time student', 'student worker', 'campus job', 'college hire'
        ];
        
        // Job categories
        this.categories = [
            'marketing', 'sales', 'customer service', 'administration', 'data entry',
            'retail', 'hospitality', 'finance', 'accounting', 'human resources',
            'information technology', 'graphic design', 'content writing', 'social media',
            'research', 'operations', 'logistics', 'healthcare', 'education', 'consulting'
        ];
    }

    // Real Indeed Job Scraper with proper URLs
    async scrapeIndeedJobsReal(location, keyword, pages = 5) {
        console.log(`🔍 Scraping Indeed: ${keyword} in ${location}`);
        const jobs = [];
        
        try {
            for (let page = 0; page < pages; page++) {
                const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}&start=${page * 10}&fromage=30&explvl=entry_level`;
                
                try {
                    const response = await axios.get(searchUrl, { 
                        headers: this.baseHeaders,
                        timeout: 10000 
                    });
                    
                    const $ = cheerio.load(response.data);
                    
                    $('.job_seen_beacon, .slider_container .slider_item').each((index, element) => {
                        try {
                            const jobElement = $(element);
                            const titleElement = jobElement.find('h2 a[data-jk], .jobTitle a[data-jk]');
                            const jobKey = titleElement.attr('data-jk');
                            const title = titleElement.text().trim() || titleElement.find('span').text().trim();
                            const company = jobElement.find('[data-testid="company-name"], .companyName').text().trim();
                            const jobLocation = jobElement.find('[data-testid="job-location"], .companyLocation').text().trim();
                            const snippet = jobElement.find('[data-testid="job-snippet"], .summary').text().trim();
                            const salary = jobElement.find('.salary-snippet, .salaryText').text().trim();
                            
                            if (title && company && jobKey) {
                                jobs.push({
                                    id: `indeed_${jobKey}_${Date.now()}_${index}`,
                                    title: title,
                                    company: company,
                                    location: jobLocation || location,
                                    description: snippet || `${title} position at ${company}`,
                                    url: `https://www.indeed.com/viewjob?jk=${jobKey}`, // REAL URL
                                    salary: salary || null,
                                    source: 'Indeed',
                                    job_type: this.extractJobType(title, snippet),
                                    remote: this.isRemoteJob(title, snippet, jobLocation),
                                    posted_date: new Date().toISOString(),
                                    scraped_at: new Date().toISOString(),
                                    category: this.categorizeJob(title, snippet),
                                    entry_level: true
                                });
                            }
                        } catch (err) {
                            console.log(`Error processing job:`, err.message);
                        }
                    });
                    
                    // Add delay between requests
                    await this.delay(Math.random() * 2000 + 1000);
                    
                } catch (pageError) {
                    console.log(`Error on page ${page}:`, pageError.message);
                }
            }
            
        } catch (error) {
            console.error(`❌ Indeed scraping error for ${keyword} in ${location}:`, error.message);
        }
        
        return jobs;
    }

    // Real LinkedIn Job Scraper with proper URLs  
    async scrapeLinkedInJobsReal(keyword, location, pages = 3) {
        console.log(`🔍 Scraping LinkedIn: ${keyword} in ${location}`);
        const jobs = [];
        
        try {
            for (let page = 0; page < pages; page++) {
                const start = page * 25;
                const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_E=1,2&start=${start}&f_TPR=r2592000`; // Entry level + past month
                
                try {
                    const response = await axios.get(searchUrl, { 
                        headers: this.baseHeaders,
                        timeout: 10000 
                    });
                    
                    const $ = cheerio.load(response.data);
                    
                    $('.base-card, .job-search-card').each((index, element) => {
                        try {
                            const jobElement = $(element);
                            const titleElement = jobElement.find('.base-search-card__title, .job-search-card__title');
                            const title = titleElement.text().trim();
                            const company = jobElement.find('.base-search-card__subtitle, .job-search-card__subtitle').text().trim();
                            const jobLocation = jobElement.find('.job-search-card__location').text().trim();
                            const jobUrl = jobElement.find('.base-card__full-link, .job-search-card__link').attr('href');
                            
                            if (title && company && jobUrl) {
                                jobs.push({
                                    id: `linkedin_${Date.now()}_${page}_${index}`,
                                    title: title,
                                    company: company,
                                    location: jobLocation || location,
                                    description: `${title} position at ${company}. View full details on LinkedIn.`,
                                    url: jobUrl.startsWith('http') ? jobUrl : `https://www.linkedin.com${jobUrl}`, // REAL URL
                                    salary: null,
                                    source: 'LinkedIn',
                                    job_type: this.extractJobType(title),
                                    remote: this.isRemoteJob(title, '', jobLocation),
                                    posted_date: new Date().toISOString(),
                                    scraped_at: new Date().toISOString(),
                                    category: this.categorizeJob(title),
                                    entry_level: true
                                });
                            }
                        } catch (err) {
                            console.log(`Error processing LinkedIn job:`, err.message);
                        }
                    });
                    
                    await this.delay(Math.random() * 3000 + 2000);
                    
                } catch (pageError) {
                    console.log(`Error on LinkedIn page ${page}:`, pageError.message);
                }
            }
            
        } catch (error) {
            console.error(`❌ LinkedIn scraping error for ${keyword} in ${location}:`, error.message);
        }
        
        return jobs;
    }

    // Mass scraping orchestrator
    async scrapeThousandsOfJobs() {
        console.log(`🚀 Starting mass job scraping - Target: ${this.targetJobCount} jobs`);
        const allJobs = [];
        let scraped = 0;
        
        try {
            // Shuffle arrays for variety
            const shuffledLocations = this.shuffle([...this.locations]);
            const shuffledKeywords = this.shuffle([...this.keywords]);
            const shuffledCategories = this.shuffle([...this.categories]);
            
            // Scrape from multiple sources and locations
            for (let i = 0; i < shuffledLocations.length && scraped < this.targetJobCount; i++) {
                const location = shuffledLocations[i];
                
                // Use different keyword combinations
                for (let j = 0; j < Math.min(3, shuffledKeywords.length) && scraped < this.targetJobCount; j++) {
                    const keyword = shuffledKeywords[j];
                    
                    console.log(`\n📍 Processing: ${keyword} in ${location} (${scraped}/${this.targetJobCount} jobs)`);
                    
                    // Scrape Indeed with multiple pages
                    const indeedJobs = await this.scrapeIndeedJobsReal(location, keyword, 10);
                    allJobs.push(...indeedJobs);
                    scraped += indeedJobs.length;
                    console.log(`   ✅ Indeed: +${indeedJobs.length} jobs`);
                    
                    if (scraped >= this.targetJobCount) break;
                    
                    // Scrape LinkedIn
                    const linkedinJobs = await this.scrapeLinkedInJobsReal(keyword, location, 5);
                    allJobs.push(...linkedinJobs);
                    scraped += linkedinJobs.length;
                    console.log(`   ✅ LinkedIn: +${linkedinJobs.length} jobs`);
                    
                    if (scraped >= this.targetJobCount) break;
                    
                    // Add delay between different keyword/location combinations
                    await this.delay(5000);
                }
                
                // Also scrape by category
                if (i < shuffledCategories.length && scraped < this.targetJobCount) {
                    const category = shuffledCategories[i];
                    const categoryKeyword = `${category} entry level`;
                    
                    const categoryJobs = await this.scrapeIndeedJobsReal(location, categoryKeyword, 5);
                    allJobs.push(...categoryJobs);
                    scraped += categoryJobs.length;
                    console.log(`   ✅ Category (${category}): +${categoryJobs.length} jobs`);
                }
                
                // Progress update
                if (i % 5 === 0) {
                    console.log(`\n📊 Progress: ${scraped} jobs scraped so far...`);
                }
            }
            
            // Remove duplicates and save
            const uniqueJobs = this.removeDuplicates(allJobs);
            await this.saveJobs(uniqueJobs);
            
            console.log(`\n🎉 Mass scraping complete!`);
            console.log(`📊 Total unique jobs: ${uniqueJobs.length}`);
            console.log(`📊 Sources: Indeed + LinkedIn`);
            console.log(`📊 Locations: ${this.locations.length} major US cities`);
            
            return uniqueJobs;
            
        } catch (error) {
            console.error('❌ Error in mass scraping:', error);
            // Save what we have so far
            if (allJobs.length > 0) {
                const uniqueJobs = this.removeDuplicates(allJobs);
                await this.saveJobs(uniqueJobs);
                console.log(`💾 Saved ${uniqueJobs.length} jobs before error`);
            }
            return allJobs;
        }
    }

    // Helper methods
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    categorizeJob(title, description = '') {
        const text = (title + ' ' + description).toLowerCase();
        if (text.includes('marketing') || text.includes('social media')) return 'Marketing';
        if (text.includes('sales') || text.includes('business development')) return 'Sales';
        if (text.includes('customer') || text.includes('support')) return 'Customer Service';
        if (text.includes('admin') || text.includes('office')) return 'Administration';
        if (text.includes('data') || text.includes('analyst')) return 'Data & Analytics';
        if (text.includes('tech') || text.includes('software') || text.includes('it')) return 'Technology';
        if (text.includes('finance') || text.includes('accounting')) return 'Finance';
        if (text.includes('hr') || text.includes('human resources')) return 'Human Resources';
        if (text.includes('design') || text.includes('creative')) return 'Design & Creative';
        if (text.includes('retail') || text.includes('store')) return 'Retail';
        return 'General';
    }

    removeDuplicates(jobs) {
        const seen = new Set();
        return jobs.filter(job => {
            const key = `${job.title}_${job.company}_${job.location}`.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async saveJobs(jobs) {
        try {
            // Sort by posted date (newest first)
            jobs.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));
            
            await fs.writeFile(this.jobsFilePath, JSON.stringify(jobs, null, 2));
            console.log(`💾 Saved ${jobs.length} jobs to ${this.jobsFilePath}`);
            
            // Also create backup file
            const backupPath = this.jobsFilePath.replace('.json', `_backup_${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(jobs, null, 2));
            console.log(`💾 Backup saved to ${backupPath}`);
            
        } catch (error) {
            console.error('❌ Error saving jobs:', error);
        }
    }
}

// Run the mass scraper
async function runMassScraper() {
    const scraper = new MassJobScraper();
    await scraper.scrapeThousandsOfJobs();
}

module.exports = MassJobScraper;

// If called directly, run the scraper
if (require.main === module) {
    runMassScraper().catch(console.error);
}
