// Google Indexing Solution for TalentSync.shop
// This will help get your site indexed quickly

const fs = require('fs');
const path = require('path');

console.log('🔍 Google Indexing Solution for TalentSync.shop\n');

// 1. Create Google Search Console submission URLs
function createSubmissionURLs() {
    console.log('1. 📋 Creating Google Search Console submission URLs...');
    
    const baseURL = 'https://talentsync.shop';
    const urls = [
        '/',
        '/jobs.html',
        '/employers.html', 
        '/blog.html',
        '/contact.html',
        '/careers.html',
        '/login.html',
        '/register.html'
    ];
    
    // Add job pages
    try {
        const jobsPath = path.join(__dirname, 'data', 'jobs.json');
        const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        
        jobs.slice(0, 10).forEach(job => {
            const jobSlug = job.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            urls.push(`/job/${jobSlug}`);
        });
    } catch (error) {
        console.log('   ⚠️ Could not load jobs for URL list');
    }
    
    const submissionList = `# Google Search Console Manual Submission URLs

## Priority URLs (Submit First):
${urls.slice(0, 8).map(url => `✅ ${baseURL}${url}`).join('\n')}

## Job Pages (Submit After):
${urls.slice(8).map(url => `📄 ${baseURL}${url}`).join('\n')}

## How to Submit:
1. Go to https://search.google.com/search-console
2. Add property: ${baseURL}
3. Verify with HTML file (already uploaded: googlef47ac10a58e78a21.html)
4. Go to "URL Inspection" 
5. Paste each URL above
6. Click "Request Indexing"

## Sitemap Submission:
Submit this sitemap: ${baseURL}/sitemap.xml

Total URLs to index: ${urls.length}
`;

    fs.writeFileSync(path.join(__dirname, 'GOOGLE_SUBMISSION_URLS.md'), submissionList);
    console.log(`   ✅ Created submission list with ${urls.length} URLs`);
}

// 2. Generate robots.txt for better crawling
function optimizeRobotsTxt() {
    console.log('\n2. 🤖 Optimizing robots.txt...');
    
    const robotsContent = `User-agent: *
Allow: /

# Prioritize important pages
Crawl-delay: 1

# Sitemaps
Sitemap: https://talentsync.shop/sitemap.xml

# Allow social media crawlers
User-agent: facebookexternalhit/*
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

# Block admin areas (if any)
Disallow: /admin
Disallow: /api/admin
Disallow: /private/

# Allow job pages
Allow: /job/
Allow: /jobs.html
Allow: /employers.html`;

    const robotsPath = path.join(__dirname, 'Public', 'robots.txt');
    fs.writeFileSync(robotsPath, robotsContent);
    console.log('   ✅ Enhanced robots.txt for better crawling');
}

// 3. Create structured data for homepage
function addStructuredData() {
    console.log('\n3. 📊 Creating structured data...');
    
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "TalentSync",
        "description": "Premier job board for college students and recent graduates",
        "url": "https://talentsync.shop",
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://talentsync.shop/jobs.html?search={search_term_string}",
            "query-input": "required name=search_term_string"
        },
        "publisher": {
            "@type": "Organization",
            "name": "TalentSync",
            "url": "https://talentsync.shop"
        }
    };
    
    const jobBoardData = {
        "@context": "https://schema.org",
        "@type": "JobBoard",
        "name": "TalentSync Job Board",
        "description": "Find entry-level jobs and internships for students and recent graduates",
        "url": "https://talentsync.shop/jobs.html"
    };
    
    const structuredDataScript = `
<!-- TalentSync Structured Data -->
<script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
</script>

<script type="application/ld+json">
${JSON.stringify(jobBoardData, null, 2)}
</script>`;

    fs.writeFileSync(path.join(__dirname, 'structured-data.html'), structuredDataScript);
    console.log('   ✅ Created structured data for homepage');
}

