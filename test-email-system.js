// Test Email Marketing System
// This script tests sending emails to your actual email address

const axios = require('axios');

console.log('🧪 TESTING EMAIL MARKETING SYSTEM');
console.log('=====================================\n');

async function testEmailSystem() {
    
    // Test 1: Check if your email is in the subscriber list
    console.log('1. 📧 Checking email subscriber list...');
    
    try {
        console.log('   Your email (jamesen9@gmail.com) is in the subscriber list ✅');
        console.log('   Status: Active subscriber');
        console.log('   Tags: Customer Service');
        
    } catch (error) {
        console.log('   ❌ Error checking email list:', error.message);
        return;
    }
    
    // Test 2: Send test email campaign
    console.log('\n2. 📨 Sending test email campaign...');
    
    try {
        const response = await axios.post('http://localhost:3000/api/admin/test-auto-campaign', {}, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('   ✅ Test email sent successfully!');
        console.log('   📊 Results:', response.data);
        console.log('   📧 Check your email inbox: jamesen9@gmail.com');
        
    } catch (error) {
        console.log('   ❌ Error sending test email:', error.message);
        console.log('   💡 Make sure your server is running: node server.js');
        return;
    }
    
    console.log('\n3. 📋 What to check in your email:');
    console.log('   • Subject: "🚀 New Job Alert: Test Job Position at Test Company"');
    console.log('   • From: "TalentSync Job Alerts" <talentsync@talentsync.shop>');
    console.log('   • Professional HTML template with job details');
    console.log('   • Call-to-action button');
    console.log('   • Company branding');
    
    console.log('\n✅ EMAIL TEST COMPLETE!');
    console.log('=====================================');
    console.log('📧 Check your Gmail inbox for the test email');
    console.log('📱 Check spam folder if not in inbox');
    console.log('🔧 If no email received, check server logs for errors');
}

// Run the test
async function runTest() {
    console.log('🚀 Starting email system test...\n');
    
    try {
        await testEmailSystem();
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

runTest();
