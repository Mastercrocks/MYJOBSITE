// Debug Email System - Find out why emails aren't being sent
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

console.log('🔍 EMAIL SYSTEM DEBUG');
console.log('=====================\n');

// Test email configuration
console.log('1. 📧 Testing Email Configuration...');

const emailConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'jamesen9@gmail.com',
        pass: (process.env.EMAIL_PASS || '').replace(/\s/g, '') || 'jvsi aept dlma kahv'
    }
};

console.log(`   Host: ${emailConfig.host}`);
console.log(`   Port: ${emailConfig.port}`);
console.log(`   User: ${emailConfig.auth.user}`);
console.log(`   Pass: ${emailConfig.auth.pass ? '***' + emailConfig.auth.pass.slice(-4) : 'NOT SET'}`);

// Test transporter
console.log('\n2. 🔧 Testing Email Transporter...');
const transporter = nodemailer.createTransport(emailConfig);

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        console.log('   ❌ Email connection FAILED:', error.message);
    } else {
        console.log('   ✅ Email connection SUCCESS!');
        
        // Test sending email
        testSendEmail();
    }
});

async function testSendEmail() {
    console.log('\n3. 📨 Testing Email Send...');
    
    const fromAddr = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'jamesen9@gmail.com';
    const toAddr = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || 'jamesen9@gmail.com';
    const testEmail = {
        from: `"TalentSync Test" <${fromAddr}>`,
        to: toAddr,
        subject: '🧪 Test Email from TalentSync Debug',
        html: `
            <h2>🧪 Email System Test</h2>
            <p>If you received this email, your email system is working!</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>From:</strong> Email Debug Script</p>
        `,
        text: 'Test email from TalentSync debug script. If you see this, email is working!'
    };
    
    try {
        const result = await transporter.sendMail(testEmail);
        console.log('   ✅ TEST EMAIL SENT SUCCESSFULLY!');
        console.log(`   📧 Message ID: ${result.messageId}`);
        console.log('   📱 Check your email: jamesen9@gmail.com');
        
    } catch (error) {
        console.log('   ❌ TEST EMAIL FAILED:', error.message);
        
        if (error.message.includes('Authentication failed')) {
            console.log('   💡 SOLUTION: Check your Gmail app password');
            console.log('   🔑 Current password ends with: ***' + emailConfig.auth.pass.slice(-4));
        }
        
        if (error.message.includes('SMTP')) {
            console.log('   💡 SOLUTION: Check SMTP settings');
        }
    }
}

// Check email list
console.log('\n4. 📋 Checking Email Subscriber List...');
try {
    const emailListPath = path.join(__dirname, 'data', 'email_list.json');
    const emailList = JSON.parse(fs.readFileSync(emailListPath, 'utf8'));
    
    console.log(`   📊 Total subscribers: ${emailList.length}`);
    emailList.forEach((subscriber, index) => {
        console.log(`   ${index + 1}. ${subscriber.email} (${subscriber.status})`);
    });
    
} catch (error) {
    console.log('   ❌ Error reading email list:', error.message);
}

// Check campaign history
console.log('\n5. 📈 Checking Campaign History...');
try {
    const campaignsPath = path.join(__dirname, 'data', 'email_campaigns.json');
    const campaigns = JSON.parse(fs.readFileSync(campaignsPath, 'utf8'));
    
    console.log(`   📊 Total campaigns: ${campaigns.length}`);
    
    if (campaigns.length > 0) {
        console.log('   Recent campaigns:');
        campaigns.slice(0, 3).forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.jobTitle} - ${campaign.sentTo} emails sent (${campaign.sentAt})`);
        });
    } else {
        console.log('   ⚠️  NO CAMPAIGNS FOUND - This means auto emails haven\'t been sent yet');
    }
    
} catch (error) {
    console.log('   ❌ Error reading campaigns:', error.message);
}

console.log('\n🎯 TROUBLESHOOTING STEPS:');
console.log('==========================');
console.log('1. Check Gmail app password is correct');
console.log('2. Verify email list has your email');
console.log('3. Test posting a job and check server logs');
console.log('4. Check spam folder in Gmail');
console.log('5. Verify Railway environment variables');
