const express = require('express');
const compression = require('compression');
const path = require('path');
const app = express();
const fs = require('fs');
const jobApiService = require('./services/jobApiService');
// Import route files
function safeRequireRouter(path) {
    const mod = require(path);
    // If the module exports an object with a 'router' property, use that
    if (mod && typeof mod === 'object' && mod.router && typeof mod.router === 'function') {
        return mod.router;
    }
    // If the module itself is a function (router), use it
    if (typeof mod === 'function') {
        return mod;
    }
    // If the module itself is a router (object with 'use' method)
    if (mod && typeof mod.use === 'function') {
        return mod;
    }
    console.error(`❌ ERROR: ${path} does not export a valid Express router.`);
    return (req, res, next) => res.status(500).json({ error: 'Server router error' });
}

const adminRoutes = safeRequireRouter('./routes/admin');
const authRoutes = safeRequireRouter('./routes/auth-mock'); // Using mock auth temporarily
const jobsRoutes = safeRequireRouter('./routes/jobs');
const seoRoutes = safeRequireRouter('./routes/seo');
const PORT = process.env.PORT || 3000;

// Enable compression for better performance
app.use(compression());

// Serve admin static files FIRST (before general static files)
app.use('/admin', express.static(path.join(__dirname, 'Public/admin')));

// Serve static files from Public directory (case-sensitive)
app.use(express.static(path.join(__dirname, 'Public')));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Mount API and admin routes
app.use('/admin/api', adminRoutes);
app.use('/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/seo', seoRoutes);

// Main navigation routes
app.get('/jobs', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobs.html'));
});

app.get('/resumes', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'resumes.html'));
});

app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'blog.html'));
});

// Employer routes
app.get('/employers', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'employers.html'));
});

app.get('/post-job', (req, res) => {
    // Redirect to employers page with auth section focused
    res.redirect('/employers#auth');
});

// Blog routes
app.get('/blog/:article', (req, res) => {
    const article = req.params.article;
    const articlePath = path.join(__dirname, 'Public', 'blog', `${article}.html`);
    
    if (fs.existsSync(articlePath)) {
        res.sendFile(articlePath);
    } else {
        res.status(404).sendFile(path.join(__dirname, 'Public', '404.html'));
    }
});

// Job category routes
app.get('/jobs/marketing', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobs', 'marketing.html'));
});

app.get('/jobs/technology', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobs', 'technology.html'));
});

// Add location-specific routes for SEO (now with 6 cities)
const locations = [
  'new-york-ny', 'los-angeles-ca', 'chicago-il', 'miami-fl', 'houston-tx', 'philadelphia-pa'
];

locations.forEach(location => {
  app.get(`/jobs/${location}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobs', `${location}.html`));
  });
});

// SEO-optimized routes

// REMOVE THIS ENTIRE SECTION - IT'S STILL ACTIVE AND CAUSING PROBLEMS
// The dynamic homepage route below is preventing your static index.html from being served

// Comment out or remove lines 100-170 completely

// Robots.txt for SEO
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /

Sitemap: ${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml`);
});

