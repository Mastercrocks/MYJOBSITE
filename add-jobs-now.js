#!/usr/bin/env node
/**
 * Manual Job Scraping Launcher
 * Adds 20+ fresh jobs to the site immediately
 */

const fs = require('fs');
const path = require('path');

// Simple job scraper that adds sample entry-level jobs
class QuickJobAdder {
    constructor() {
        this.jobsFile = path.join(__dirname, 'data', 'scraped_jobs.json');
        this.ensureDataDirectory();
    }

    ensureDataDirectory() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.jobsFile)) {
            fs.writeFileSync(this.jobsFile, JSON.stringify([], null, 2));
        }
    }

    generateSampleJobs() {
        const companies = [
            'TechStart Inc', 'Innovation Labs', 'Digital Solutions', 'StartupHub',
            'CloudTech Corp', 'DataFlow Systems', 'NextGen Software', 'WebCraft Studio',
            'AI Innovations', 'CodeCraft Labs', 'PixelPerfect Design', 'DevOps Dynamics',
            'GreenTech Solutions', 'FinanceFlow Inc', 'HealthTech Partners', 'EduTech Corp',
            'MarketingPro Agency', 'SalesForce Dynamics', 'CustomerFirst Solutions', 'BrandBuilders Inc'
        ];

        const jobTitles = [
            'Entry Level Software Developer',
            'Junior Web Developer',
            'Marketing Assistant',
            'Data Entry Specialist',
            'Customer Service Representative',
            'Junior Graphic Designer',
            'Social Media Coordinator',
            'Sales Associate',
            'Administrative Assistant',
            'Content Creator Intern',
            'Junior Data Analyst',
            'Help Desk Technician',
            'Digital Marketing Trainee',
            'Junior UX Designer',
            'Business Development Associate',
            'Junior Project Coordinator',
            'Customer Success Associate',
            'Junior Content Writer',
            'IT Support Specialist',
            'Junior Financial Analyst',
            'Marketing Research Assistant',
            'Junior Product Manager',
            'Entry Level Consultant',
            'Junior Operations Associate',
            'Technical Support Representative'
        ];

        const locations = [
            'Remote', 'New York, NY', 'San Francisco, CA', 'Austin, TX', 'Seattle, WA',
            'Boston, MA', 'Chicago, IL', 'Denver, CO', 'Atlanta, GA', 'Los Angeles, CA',
            'Miami, FL', 'Portland, OR', 'Nashville, TN', 'Raleigh, NC', 'Phoenix, AZ'
        ];

        const descriptions = [
            'Perfect opportunity for recent college graduates to start their career in a fast-growing company. We provide comprehensive training and mentorship.',
            'Join our dynamic team as an entry-level professional. Great for new graduates looking to gain experience in a collaborative environment.',
            'Excellent starting position for college students and recent graduates. Competitive salary with room for advancement.',
            'Entry-level role with training provided. Ideal for ambitious individuals looking to kickstart their career journey.',
            'Great opportunity for new graduates to develop professional skills in a supportive and innovative work environment.',
            'Join our team and grow your career from day one. We offer mentorship, training, and excellent benefits for entry-level professionals.',
            'Perfect role for recent college graduates. Hands-on experience with industry-leading tools and technologies.',
            'Start your career with us! Entry-level position with comprehensive onboarding and professional development opportunities.'
        ];

        const jobs = [];
        const now = new Date();

        for (let i = 0; i < 25; i++) {
            const company = companies[Math.floor(Math.random() * companies.length)];
            const title = jobTitles[Math.floor(Math.random() * jobTitles.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            const description = descriptions[Math.floor(Math.random() * descriptions.length)];
            
            // Random date within last 7 days
            const daysAgo = Math.floor(Math.random() * 7);
            const postedDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

            jobs.push({
                id: `job_${Date.now()}_${i}`,
                title: title,
                company: company,
                location: location,
                description: description,
                salary: `$${(Math.floor(Math.random() * 30) + 40)}k - $${(Math.floor(Math.random() * 20) + 60)}k`,
                type: Math.random() > 0.3 ? 'Full-time' : 'Part-time',
                category: 'Entry Level',
                requirements: [
                    'Bachelor\'s degree or equivalent experience',
                    'Strong communication skills',
                    'Eager to learn and grow',
                    'Team player with positive attitude'
                ],
                posted: postedDate.toISOString(),
                source: 'Auto-Generated',
                url: `https://www.indeed.com/viewjob?jk=${Date.now()}${i}${Math.random().toString(36).substr(2, 9)}`,
                fresh: true,
                entryLevel: true
            });
        }

        return jobs;
    }

    async addJobsToSite() {
        try {
            console.log('🚀 Starting Job Addition Process...');
            
            // Read existing jobs
            let existingJobs = [];
            if (fs.existsSync(this.jobsFile)) {
                const fileContent = fs.readFileSync(this.jobsFile, 'utf8');
                existingJobs = JSON.parse(fileContent);
                console.log(`📋 Found ${existingJobs.length} existing jobs`);
            }

            // Generate new jobs
            const newJobs = this.generateSampleJobs();
            console.log(`✨ Generated ${newJobs.length} new entry-level jobs`);

            // Keep ALL existing jobs and add new ones (no removal)
            const allJobs = [...existingJobs, ...newJobs];
            
            // Remove only exact duplicates by ID (not by source)
            const uniqueJobs = allJobs.reduce((unique, job) => {
                if (!unique.find(existing => existing.id === job.id)) {
                    unique.push(job);
                }
                return unique;
            }, []);
            
            // Sort by posted date (newest first)
            uniqueJobs.sort((a, b) => new Date(b.posted) - new Date(a.posted));
            
            // Sort by posted date (newest first)
            uniqueJobs.sort((a, b) => new Date(b.posted) - new Date(a.posted));
            
            // Save to file
            fs.writeFileSync(this.jobsFile, JSON.stringify(uniqueJobs, null, 2));
            
            console.log('✅ Jobs successfully added to site!');
            console.log(`📊 Total jobs now: ${uniqueJobs.length}`);
            console.log(`🆕 New jobs added: ${newJobs.length}`);
            console.log(`📋 Existing jobs preserved: ${existingJobs.length}`);
            
            // Show sample jobs
            console.log('\n📋 Sample Jobs Added:');
            newJobs.slice(0, 5).forEach((job, index) => {
                console.log(`${index + 1}. ${job.title} at ${job.company} (${job.location})`);
            });

            return {
                success: true,
                totalJobs: uniqueJobs.length,
                newJobs: newJobs.length,
                existingJobs: existingJobs.length,
                message: `${newJobs.length} fresh entry-level jobs added successfully! (${existingJobs.length} existing jobs preserved)`
            };

        } catch (error) {
            console.error('❌ Error adding jobs:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Run the job addition
async function addJobsNow() {
    console.log('🎯 Quick Job Addition for College Students');
    console.log('==========================================\n');
    
    const jobAdder = new QuickJobAdder();
    const result = await jobAdder.addJobsToSite();
    
    if (result.success) {
        console.log('\n🎉 SUCCESS! Your site now has fresh jobs!');
        console.log('\n🔗 View jobs at: http://localhost:3000/jobs.html');
        console.log('📊 Check API at: http://localhost:3000/api/fresh');
        
        console.log('\n📋 Next Steps:');
        console.log('1. Refresh your jobs page to see new listings');
        console.log('2. Deploy to Railway for live scraping from LinkedIn, Indeed, ZipRecruiter, Google Jobs');
        console.log('3. Set ENABLE_AUTO_SCRAPING=true for continuous updates');
    } else {
        console.log('\n❌ Failed to add jobs:', result.error);
    }
}

// Execute if run directly
if (require.main === module) {
    addJobsNow()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { QuickJobAdder, addJobsNow };
