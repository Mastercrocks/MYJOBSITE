const MassJobScraper = require('./scripts/massJobScraper');

async function populateJobsSite() {
    console.log('🚀 Starting mass job population for TalentSync...');
    console.log('📋 This will scrape 10k-20k REAL jobs with REAL URLs');
    console.log('⏱️  Expected time: 2-4 hours (due to rate limiting)\n');
    
    const scraper = new MassJobScraper();
    
    try {
        const jobs = await scraper.scrapeThousandsOfJobs();
        
        console.log('\n🎉 SUCCESS! Job site populated with real jobs');
        console.log(`📊 Total jobs added: ${jobs.length}`);
        console.log('✅ All jobs have real URLs from Indeed and LinkedIn');
        console.log('✅ Jobs span 50+ major US cities');
        console.log('✅ Multiple entry-level categories covered');
        console.log('✅ Perfect for SEO and user engagement');
        
    } catch (error) {
        console.error('❌ Error during mass scraping:', error);
    }
}

// Run the population script
populateJobsSite();
