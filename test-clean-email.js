const nodemailer = require('nodemailer');

// Test job data
const testJob = {
    title: "Frontend Developer",
    company: "TechCorp Inc",
    location: "New York, NY",
    job_type: "full-time",
    salary: "$70K - $90K",
    description: "We are looking for a talented Frontend Developer to join our growing team. You will be responsible for building responsive web applications using modern JavaScript frameworks and ensuring excellent user experience.",
    url: "https://talentsync.shop/job/123",
    entry_level: true,
    remote: true
};

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jamesen9@gmail.com',
        pass: 'ojcp qrvj kcgz hvzq'
    }
});

// Clean email template (fixed version)
const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Job Alert - TalentSync</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 0; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px 30px; text-align: center; }
        .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 600; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .job-card { background: #f8fafc; padding: 24px; border-radius: 12px; border-left: 4px solid #2563eb; margin: 0 0 24px 0; }
        .job-title { color: #1e40af; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; }
        .company { font-size: 18px; color: #64748b; margin: 0 0 20px 0; font-weight: 500; }
        .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 20px 0; }
        .detail-item { background: white; padding: 12px 16px; border-radius: 8px; font-size: 14px; border: 1px solid #e2e8f0; }
        .apply-btn { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 600; text-align: center; margin: 24px 0; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; }
        .apply-btn:hover { background: linear-gradient(135deg, #1d4ed8, #2563eb); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4); }
        .perks-section { background: linear-gradient(135deg, #dbeafe, #e0f2fe); padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #bfdbfe; }
        .perks-section h3 { color: #1e40af; margin: 0 0 16px 0; font-size: 18px; font-weight: 600; }
        .perks-section ul { margin: 0; padding-left: 20px; }
        .perks-section li { margin: 8px 0; color: #374151; }
        .cta-section { text-align: center; margin: 30px 0; padding: 24px; background: #f1f5f9; border-radius: 12px; }
        .cta-section p { margin: 0 0 16px 0; color: #475569; font-weight: 500; }
        .cta-section a { color: #2563eb; text-decoration: none; font-weight: 600; }
        .footer { text-align: center; margin-top: 30px; padding: 24px 30px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; background: #f8fafc; }
        .footer p { margin: 8px 0; }
        .footer a { color: #2563eb; text-decoration: none; font-weight: 500; }
        .unsubscribe { color: #94a3b8 !important; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 TalentSync Job Alert</h1>
            <p>A new opportunity just posted that matches your interests</p>
        </div>
        
        <div class="content">
            <div class="job-card">
                <h2 class="job-title">${testJob.title}</h2>
                <p class="company">🏢 ${testJob.company}</p>
                
                <div class="details">
                    <div class="detail-item">📍 <strong>Location:</strong> ${testJob.location}</div>
                    <div class="detail-item">💼 <strong>Type:</strong> ${testJob.job_type}</div>
                    <div class="detail-item">💰 <strong>Salary:</strong> ${testJob.salary}</div>
                    <div class="detail-item">📅 <strong>Posted:</strong> Just now</div>
                </div>
                
                <div style="margin: 24px 0;">
                    <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px;">Job Description:</h3>
                    <p style="color: #374151; line-height: 1.6;">${testJob.description.substring(0, 300)}${testJob.description.length > 300 ? '...' : ''}</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="${testJob.url}" class="apply-btn" style="color: white;">
                        🚀 Apply Now
                    </a>
                </div>
            </div>
            
            <div class="perks-section">
                <h3>💡 Why This Job is Perfect:</h3>
                <ul>
                    <li>✅ ${testJob.entry_level ? 'Entry-level friendly' : 'Great for experienced professionals'}</li>
                    <li>✅ ${testJob.remote ? 'Remote work available' : 'On-site opportunity'}</li>
                    <li>✅ Posted today - apply early for best chances!</li>
                    <li>✅ Trusted company verified by TalentSync</li>
                </ul>
            </div>
            
            <div class="cta-section">
                <p><strong>Don't miss out!</strong> This job was just posted and applications are being reviewed immediately.</p>
                <a href="https://talentsync.shop/jobs.html">
                    🔍 Browse More Jobs on TalentSync
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>You're receiving this because you subscribed to TalentSync job alerts.</p>
            <p>
                <a href="https://talentsync.shop">Visit TalentSync</a> | 
                <a href="mailto:talentsync@talentsync.shop?subject=Unsubscribe" class="unsubscribe">Unsubscribe</a>
            </p>
            <p>© 2025 TalentSync - Connecting Talent with Opportunity</p>
        </div>
    </div>
</body>
</html>`;

async function sendTestEmail() {
    try {
        const mailOptions = {
            from: '"TalentSync Job Alerts" <jamesen9@gmail.com>',
            to: 'jamesen9@gmail.com',
            subject: '🧪 TEST: Fixed Email Template - No More CSS Code!',
            html: emailTemplate,
            text: `Test Email: ${testJob.title} at ${testJob.company}\n\nThis is a test to verify the email template is working correctly without showing CSS code.`
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully!');
        console.log('📧 Email ID:', result.messageId);
        console.log('📨 Check your inbox for the clean email template.');
        
    } catch (error) {
        console.error('❌ Failed to send test email:', error.message);
    }
}

sendTestEmail();