// XML Sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.SITE_URL || 'http://localhost:3000';
    
    // Major cities for location-based SEO
    const majorCities = [
        'new-york-ny', 'los-angeles-ca', 'chicago-il', 'houston-tx',
        'phoenix-az', 'philadelphia-pa', 'san-antonio-tx', 'san-diego-ca',
        'dallas-tx', 'san-jose-ca', 'austin-tx', 'jacksonville-fl',
        'fort-worth-tx', 'columbus-oh', 'san-francisco-ca', 'charlotte-nc',
        'indianapolis-in', 'seattle-wa', 'denver-co', 'washington-dc',
        'boston-ma', 'el-paso-tx', 'nashville-tn', 'detroit-mi',
        'oklahoma-city-ok', 'portland-or', 'las-vegas-nv', 'memphis-tn',
        'louisville-ky', 'baltimore-md', 'milwaukee-wi', 'albuquerque-nm',
        'tucson-az', 'fresno-ca', 'mesa-az', 'sacramento-ca', 'atlanta-ga',
        'kansas-city-mo', 'colorado-springs-co', 'omaha-ne', 'raleigh-nc',
        'miami-fl', 'cleveland-oh', 'tulsa-ok', 'virginia-beach-va',
        'minneapolis-mn', 'honolulu-hi', 'arlington-tx', 'wichita-ks',
        'st-louis-mo', 'new-orleans-la', 'cincinnati-oh', 'tampa-fl'
    ];
    
    // Job categories for category-based SEO
    const categories = [
        'technology', 'healthcare', 'finance', 'education', 'marketing',
        'sales', 'customer-service', 'administrative', 'retail', 'hospitality',
        'manufacturing', 'construction', 'transportation', 'government',
        'nonprofit', 'legal', 'consulting', 'real-estate', 'media',
        'telecommunications', 'automotive', 'aerospace', 'biotechnology'
    ];
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;
    
    // Add location pages
    majorCities.forEach(city => {
        sitemap += `
    <url>
        <loc>${baseUrl}/jobs/${city}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>`;
    });
    
    // Add category pages
    categories.forEach(category => {
        sitemap += `
    <url>
        <loc>${baseUrl}/jobs/${category}</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>`;
    });
    
    sitemap += `
</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
});

// Location-based job pages (SEO-optimized)
app.get('/jobs/:location', async (req, res) => {
    const location = req.params.location;
    const cityName = location.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    // Local jobs
    const jobsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'jobs.json'), 'utf8'));
    const filteredLocalJobs = jobsData.filter(job =>
        job.location && job.location.toLowerCase().includes(cityName.toLowerCase())
    );

    // Adzuna jobs
    let adzunaJobs = [];
    try {
        adzunaJobs = await (new jobApiService()).searchAdzunaJobs({
            what: '',
            where: cityName,
            results_per_page: 10,
            page: 1,
            country: 'us'
        });
    } catch (e) {
        adzunaJobs = [];
    }
    // Normalize Adzuna jobs for display
    const normalizedAdzunaJobs = adzunaJobs.map(job => ({
        id: job.id || job.redirect_url,
        title: job.title,
        company: job.company && job.company.display_name ? job.company.display_name : '',
        location: job.location && job.location.display_name ? job.location.display_name : cityName,
        description: job.description,
        salary: job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : '',
        source: 'adzuna',
        url: job.redirect_url
    }));

    // Indeed jobs from Apify dataset
    let indeedJobs = [];
    try {
        const indeedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'indeed_jobs.json'), 'utf8'));
        // Normalize cityName for matching (e.g., 'New York')
        const cityNameNorm = cityName.toLowerCase().replace(/[^a-z0-9]/g, '');
        indeedJobs = indeedData
            .filter(job => {
                if (!job.location) return false;
                // Normalize job location (e.g., 'New York, NY' -> 'newyorkny')
                const jobLocNorm = job.location.toLowerCase().replace(/[^a-z0-9]/g, '');
                return jobLocNorm.includes(cityNameNorm) || cityNameNorm.includes(jobLocNorm);
            })
            .map((job, idx) => ({
                id: `indeed_${idx}`,
                title: job.positionName || job.title,
                company: job.company,
                location: job.location,
                description: job.description || '',
                salary: job.salary,
                source: 'indeed',
                url: job.url || ''
            }));
    } catch (e) {
        indeedJobs = [];
    }

    // Combine jobs
    const allJobs = [...filteredLocalJobs, ...normalizedAdzunaJobs, ...indeedJobs];
    // Structured data for jobs
    const jobsStructuredData = allJobs.map(job => ({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": job.title,
        "description": job.description,
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": job.company
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": job.location
            }
        },
        "baseSalary": job.salary ? {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": {
                "@type": "QuantitativeValue",
                "value": job.salary,
                "unitText": "YEAR"
            }
        } : undefined
    }));
    const locationPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jobs in ${cityName} | TalentSync - Find Your Next Career</title>
    <meta name="description" content="Find jobs in ${cityName}. Browse thousands of job openings from top employers. Apply now and advance your career with TalentSync.">
    <link rel="canonical" href="${process.env.SITE_URL || 'http://localhost:3000'}/jobs/${location}">
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Jobs in ${cityName} | TalentSync">
    <meta property="og:description" content="Find jobs in ${cityName}. Browse thousands of job openings from top employers.">
    <meta property="og:url" content="${process.env.SITE_URL || 'http://localhost:3000'}/jobs/${location}">
    <meta property="og:type" content="website">
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Jobs in ${cityName} | TalentSync">
    <meta name="twitter:description" content="Find jobs in ${cityName}. Browse thousands of job openings from top employers.">
    <!-- Structured Data for all jobs -->
    <script type="application/ld+json">${JSON.stringify(jobsStructuredData)}</script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .job-count { font-size: 1.2em; margin: 20px 0; color: #666; }
        .job-card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .breadcrumb { margin-bottom: 20px; }
        .breadcrumb a { color: #2563eb; text-decoration: none; }
        .breadcrumb a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <nav class="breadcrumb">
            <a href="/">Home</a> > <a href="/jobs">Jobs</a> > ${cityName}
        </nav>
        <div class="header">
            <h1>Jobs in ${cityName}</h1>
            <p>Discover your next career opportunity in ${cityName}</p>
        </div>
        <div class="job-count">
            <strong>${allJobs.length} jobs available in ${cityName}</strong>
        </div>
        <div class="job-listings">
            ${allJobs.length === 0 ? `<p>No jobs found for this location.</p>` : allJobs.map(job => `
                <div class="job-card">
                    <h3>${job.title} - ${job.location}</h3>
                    <p><strong>${job.company}</strong> | ${job.salary ? job.salary : ''}</p>
                    <p>${job.description}</p>
                    ${job.source === 'adzuna' && job.url ? `<a href="${job.url}" target="_blank">View on Adzuna</a>` : `<a href="/job/${job.id}">View Details</a>`}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
    res.send(locationPageHTML);
});

