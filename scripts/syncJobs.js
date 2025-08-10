const cron = require('node-cron');
const jobApiService = require('../services/jobApiService');

// Common job search terms to refresh
const SEARCH_TERMS = [
  'software developer',
  'data scientist',
  'product manager',
  'marketing manager',
  'sales representative',
  'customer service',
  'accountant',
  'nurse',
  'teacher',
  'administrative assistant'
];

const LOCATIONS = [
  'remote',
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX'
];

async function syncJobsFromAPIs() {
  console.log('🔄 Starting job sync from external APIs...');
  
  try {
    let totalJobs = 0;
    
    // Sync jobs for each search term and location combination
    for (let i = 0; i < Math.min(SEARCH_TERMS.length, 3); i++) {
      for (let j = 0; j < Math.min(LOCATIONS.length, 2); j++) {
        const searchParams = {
          search: SEARCH_TERMS[i],
          location: LOCATIONS[j],
          jobs_per_page: 10
        };
        
        console.log(`Fetching jobs for "${SEARCH_TERMS[i]}" in "${LOCATIONS[j]}"`);
        
        const jobs = await jobApiService.aggregateJobs(searchParams);
        if (jobs.length > 0) {
          await jobApiService.saveExternalJobs(jobs);
          totalJobs += jobs.length;
        }
        
        // Rate limiting - wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`✅ Job sync completed. Processed ${totalJobs} jobs.`);
    
  } catch (error) {
    console.error('❌ Job sync failed:', error);
  }
}

// Schedule job sync every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('⏰ Scheduled job sync starting...');
  await syncJobsFromAPIs();
}, {
  timezone: "America/New_York"
});

// Run immediately if this script is executed directly
if (require.main === module) {
  syncJobsFromAPIs().then(() => {
    console.log('Manual job sync completed. Exiting...');
    process.exit(0);
  });
}

module.exports = { syncJobsFromAPIs };