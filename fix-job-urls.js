const fs = require('fs').promises;
const path = require('path');

async function updateJobURLs() {
    console.log('🔧 Fixing job URLs to point to internal job detail pages...');
    
    const jobsPath = path.join(__dirname, 'data/jobs.json');
    
    try {
        // Read current jobs
        const jobsData = await fs.readFile(jobsPath, 'utf8');
        const jobs = JSON.parse(jobsData);
        
        console.log(`📊 Processing ${jobs.length} jobs...`);
        
        // Update each job's URL to point to internal detail page
        jobs.forEach(job => {
            job.url = `https://talentsync.shop/job-detail.html?id=${job.id}`;
        });
        
        // Save updated jobs
        await fs.writeFile(jobsPath, JSON.stringify(jobs, null, 2));
        
        // Create backup
        const backupPath = jobsPath.replace('.json', `_backup_fixed_urls_${Date.now()}.json`);
        await fs.writeFile(backupPath, JSON.stringify(jobs, null, 2));
        
        console.log(`✅ SUCCESS! Updated ${jobs.length} job URLs`);
        console.log('📊 Sample URLs:');
        jobs.slice(0, 3).forEach(job => {
            console.log(`   ${job.title} → ${job.url}`);
        });
        console.log(`💾 Backup created: ${backupPath}`);
        
    } catch (error) {
        console.error('❌ Error updating job URLs:', error);
    }
}

// Run the URL fixer
updateJobURLs();