// Category-based job pages
app.get('/jobs/category/:category', (req, res) => {
    const category = req.params.category;
    const categoryName = category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    res.send(`<h1>${categoryName} Jobs</h1><p>Browse ${categoryName.toLowerCase()} opportunities nationwide.</p>`);
});

// Individual job posting page
app.get('/job/:id', (req, res) => {
    const jobId = req.params.id;
    
    const jobPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Software Engineer Job | TechCorp Inc. | TalentSync</title>
    <meta name="description" content="Software Engineer position at TechCorp Inc. Full-time opportunity with competitive salary and benefits. Apply now!">
    
    <!-- Structured Data for Job Posting -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Software Engineer",
        "description": "We are seeking a talented Software Engineer to join our dynamic team...",
        "datePosted": "2024-08-08",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": "TechCorp Inc.",
            "sameAs": "https://techcorp.com"
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "New York",
                "addressRegion": "NY",
                "addressCountry": "US"
            }
        },
        "baseSalary": {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": {
                "@type": "QuantitativeValue",
                "minValue": 75000,
                "maxValue": 95000,
                "unitText": "YEAR"
            }
        }
    }
    </script>
</head>
<body>
    <h1>Software Engineer - Job #${jobId}</h1>
    <p>TechCorp Inc. | Full-time | New York, NY</p>
    <p>Salary: $75,000 - $95,000</p>
    <h2>Job Description</h2>
    <p>We are seeking a talented Software Engineer to join our dynamic team...</p>
</body>
</html>`;
    
    res.send(jobPageHTML);
});

// API Routes
app.get('/api/jobs', (req, res) => {
    // Sample job data
    const jobs = [
        { id: 1, title: 'Software Engineer', company: 'TechCorp', location: 'New York, NY', salary: '$75,000 - $95,000' },
        { id: 2, title: 'Marketing Manager', company: 'MarketPro', location: 'Los Angeles, CA', salary: '$60,000 - $80,000' },
        { id: 3, title: 'Sales Representative', company: 'SalesForce Solutions', location: 'Chicago, IL', salary: '$50,000 + Commission' }
    ];
    res.json(jobs);
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'dashboard.html'));
});


// Catch-all for SPA routing (fallback to index.html for non-file routes)
// BUT EXCLUDE API routes and static files
app.get('*', (req, res) => {
    // Don't catch API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Don't catch files with extensions (CSS, JS, images, etc.) - let static middleware handle them
    if (path.extname(req.path)) {
        return res.status(404).send('File not found');
    }
    
    // Only serve index.html for actual page routes (not admin routes)
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 TalentSync server running on http://localhost:${PORT}`);
    console.log(`📊 SEO features active:`);
    console.log(`   - Sitemap: http://localhost:${PORT}/sitemap.xml`);
    console.log(`   - Robots: http://localhost:${PORT}/robots.txt`);
    console.log(`   - Location pages: http://localhost:${PORT}/jobs/new-york-ny`);
    console.log(`🔧 Admin routing fix deployed - ${new Date().toISOString()}`);
});

module.exports = app;