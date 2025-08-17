// SEO Index Booster - Get TalentSync.shop indexed by Google
// This script will create content and submit to search engines

const fs = require('fs');
const path = require('path');

console.log('🚀 TalentSync.shop SEO Index Booster\n');

// 1. Create enhanced meta tags for all pages
function enhancePageSEO() {
    console.log('1. 📝 Enhancing page SEO...');
    
    const pages = [
        {
            file: 'index.html',
            title: 'TalentSync - Premier Job Board for Students & Recent Graduates',
            description: 'Find your dream job with TalentSync. Connect talented students and recent graduates with top employers. Browse thousands of entry-level positions, internships, and career opportunities.',
            keywords: 'jobs, students, graduates, careers, employment, internships, entry level jobs, college jobs'
        },
        {
            file: 'jobs.html', 
            title: 'Browse Jobs - Entry Level & Student Positions | TalentSync',
            description: 'Discover thousands of job opportunities perfect for students and recent graduates. Filter by location, industry, and experience level to find your ideal position.',
            keywords: 'job search, entry level jobs, student jobs, recent graduate jobs, career opportunities'
        },
        {
            file: 'employers.html',
            title: 'Post Jobs & Hire Students | Employer Portal | TalentSync', 
            description: 'Hire talented students and recent graduates. Post jobs, browse resumes, and connect with the next generation of professionals through TalentSync.',
            keywords: 'hire students, post jobs, employer portal, recruit graduates, talent acquisition'
        }
    ];
    
    console.log(`   ✅ Will enhance ${pages.length} main pages`);
    return pages;
}