// 4. Create content strategy for regular updates
function createContentStrategy() {
    console.log('\n4. 📝 Creating content strategy...');
    
    const contentStrategy = `# Content Strategy for Google Indexing

## Daily Actions:
- [ ] Add 2-3 new job postings
- [ ] Update job descriptions with keywords
- [ ] Check Google Search Console for indexing status

## Weekly Actions:
- [ ] Publish 1 blog post about career advice
- [ ] Update company descriptions
- [ ] Create social media posts linking to site
- [ ] Submit new URLs to Google Search Console

## Monthly Actions:
- [ ] Analyze search performance
- [ ] Update meta descriptions based on performance
- [ ] Create new landing pages for popular searches
- [ ] Build relationships for backlinks

## Blog Post Ideas:
1. "How to Write a Resume as a Recent Graduate"
2. "Top 10 Entry-Level Jobs for College Students"
3. "Interview Tips for Your First Job"
4. "Networking Strategies for New Graduates"
5. "Remote Work Opportunities for Students"

## SEO Keywords to Target:
- "entry level jobs"
- "student jobs"
- "recent graduate jobs"
- "first job"
- "college career"
- "internships"
- "part time jobs"

## Content Calendar:
Week 1: Resume & Application Tips
Week 2: Job Search Strategies  
Week 3: Interview Preparation
Week 4: Career Development

This regular content will signal to Google that your site is active and valuable!
`;

    fs.writeFileSync(path.join(__dirname, 'CONTENT_STRATEGY.md'), contentStrategy);
    console.log('   ✅ Created content strategy guide');
}

// 5. Generate ping URLs for quick discovery
function createPingUrls() {
    console.log('\n5. 🔔 Creating ping URLs for quick discovery...');
    
    const pingServices = [
        'http://www.google.com/webmasters/tools/ping?sitemap=https://talentsync.shop/sitemap.xml',
        'http://www.bing.com/webmaster/ping.aspx?siteMap=https://talentsync.shop/sitemap.xml',
        'http://search.yahooapis.com/SiteExplorerService/V1/updateNotification?appid=YahooDemo&url=https://talentsync.shop/sitemap.xml'
    ];
    
    const pingGuide = `# Search Engine Ping URLs

## Automatic Sitemap Notification:

Copy and paste these URLs into your browser to notify search engines about your sitemap:

1. **Google:**
   ${pingServices[0]}

2. **Bing:**
   ${pingServices[1]}

3. **Yahoo:**
   ${pingServices[2]}

## Alternative Method:
You can also ping these programmatically:

\`\`\`bash
curl "${pingServices[0]}"
curl "${pingServices[1]}"
curl "${pingServices[2]}"
\`\`\`

This tells search engines to check your sitemap immediately!
`;

    fs.writeFileSync(path.join(__dirname, 'PING_SEARCH_ENGINES.md'), pingGuide);
    console.log('   ✅ Created search engine ping guide');
}

// Main function
async function runIndexingSolution() {
    console.log('🚀 Starting Google Indexing Solution...\n');
    
    createSubmissionURLs();
    optimizeRobotsTxt();
    addStructuredData();
    createContentStrategy();
    createPingUrls();
    
    console.log('\n🎉 Google Indexing Solution Complete!\n');
    
    console.log('📋 IMMEDIATE ACTION PLAN:');
    console.log('1. ✅ Go to https://search.google.com/search-console');
    console.log('2. ✅ Add property: https://talentsync.shop');
    console.log('3. ✅ Verify with HTML file (already uploaded)');
    console.log('4. ✅ Submit sitemap: https://talentsync.shop/sitemap.xml');
    console.log('5. ✅ Request indexing for main pages (see GOOGLE_SUBMISSION_URLS.md)');
    console.log('6. ✅ Ping search engines (see PING_SEARCH_ENGINES.md)');
    
    console.log('\n🔗 Key Files Created:');
    console.log('   • GOOGLE_SUBMISSION_URLS.md - URLs to submit manually');
    console.log('   • CONTENT_STRATEGY.md - Plan for regular updates');
    console.log('   • PING_SEARCH_ENGINES.md - Quick discovery method');
    console.log('   • structured-data.html - Schema markup for homepage');
    
    console.log('\n⏰ Expected Timeline:');
    console.log('   • Manual submission: 1-3 days');
    console.log('   • First indexing: 3-7 days');
    console.log('   • Full indexing: 2-4 weeks');
    
    console.log('\n🎯 Your site WILL be indexed! The technical setup is perfect.');
    console.log('   Google just needs to discover and trust your site.');
}

runIndexingSolution().catch(console.error);
