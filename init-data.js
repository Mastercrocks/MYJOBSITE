// Initialize data directory and sample jobs for Railway deployment
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
}

// Initialize scraped_jobs.json if it doesn't exist
const scrapedJobsPath = path.join(dataDir, 'scraped_jobs.json');
if (!fs.existsSync(scrapedJobsPath)) {
    const sampleJobs = [
        {
            "id": "sample-1",
            "title": "Entry Level Marketing Associate",
            "company": "TechStart Inc",
            "location": "Remote",
            "description": "Join our growing marketing team as an entry-level associate. Perfect for recent graduates!",
            "source": "LinkedIn",
            "url": "#",
            "datePosted": new Date().toISOString(),
            "salary": "$45,000 - $55,000",
            "type": "Full-time"
        },
        {
            "id": "sample-2", 
            "title": "Junior Software Developer",
            "company": "Innovation Labs",
            "location": "San Francisco, CA",
            "description": "Looking for a passionate junior developer to join our engineering team.",
            "source": "Indeed",
            "url": "#",
            "datePosted": new Date().toISOString(),
            "salary": "$70,000 - $80,000",
            "type": "Full-time"
        },
        {
            "id": "sample-3",
            "title": "Customer Success Intern",
            "company": "GrowthCorp",
            "location": "New York, NY",
            "description": "Great internship opportunity for college students interested in customer success.",
            "source": "ZipRecruiter",
            "url": "#",
            "datePosted": new Date().toISOString(),
            "salary": "$15 - $20/hour",
            "type": "Internship"
        }
    ];
    
    fs.writeFileSync(scrapedJobsPath, JSON.stringify(sampleJobs, null, 2));
    console.log('✅ Created sample scraped_jobs.json with', sampleJobs.length, 'jobs');
}

// Initialize users.json if it doesn't exist
const usersPath = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify([], null, 2));
    console.log('✅ Created empty users.json');
}

// Initialize employers.json if it doesn't exist
const employersPath = path.join(dataDir, 'employers.json');
if (!fs.existsSync(employersPath)) {
    fs.writeFileSync(employersPath, JSON.stringify([], null, 2));
    console.log('✅ Created empty employers.json');
}

console.log('🎉 Data initialization complete!');
