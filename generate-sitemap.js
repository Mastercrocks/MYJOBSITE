const fs = require('fs').promises;
const path = require('path');

async function generateComprehensiveSitemap() {
    console.log('🗺️  Generating comprehensive sitemap with all 15,000 jobs...');
    
    try {
        // Read jobs data
        const jobsPath = path.join(__dirname, 'data/jobs.json');
        const jobsData = await fs.readFile(jobsPath, 'utf8');
        const jobs = JSON.parse(jobsData);
        
        console.log(`📊 Found ${jobs.length} jobs to include`);
        
        // Start sitemap XML
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
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

    <url>
        <loc>https://talentsync.shop/contact.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>

    <!-- Blog Posts -->
    <url>
        <loc>https://talentsync.shop/blog/college-student-resume-guide.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/blog/first-job-interview-tips.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>

    <!-- Location Pages -->
    <url>
        <loc>https://talentsync.shop/jobs/new-york-ny.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/jobs/los-angeles-ca.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    
    <url>
        <loc>https://talentsync.shop/jobs/chicago-il.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>

    <!-- Category Pages -->
    <url>
        <loc>https://talentsync.shop/jobs/marketing.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>

`;

        // Add all job detail pages
        console.log('📄 Adding individual job pages...');
        let jobCount = 0;
        
        for (const job of jobs) {
            const lastmod = job.posted_date ? new Date(job.posted_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            sitemap += `    <!-- Job: ${job.title} at ${job.company} -->
    <url>
        <loc>https://talentsync.shop/job-detail.html?id=${job.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
    </url>

`;
            jobCount++;
            
            // Progress indicator
            if (jobCount % 1000 === 0) {
                console.log(`   📊 Added ${jobCount}/${jobs.length} job pages...`);
            }
        }
        
        sitemap += `</urlset>`;
        
        // Save sitemap
        const sitemapPath = path.join(__dirname, 'Public/sitemap.xml');
        await fs.writeFile(sitemapPath, sitemap);
        
        console.log(`✅ SUCCESS! Generated sitemap with ${jobCount + 10} total pages`);
        console.log(`💾 Saved to: ${sitemapPath}`);
        console.log(`📊 Breakdown:`);
        console.log(`   - Main pages: 10`);
        console.log(`   - Job pages: ${jobCount}`);
        console.log(`   - Total URLs: ${jobCount + 10}`);
        
        // Create sitemap index for large sitemaps
        if (jobs.length > 10000) {
            await createSitemapIndex(jobs.length);
        }
        
    } catch (error) {
        console.error('❌ Error generating sitemap:', error);
    }
}

async function createSitemapIndex(jobCount) {
    console.log('📑 Creating sitemap index for better crawling...');
    
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
        <loc>https://talentsync.shop/sitemap.xml</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    </sitemap>
</sitemapindex>`;

    const indexPath = path.join(__dirname, 'Public/sitemap-index.xml');
    await fs.writeFile(indexPath, sitemapIndex);
    console.log(`✅ Sitemap index created: ${indexPath}`);
}

// Run the generator
generateComprehensiveSitemap();
