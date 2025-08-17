// Test job posting with email campaign
const axios = require('axios');

async function testJobPostingWithEmail() {
    console.log('🧪 TESTING JOB POSTING WITH EMAIL CAMPAIGN');
    console.log('==========================================\n');
    
    const testJob = {
        title: 'Test Marketing Coordinator',
        company: 'TalentSync Test Company',
        location: 'Remote',
        description: 'This is a test job posting to verify that email campaigns are sent automatically when jobs are posted.',
        requirements: 'No real requirements - this is just a test',
        salary: '$45,000 - $55,000',
        job_type: 'Full-time',
        entry_level: true,
        remote: true,
        category: 'Marketing'
    };
    
    try {
        console.log('📝 Posting test job...');
        console.log(`   Title: ${testJob.title}`);
        console.log(`   Company: ${testJob.company}`);
        
        const response = await axios.post('http://localhost:3000/api/admin/jobs', testJob, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ JOB POSTED SUCCESSFULLY!');
        console.log('📊 Server Response:', response.data.message);
        
        if (response.data.message.includes('email campaign')) {
            console.log('📧 ✅ EMAIL CAMPAIGN WAS TRIGGERED!');
        } else {
            console.log('📧 ⚠️  Email campaign message not found in response');
        }
        
        console.log('\n📧 CHECK YOUR EMAIL NOW!');
        console.log('   Email: jamesen9@gmail.com');
        console.log('   Subject should be: "🚀 New Job Alert: Test Marketing Coordinator at TalentSync Test Company"');
        
        // Check campaign history after posting
        setTimeout(() => {
            checkCampaignHistory();
        }, 2000);
        
    } catch (error) {
        console.log('❌ ERROR posting job:', error.message);
        
        if (error.response) {
            console.log('   Server responded with:', error.response.data);
        }
    }
}

async function checkCampaignHistory() {
    console.log('\n📈 Checking if campaign was logged...');
    
    try {
        const fs = require('fs');
        const campaigns = JSON.parse(fs.readFileSync('./data/email_campaigns.json', 'utf8'));
        
        console.log(`   Total campaigns now: ${campaigns.length}`);
        
        if (campaigns.length > 0) {
            const latest = campaigns[0];
            console.log('   ✅ Latest campaign:');
            console.log(`      Job: ${latest.jobTitle}`);
            console.log(`      Emails sent: ${latest.sentTo}`);
            console.log(`      Time: ${latest.sentAt}`);
        }
        
    } catch (error) {
        console.log('   ❌ Error checking campaigns:', error.message);
    }
}

// Run the test
testJobPostingWithEmail();