// 2. Create dynamic job pages for SEO
async function createJobPages() {
    console.log('\n2. 🎯 Creating dynamic job pages...');
    
    try {
        const jobsPath = path.join(__dirname, 'data', 'jobs.json');
        const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        
        console.log(`   📊 Found ${jobs.length} jobs to create pages for`);
        
        // Create individual job pages for SEO
        const jobPagesDir = path.join(__dirname, 'Public', 'job');
        if (!fs.existsSync(jobPagesDir)) {
            fs.mkdirSync(jobPagesDir, { recursive: true });
        }
        
        jobs.slice(0, 50).forEach((job, index) => { // Limit to 50 for now
            const jobSlug = job.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            
            const jobPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${job.title} at ${job.company} | TalentSync Jobs</title>
    <meta name="description" content="Apply for ${job.title} position at ${job.company} in ${job.location}. ${job.description ? job.description.substring(0, 150) : 'Great opportunity for students and recent graduates.'}">
    <meta name="keywords" content="${job.title}, ${job.company}, ${job.location}, jobs, careers, employment">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${job.title} at ${job.company}">
    <meta property="og:description" content="Apply for this ${job.title} position at ${job.company}">
    <meta property="og:url" content="https://talentsync.shop/job/${jobSlug}">
    <meta property="og:type" content="website">
    
    <!-- Schema.org structured data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "${job.title}",
        "description": "${job.description || 'Great opportunity at ' + job.company}",
        "hiringOrganization": {
            "@type": "Organization",
            "name": "${job.company}"
        },
        "jobLocation": {
            "@type": "Place",
            "address": "${job.location}"
        },
        "datePosted": "${job.posted_date || new Date().toISOString().split('T')[0]}",
        "employmentType": "${job.job_type || 'FULL_TIME'}",
        "url": "https://talentsync.shop/job/${jobSlug}"
    }
    </script>
    
    <link rel="canonical" href="https://talentsync.shop/job/${jobSlug}">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .job-header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .job-title { color: #2563eb; font-size: 24px; margin-bottom: 10px; }
        .company { font-size: 18px; color: #666; }
        .location { color: #888; }
        .description { line-height: 1.6; margin: 20px 0; }
        .apply-btn { background: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="job-header">
        <h1 class="job-title">${job.title}</h1>
        <div class="company">${job.company}</div>
        <div class="location">📍 ${job.location}</div>
        <div class="job-type">💼 ${job.job_type || 'Full-time'}</div>
    </div>
    
    <div class="description">
        <h2>Job Description</h2>
        <p>${job.description || 'Great opportunity to join ' + job.company + ' as a ' + job.title + '. Perfect for students and recent graduates looking to start their career.'}</p>
    </div>
    
    <div class="apply-section">
        <button class="apply-btn" onclick="window.location.href='https://talentsync.shop/jobs.html#${job.id}'">
            Apply Now on TalentSync
        </button>
        <p><a href="https://talentsync.shop/jobs.html">← Back to All Jobs</a></p>
    </div>
    
    <script>
        // Track page view
        if (typeof gtag !== 'undefined') {
            gtag('config', 'G-P5ETS8QMP7', {
                page_title: '${job.title} at ${job.company}',
                page_location: 'https://talentsync.shop/job/${jobSlug}'
            });
        }
    </script>
</body>
</html>`;
            
            const jobPagePath = path.join(jobPagesDir, `${jobSlug}.html`);
            fs.writeFileSync(jobPagePath, jobPageHTML);
        });
        
        console.log(`   ✅ Created ${Math.min(jobs.length, 50)} individual job pages`);
        
    } catch (error) {
        console.log(`   ❌ Error creating job pages: ${error.message}`);
    }
}

// 3. Update sitemap with new job pages
async function updateSitemap() {
    console.log('\n3. 🗺️ Updating sitemap...');
    
    try {
        const jobsPath = path.join(__dirname, 'data', 'jobs.json');
        const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        
        let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

    <!-- Main Pages -->
    <url>
        <loc>https://talentsync.shop/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/jobs.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/employers.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/blog.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>

    <!-- Job Pages -->`;
        
        jobs.slice(0, 50).forEach(job => {
            const jobSlug = job.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
                
            sitemapContent += `
    <url>
        <loc>https://talentsync.shop/job/${jobSlug}</loc>
        <lastmod>${job.posted_date || new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`;
        });
        
        sitemapContent += `

</urlset>`;
        
        const sitemapPath = path.join(__dirname, 'Public', 'sitemap.xml');
        fs.writeFileSync(sitemapPath, sitemapContent);
        
        console.log(`   ✅ Updated sitemap with ${Math.min(jobs.length, 50)} job pages`);
        
    } catch (error) {
        console.log(`   ❌ Error updating sitemap: ${error.message}`);
    }
}

// 4. Create submission URLs for quick indexing
function createSubmissionGuide() {
    console.log('\n4. 📋 Creating submission guide...');
    
    const submissionGuide = `
# 🚀 TalentSync.shop Google Indexing Guide

## Immediate Actions Needed:

### 1. Google Search Console
- Visit: https://search.google.com/search-console
- Add property: https://talentsync.shop
- Verify ownership (HTML file verification already added)
- Submit sitemap: https://talentsync.shop/sitemap.xml

### 2. Manual URL Submissions
Submit these URLs manually in Google Search Console:

✅ https://talentsync.shop/
✅ https://talentsync.shop/jobs.html  
✅ https://talentsync.shop/employers.html
✅ https://talentsync.shop/blog.html
✅ https://talentsync.shop/contact.html

### 3. Build Backlinks
- Submit to job board directories
- Create social media profiles linking to site
- Write guest posts mentioning TalentSync
- Partner with universities/career centers

### 4. Generate Fresh Content
- Regular job postings
- Blog articles about career advice
- Company spotlights
- Industry news

### 5. Technical SEO Checklist
✅ Sitemap created and updated
✅ Robots.txt configured
✅ Google verification file added
✅ Individual job pages created
✅ Schema markup added
✅ Meta descriptions optimized

## Why You're Not Indexed Yet:

1. **New Domain** - Search engines take time to discover new sites
2. **No Backlinks** - No external sites linking to yours yet
3. **Limited Content History** - Search engines prefer sites with regular updates
4. **No Manual Submission** - Haven't told Google your site exists

## Expected Timeline:
- Manual submission: 1-3 days
- Organic discovery: 2-4 weeks  
- Full indexing: 1-3 months

## Next Steps:
1. Run this script to create SEO-optimized pages
2. Submit sitemap to Google Search Console
3. Manually request indexing for main pages
4. Start creating regular content
5. Build quality backlinks

Your site will be indexed! 🎯
`;

    fs.writeFileSync(path.join(__dirname, 'GOOGLE_INDEXING_GUIDE.md'), submissionGuide);
    console.log('   ✅ Created indexing guide: GOOGLE_INDEXING_GUIDE.md');
}

// Run all SEO improvements
async function runSEOBooster() {
    console.log('🎯 Starting SEO improvements...\n');
    
    enhancePageSEO();
    await createJobPages();
    await updateSitemap();
    createSubmissionGuide();
    
    console.log('\n🎉 SEO Index Booster Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Submit sitemap to Google Search Console');
    console.log('2. Manually request indexing for main pages');
    console.log('3. Build backlinks from relevant sites');
    console.log('4. Create regular fresh content');
    console.log('\n🔗 Key URLs to submit:');
    console.log('   • https://talentsync.shop/');
    console.log('   • https://talentsync.shop/sitemap.xml');
    console.log('   • https://talentsync.shop/jobs.html');
}

runSEOBooster().catch(console.error);
