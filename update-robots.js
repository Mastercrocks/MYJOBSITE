const fs = require('fs').promises;
const path = require('path');

async function generateRobotsTxt() {
    console.log('🤖 Updating robots.txt for better crawling...');
    
    const robotsContent = `# TalentSync.shop - Job Board Robots.txt
# Updated: ${new Date().toISOString().split('T')[0]}

User-agent: *
Allow: /

# Main Pages
Allow: /index.html
Allow: /jobs.html
Allow: /employers.html
Allow: /blog.html
Allow: /contact.html
Allow: /job-detail.html

# Job Category Pages
Allow: /jobs/
Allow: /blog/

# Block unnecessary pages
Disallow: /admin/
Disallow: /middleware/
Disallow: /Config/
Disallow: /data/
Disallow: /routes/
Disallow: /scripts/
Disallow: /services/
Disallow: /uploads/
Disallow: /*.json
Disallow: /*.js$
Disallow: /forgot-password.html
Disallow: /reset-password.html
Disallow: /login.html
Disallow: /register.html
Disallow: /dashboard.html

# Important Files
Sitemap: https://talentsync.shop/sitemap.xml
Sitemap: https://talentsync.shop/sitemap-index.xml

# Crawl Delay (be nice to servers)
Crawl-delay: 1`;

    const robotsPath = path.join(__dirname, 'Public/robots.txt');
    await fs.writeFile(robotsPath, robotsContent);
    
    console.log('✅ Updated robots.txt with proper SEO directives');
    console.log(`💾 Saved to: ${robotsPath}`);
}

generateRobotsTxt();
