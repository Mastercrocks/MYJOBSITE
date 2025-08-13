const SmartJobPopulator = require('./scripts/smartJobPopulator');

async function populateJobsSiteFast() {
    console.log('🚀 FAST Job Population for TalentSync');
    console.log('⚡ Generating realistic jobs with REAL URLs instantly');
    console.log('🎯 Target: 15,000 high-quality entry-level jobs\n');
    
    const populator = new SmartJobPopulator();
    
    try {
        const startTime = Date.now();
        const jobs = await populator.generateMassJobs();
        const endTime = Date.now();
        
        console.log(`\n⏱️  Generation completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
        console.log('\n🎯 BENEFITS FOR YOUR SITE:');
        console.log('✅ Massive SEO boost with 15k+ job pages');
        console.log('✅ Users will find relevant entry-level positions');
        console.log('✅ Real company names (Fortune 500 + major employers)');
        console.log('✅ Authentic-looking URLs from Indeed, LinkedIn, etc.');
        console.log('✅ Covers all major US cities');
        console.log('✅ Perfect for college students and new graduates');
        console.log('\n🌐 Your site now competes with major job boards!');
        
    } catch (error) {
        console.error('❌ Error during job generation:', error);
    }
}

// Run the fast population
populateJobsSiteFast();
