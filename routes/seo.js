const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// SEO-friendly job detail page
router.get('/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobsData = await fs.readFile(path.join(__dirname, '../data/jobs.json'), 'utf8');
        const jobs = JSON.parse(jobsData);
        const job = jobs.find(j => j.id === jobId);

        if (!job) {
            return res.status(404).send('Job not found');
        }

        // Generate SEO-optimized HTML
        const seoHTML = generateJobSEOPage(job);
        res.send(seoHTML);
    } catch (error) {
        console.error('SEO route error:', error);
        res.status(500).send('Internal server error');
    }
});

// Location-based job pages
router.get('/jobs/location/:city', async (req, res) => {
    try {
        const city = req.params.city.replace('-', ' ');
        const jobsData = await fs.readFile(path.join(__dirname, '../data/jobs.json'), 'utf8');
        const jobs = JSON.parse(jobsData);
        const cityJobs = jobs.filter(job => 
            job.location.toLowerCase().includes(city.toLowerCase())
        );

        const seoHTML = generateLocationSEOPage(city, cityJobs);
        res.send(seoHTML);
    } catch (error) {
        console.error('Location SEO route error:', error);
        res.status(500).send('Internal server error');
    }
});

function generateJobSEOPage(job) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO Meta Tags -->
    <title>${job.title} at ${job.companyName} - TalentSync</title>
    <meta name="description" content="${job.title} position at ${job.companyName} in ${job.location}. ${job.description.substring(0, 150)}...">
    <meta name="keywords" content="${job.title}, ${job.companyName}, ${job.location}, jobs, career, ${job.skills?.join(', ') || ''}">
    <link rel="canonical" href="https://your-domain.com/jobs/${job.id}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${job.title} at ${job.companyName} - TalentSync">
    <meta property="og:description" content="${job.description.substring(0, 200)}">
    <meta property="og:url" content="https://your-domain.com/jobs/${job.id}">
    <meta property="og:type" content="article">
    
    <!-- Schema Markup -->
    <script type="application/ld+json">
    ${JSON.stringify(SchemaGenerator.generateJobPostingSchema(job), null, 2)}
    </script>
    
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <!-- Job content here -->
    <main>
        <article>
            <h1>${job.title}</h1>
            <h2>${job.companyName}</h2>
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Type:</strong> ${job.type}</p>
            <div class="job-description">
                <h3>Job Description</h3>
                <p>${job.description}</p>
            </div>
            <!-- Add apply button and other job details -->
        </article>
    </main>
</body>
</html>`;
}

function generateLocationSEOPage(city, jobs) {
    const cityTitle = city.charAt(0).toUpperCase() + city.slice(1);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title>Jobs in ${cityTitle} - Find Employment Opportunities | TalentSync</title>
    <meta name="description" content="Find ${jobs.length}+ job opportunities in ${cityTitle}. Browse latest job openings from top employers. Apply to jobs in ${cityTitle} today on TalentSync.">
    <meta name="keywords" content="jobs in ${city}, ${city} jobs, ${city} careers, ${city} employment, job search ${city}">
    <link rel="canonical" href="https://your-domain.com/jobs/location/${city.replace(' ', '-').toLowerCase()}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Jobs in ${cityTitle} - TalentSync">
    <meta property="og:description" content="Find ${jobs.length}+ job opportunities in ${cityTitle}. Apply to top jobs today.">
    
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <main>
        <h1>Jobs in ${cityTitle}</h1>
        <p>Found ${jobs.length} job opportunities in ${cityTitle}</p>
        <!-- List jobs here -->
        <div class="jobs-grid">
            ${jobs.map(job => `
                <div class="job-card">
                    <h2><a href="/jobs/${job.id}">${job.title}</a></h2>
                    <p>${job.companyName}</p>
                    <p>${job.location}</p>
                </div>
            `).join('')}
        </div>
    </main>
</body>
</html>`;
}

module.exports = router;