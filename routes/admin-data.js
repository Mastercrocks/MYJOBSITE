const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');
const Parser = require('rss-parser');

// Email configuration for auto campaigns
const emailConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'jamesen9@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-email-password'
    }
};

// Create email transporter
const transporter = nodemailer.createTransport(emailConfig);

// Helper function to read JSON files
async function readJSONFile(filename) {
    try {
        const filePath = path.join(__dirname, '../data', filename);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
}

// Helper function to write JSON files
async function writeJSONFile(filename, data) {
    try {
        const filePath = path.join(__dirname, '../data', filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
}

// 🚀 AUTOMATED EMAIL MARKETING: Send new job to email list
async function sendNewJobEmailCampaign(newJob) {
    try {
        console.log(`📧 Starting auto email campaign for: ${newJob.title}`);
        
        // Get email list
        const emailList = await readJSONFile('email_list.json');
        
        if (!emailList || emailList.length === 0) {
            console.log('📭 No email subscribers found - skipping auto campaign');
            return;
        }

        // Create professional email template
        const emailSubject = `🚀 New Job Alert: ${newJob.title} at ${newJob.company}`;
        
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
                <h2 class="job-title">${newJob.title}</h2>
                <p class="company">🏢 ${newJob.company}</p>
                
                <div class="details">
                    <div class="detail-item">📍 <strong>Location:</strong> ${newJob.location}</div>
                    <div class="detail-item">💼 <strong>Type:</strong> ${newJob.job_type}</div>
                    <div class="detail-item">💰 <strong>Salary:</strong> ${newJob.salary}</div>
                    <div class="detail-item">📅 <strong>Posted:</strong> Just now</div>
                </div>
                
                <div style="margin: 24px 0;">
                    <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px;">Job Description:</h3>
                    <p style="color: #374151; line-height: 1.6;">${newJob.description.substring(0, 300)}${newJob.description.length > 300 ? '...' : ''}</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="${newJob.url}" class="apply-btn" style="color: white;">
                        🚀 Apply Now
                    </a>
                </div>
            </div>
            
            <div class="perks-section">
                <h3>💡 Why This Job is Perfect:</h3>
                <ul>
                    <li>✅ ${newJob.entry_level ? 'Entry-level friendly' : 'Great for experienced professionals'}</li>
                    <li>✅ ${newJob.remote ? 'Remote work available' : 'On-site opportunity'}</li>
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

        // Send to all subscribers
        let successCount = 0;
        let failCount = 0;
        
        for (const subscriber of emailList) {
            try {
                const mailOptions = {
                    from: '"TalentSync Job Alerts" <jamesen9@gmail.com>',
                    replyTo: 'talentsync@talentsync.shop',
                    to: subscriber.email,
                    subject: emailSubject,
                    html: emailTemplate,
                    text: `New Job Alert: ${newJob.title} at ${newJob.company}\n\nLocation: ${newJob.location}\nType: ${newJob.job_type}\nSalary: ${newJob.salary}\n\nApply now: ${newJob.url}\n\nVisit TalentSync: https://talentsync.shop`
                };

                await transporter.sendMail(mailOptions);
                successCount++;
                console.log(`📧 Sent to: ${subscriber.email}`);
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                failCount++;
                console.error(`❌ Failed to send to \${subscriber.email}:`, error.message);
            }
        }
        
        console.log(`📊 Auto email campaign results:`);
        console.log(`   ✅ Sent successfully: ${successCount}`);
        console.log(`   ❌ Failed: ${failCount}`);
        console.log(`   📧 Total subscribers: ${emailList.length}`);
        
        // Log the campaign
        const campaigns = await readJSONFile('email_campaigns.json');
        campaigns.unshift({
            id: Date.now(),
            type: 'auto_job_alert',
            jobId: newJob.id,
            jobTitle: newJob.title,
            company: newJob.company,
            subject: emailSubject,
            sentTo: successCount,
            failed: failCount,
            sentAt: new Date().toISOString(),
            status: 'completed'
        });
        
        await writeJSONFile('email_campaigns.json', campaigns);
        
        return { success: true, sent: successCount, failed: failCount };
        
    } catch (error) {
        console.error('❌ Auto email campaign error:', error);
        throw error;
    }
}

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [jobsRaw, users, employersRaw, careerApps, jobApps, analytics, revenue, emailList, resumes] = await Promise.all([
            readJSONFile('jobs.json'),
            readJSONFile('users.json'),
            readJSONFile('employers.json'),
            readJSONFile('career_applications.json'),
            readJSONFile('applications.json'),
            readJSONFile('analytics.json'),
            readJSONFile('revenue.json'),
            readJSONFile('email_list.json'),
            readJSONFile('resumes.json')
        ]);
        // Build employers view by merging users.json (source of truth) with employers.json (legacy/company meta)
        const employersFromUsers = (users || []).filter(u => (u.user_type || u.userType) === 'employer').map(u => ({
            id: String(u.id || u.userId || ''),
            userId: String(u.id || ''),
            companyName: u.companyName || u.company || u.name || '',
            contactEmail: u.email,
            contactName: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || '',
            status: (u.status || 'active').toLowerCase(),
            verified: !!u.verified,
            jobsPosted: Array.isArray(u.jobs) ? u.jobs.length : (u.jobsPosted || 0),
            createdAt: u.createdAt || u.registrationDate || u.joinedAt || new Date().toISOString(),
            plan: (u.plan || 'free').toLowerCase(),
            billing: u.billing || {}
        }));
        const employersLegacy = (employersRaw || []).map(e => ({
            id: String(e.id || e.userId || ''),
            userId: String(e.userId || e.id || ''),
            companyName: e.companyName || e.company || '',
            contactEmail: e.contactEmail || e.email || '',
            contactName: e.contactName || '',
            status: (e.status || 'active').toLowerCase(),
            verified: !!e.verified,
            jobsPosted: e.jobsPosted || 0,
            createdAt: e.createdAt || new Date().toISOString()
        }));
        const employersByUserId = new Map();
        employersLegacy.forEach(e => { if (e.userId) employersByUserId.set(String(e.userId), e); });
        const employers = employersFromUsers.map(u => ({
            ...(employersByUserId.get(String(u.userId)) || {}),
            ...u
        }));

        // Normalize jobs: active-only and normalize dates
        const normalizeJobDate = (j) => {
            const d = j.posted_date || j.datePosted || j.scraped_at || null;
            const dt = d ? new Date(d) : null;
            return (dt && !isNaN(dt)) ? dt : null;
        };
        const jobs = (jobsRaw || []).map(j => ({ ...j, _date: normalizeJobDate(j) }));
        const activeJobs = jobs.filter(j => (j.status || 'active') === 'active');
        const activeJobsCount = activeJobs.length;

        // Calculate statistics
        const now = new Date();
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Job statistics
        const newJobsThisWeek = activeJobs.filter(job => job._date && job._date >= thisWeek).length;
        const newJobsThisMonth = activeJobs.filter(job => job._date && job._date >= thisMonth).length;
        
        // User statistics
    const newUsersThisWeek = (users || []).filter(user => user.createdAt && new Date(user.createdAt) >= thisWeek).length;
        
        // Application statistics (combine career and job applications)
        const applications = [...(careerApps || []), ...(jobApps || [])];
        const newApplicationsThisWeek = applications.filter(app => app.appliedAt && new Date(app.appliedAt) >= thisWeek).length;

        // Category distribution
        const categoryStats = {};
        activeJobs.forEach(job => {
            const key = job.category || 'Uncategorized';
            categoryStats[key] = (categoryStats[key] || 0) + 1;
        });

        // Company statistics
        const companyStats = {};
        activeJobs.forEach(job => {
            const key = job.company || 'Unknown';
            companyStats[key] = (companyStats[key] || 0) + 1;
        });

        // Location statistics
        const locationStats = {};
        activeJobs.forEach(job => {
            const key = job.location || 'Unknown';
            locationStats[key] = (locationStats[key] || 0) + 1;
        });

        // Calculate weekly page views from analytics
        let weeklyPageViews = 0;
        if (analytics && analytics.pageViews && analytics.pageViews.daily) {
            const last7Days = Array.from({length: 7}, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            });
            
            weeklyPageViews = last7Days.reduce((sum, date) => {
                return sum + (analytics.pageViews.daily[date] || 0);
            }, 0);
        }

        // Calculate revenue metrics
        let weeklyRevenue = 0;
        let monthlyRevenue = 0;
        if (revenue && revenue.revenue && revenue.revenue.daily) {
            const last7Days = Array.from({length: 7}, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            });
            
            weeklyRevenue = last7Days.reduce((sum, date) => {
                return sum + (revenue.revenue.daily[date] || 0);
            }, 0);
        }

        // Get current month revenue
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (revenue && revenue.revenue && revenue.revenue.monthly) {
            monthlyRevenue = revenue.revenue.monthly[currentMonth] || 0;
        }

        res.json({
            totals: {
                jobs: activeJobsCount,
                users: (users || []).length,
                employers: (employers || []).length,
                applications: applications.length,
                pageViews: analytics?.pageViews?.total || 0,
                revenue: revenue?.revenue?.total || 0,
                subscribers: (emailList || []).length,
                resumes: (resumes || []).length
            },
            weekly: {
                newJobs: newJobsThisWeek,
                newUsers: newUsersThisWeek,
                newApplications: newApplicationsThisWeek,
                pageViews: weeklyPageViews,
                revenue: weeklyRevenue
            },
            monthly: {
                newJobs: newJobsThisMonth,
                revenue: monthlyRevenue
            },
            revenue: {
                total: revenue?.revenue?.total || 0,
                monthly: monthlyRevenue,
                weekly: weeklyRevenue,
                sources: revenue?.revenue?.sources || {},
                recentTransactions: revenue?.transactions?.slice(0, 5) || [],
                subscriptions: revenue?.subscriptions || { active: 0, expired: 0, trial: 0 }
            },
            analytics: {
                uniqueVisitors: analytics?.visitors?.unique || 0,
                returningVisitors: analytics?.visitors?.returning || 0,
                topPages: analytics?.pageViews?.pages ? 
                    Object.entries(analytics.pageViews.pages)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 10)
                        .map(([page, views]) => ({ page, views })) : []
            },
            categories: categoryStats,
            companies: companyStats,
            locations: locationStats,
            topCompanies: Object.entries(companyStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([company, count]) => ({ company, count })),
            topLocations: Object.entries(locationStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([location, count]) => ({ location, count })),
            
            // Raw data for dashboard activity
            jobs: activeJobs
                .sort((a, b) => {
                    const da = normalizeJobDate(a);
                    const db = normalizeJobDate(b);
                    return (db?.getTime() || 0) - (da?.getTime() || 0);
                })
                .slice(0, 10),
            applications: applications
                .sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0))
                .slice(0, 10),
            employers: (employers || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5),
            
            // Quick stats for sidebar
            quickStats: {
                activeEmployers: (employers || []).filter(emp => (emp.status || 'active').toLowerCase() === 'active').length,
                pendingApplications: applications.filter(app => (app.status || '').toLowerCase() === 'pending').length,
                resumesUploaded: (resumes || []).length,
                featuredJobs: activeJobs.filter(job => job.featured === true || job.featured === 'true').length
            }
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ error: 'Failed to load dashboard statistics' });
    }
});

// Get all jobs with pagination and filters
router.get('/jobs', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const company = req.query.company || '';
        const location = req.query.location || '';

        const norm = (v) => (v || '').toString().toLowerCase();
        const searchNorm = norm(search);
        const categoryNorm = norm(category);
        const companyNorm = norm(company);
        const locationNorm = norm(location);

        // Filter jobs safely (handle missing fields)
        let filteredJobs = (jobs || []).filter(job => {
            const title = norm(job.title);
            const comp = norm(job.company);
            const loc = norm(job.location);

            const matchesSearch = !search || title.includes(searchNorm) || comp.includes(searchNorm) || loc.includes(searchNorm);
            const matchesCategory = !category || norm(job.category) === categoryNorm;
            const matchesCompany = !company || comp === companyNorm;
            const matchesLocation = !location || loc === locationNorm;
            return matchesSearch && matchesCategory && matchesCompany && matchesLocation;
        });

        // Sort by best-known date (posted_date | datePosted | scraped_at | created_at | createdAt)
        const getDate = (j) => {
            const d = j.posted_date || j.datePosted || j.scraped_at || j.created_at || j.createdAt;
            if (!d) return 0;
            const dt = new Date(d);
            return isNaN(dt) ? 0 : dt.getTime();
        };
        filteredJobs.sort((a, b) => getDate(b) - getDate(a));

        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

        res.json({
            jobs: paginatedJobs,
            total: filteredJobs.length,
            page,
            totalPages: Math.ceil(filteredJobs.length / limit),
            hasMore: endIndex < filteredJobs.length
        });
    } catch (error) {
        console.error('Error getting jobs:', error);
        res.status(500).json({ error: 'Failed to load jobs' });
    }
});

// Admin: Import jobs via RSS feed (basic normalizer + dedupe)
router.post('/import/rss', async (req, res) => {
    try {
        const { feedUrl, defaultLocation = '', sourceLabel = 'RSS' } = req.body || {};
        if (!feedUrl || typeof feedUrl !== 'string') {
            return res.status(400).json({ success: false, message: 'feedUrl is required' });
        }

        const parser = new Parser();
        const feed = await parser.parseURL(feedUrl);

        const jobs = await readJSONFile('jobs.json');
        const existingUrls = new Set(jobs.map(j => (j.url || '').trim().toLowerCase()));

        const newJobs = [];
        for (const item of feed.items || []) {
            const link = (item.link || '').trim();
            if (!link || !/^https?:\/\//i.test(link)) continue;
            if (existingUrls.has(link.toLowerCase())) continue; // dedupe by URL

            const title = (item.title || '').trim();
            if (!title) continue;

            const description = (item.contentSnippet || item.content || item.summary || '').toString().trim();

            const job = {
                id: Date.now() + Math.floor(Math.random() * 1000000),
                title,
                company: (item.creator || item.author || 'Unknown Company').toString(),
                location: defaultLocation || 'Remote',
                description,
                url: link,
                salary: '',
                job_type: 'Full-time',
                category: '',
                remote: /remote/i.test(title) || /remote/i.test(description),
                entry_level: /intern|entry|junior/i.test(title),
                featured: false,
                urgent: false,
                status: 'active',
                source: sourceLabel || 'RSS',
                posted_date: new Date(item.isoDate || item.pubDate || Date.now()).toISOString()
            };

            jobs.unshift(job);
            newJobs.push(job);
            existingUrls.add(link.toLowerCase());
        }

        if (newJobs.length > 0) {
            await writeJSONFile('jobs.json', jobs);
        }

        res.json({ success: true, imported: newJobs.length, jobs: newJobs });
    } catch (error) {
        console.error('RSS import failed:', error);
        res.status(500).json({ success: false, message: 'RSS import failed', error: error.message });
    }
});

// Admin: Indeed import stub (to be implemented with API or scraping)
router.post('/import/indeed', async (req, res) => {
    // Placeholder: wire to Indeed API or feed when available
    res.json({ success: false, message: 'Indeed import not configured yet. Provide API/feed details to enable.' });
});

// Admin: LinkedIn import stub (respect TOS; requires authorized API)
router.post('/import/linkedin', async (req, res) => {
    // Placeholder: LinkedIn official API access required; scraping is against TOS
    res.json({ success: false, message: 'LinkedIn import requires official API access. Not enabled by default.' });
});

// Get all users with pagination
router.get('/users', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        // Sort by creation date (newest first)
        users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Remove passwords from response
        const safeUsers = users.map(user => {
            const { password, ...safeUser } = user;
            return safeUser;
        });

        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = safeUsers.slice(startIndex, endIndex);

        res.json({
            users: paginatedUsers,
            total: users.length,
            page,
            totalPages: Math.ceil(users.length / limit),
            hasMore: endIndex < users.length
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});

// Get all employers
router.get('/employers', async (req, res) => {
    try {
        const [employersRaw, users] = await Promise.all([
            readJSONFile('employers.json'),
            readJSONFile('users.json')
        ]);

        const employersFromUsers = (users || []).filter(u => (u.user_type || u.userType) === 'employer').map(u => ({
            id: String(u.id || u.userId || ''),
            userId: String(u.id || ''),
            companyName: u.companyName || u.company || u.name || '',
            contactEmail: u.email,
            contactName: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || '',
            status: (u.status || 'active').toLowerCase(),
            verified: !!u.verified,
            jobsPosted: Array.isArray(u.jobs) ? u.jobs.length : (u.jobsPosted || 0),
            createdAt: u.createdAt || u.registrationDate || u.joinedAt || new Date().toISOString(),
            plan: (u.plan || 'free').toLowerCase(),
            billing: u.billing || {}
        }));
        const employersLegacy = (employersRaw || []).map(e => ({
            id: String(e.id || e.userId || ''),
            userId: String(e.userId || e.id || ''),
            companyName: e.companyName || e.company || '',
            contactEmail: e.contactEmail || e.email || '',
            contactName: e.contactName || '',
            status: (e.status || 'active').toLowerCase(),
            verified: !!e.verified,
            jobsPosted: e.jobsPosted || 0,
            createdAt: e.createdAt || new Date().toISOString()
        }));
        const employersByUserId = new Map();
        employersLegacy.forEach(e => { if (e.userId) employersByUserId.set(String(e.userId), e); });
        const merged = employersFromUsers.map(u => ({
            ...(employersByUserId.get(String(u.userId)) || {}),
            ...u,
            plan: (u.plan || 'free').toLowerCase(),
            billingStatus: u.billing?.status || null,
            subscriptionId: u.billing?.subscriptionId || null,
            customerId: u.billing?.customerId || null
        }));
        res.json({ employers: merged });
    } catch (error) {
        console.error('Error getting employers:', error);
        res.status(500).json({ error: 'Failed to load employers' });
    }
});

// Get jobs for a specific employer (by employer ID with company fallback)
router.get('/employers/:id/jobs', async (req, res) => {
    try {
        const employerId = String(req.params.id);
        const [jobsRaw, users, employersRaw] = await Promise.all([
            readJSONFile('jobs.json'),
            readJSONFile('users.json'),
            readJSONFile('employers.json')
        ]);

        // Build employer index similar to /employers
        const employersFromUsers = (users || []).filter(u => (u.user_type || u.userType) === 'employer').map(u => ({
            id: String(u.id || u.userId || ''),
            userId: String(u.id || ''),
            companyName: u.companyName || u.company || u.name || '',
            contactEmail: u.email,
            contactName: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || '',
            status: (u.status || 'active').toLowerCase(),
            verified: !!u.verified,
            plan: (u.plan || 'free').toLowerCase(),
            billing: u.billing || {}
        }));
        const employersLegacy = (employersRaw || []).map(e => ({
            id: String(e.id || e.userId || ''),
            userId: String(e.userId || e.id || ''),
            companyName: e.companyName || e.company || '',
            contactEmail: e.contactEmail || e.email || '',
            contactName: e.contactName || '',
            status: (e.status || 'active').toLowerCase(),
            verified: !!e.verified
        }));
        const byUserId = new Map();
        employersLegacy.forEach(e => { if (e.userId) byUserId.set(String(e.userId), e); });
        const employers = employersFromUsers.map(u => ({ ...(byUserId.get(String(u.userId)) || {}), ...u }));

        const employer = employers.find(e => String(e.id) === employerId || String(e.userId) === employerId);
        const companyNorm = (employer?.companyName || '').toString().trim().toLowerCase();

        // Normalize date
        const getDate = (j) => {
            const d = j.posted_date || j.datePosted || j.scraped_at || j.created_at || j.createdAt;
            if (!d) return 0;
            const dt = new Date(d);
            return isNaN(dt) ? 0 : dt.getTime();
        };
        const norm = v => (v || '').toString().trim().toLowerCase();

        const jobs = (jobsRaw || []).filter(j => {
            const byId = String(j.employerId || '') === employerId || String(j.postedBy || '') === employerId;
            if (byId) return true;
            if (!companyNorm) return false;
            return norm(j.company) === companyNorm;
        }).sort((a, b) => getDate(b) - getDate(a));

        res.json({
            employer: employer || { id: employerId },
            total: jobs.length,
            jobs
        });
    } catch (error) {
        console.error('Error getting employer jobs:', error);
        res.status(500).json({ error: 'Failed to load employer jobs' });
    }
});

// Get all applications
router.get('/applications', async (req, res) => {
    try {
        const applications = await readJSONFile('career_applications.json');
        res.json({ applications });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({ error: 'Failed to load applications' });
    }
});

// Billing overview (subscriptions summary)
router.get('/billing/overview', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const employers = users.filter(u => (u.user_type || u.userType) === 'employer');
        const counts = { free: 0, basic: 0, pro: 0 };
        let activeSubscriptions = 0;
        for (const u of employers) {
            const plan = (u.plan || 'free').toLowerCase();
            if (counts[plan] !== undefined) counts[plan]++;
            if (u.billing && (u.billing.status === 'active' || u.billing.status === 'trialing')) activeSubscriptions++;
        }
        res.json({ counts, activeSubscriptions, totalEmployers: employers.length });
    } catch (error) {
        console.error('Error getting billing overview:', error);
        res.status(500).json({ error: 'Failed to load billing overview' });
    }
});

// Update application status
router.put('/applications/status', async (req, res) => {
    try {
        const { id, status } = req.body;
        const applications = await readJSONFile('career_applications.json');
        
        const applicationIndex = applications.findIndex(app => app.id == id);
        if (applicationIndex === -1) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        applications[applicationIndex].status = status;
        applications[applicationIndex].statusUpdated = new Date().toISOString();
        
        await writeJSONFile('career_applications.json', applications);
        res.json({ success: true, message: `Application ${status} successfully` });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ error: 'Failed to update application status' });
    }
});

// Add new job manually
router.post('/jobs', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
        const jobId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Normalize booleans and enums from form
        const toBool = (v) => (typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true');
        const expRaw = (req.body.experience_level || '').toString().toLowerCase();
        const expMap = { 'entry': 'Entry Level', 'mid': 'Mid Level', 'senior': 'Senior Level', 'executive': 'Executive' };
        const experienceLevel = expMap[expRaw] || (req.body.experience_level || 'Mid Level');

        const featured = toBool(req.body.featured);
        const urgent = toBool(req.body.urgent);
        const jobType = req.body.job_type || req.body.type || 'full-time';
        const category = req.body.category || 'General';
        const applicationEmail = req.body.application_email;
        const applicationUrl = req.body.application_url;

        // Compute apply URL fallback
        const computedUrl = applicationUrl || (applicationEmail ? `mailto:${applicationEmail}` : `https://talentsync.shop/job-detail.html?id=${jobId}`);

        const newJob = {
            id: jobId,
            title: req.body.title,
            company: req.body.company,
            location: req.body.location,
            description: req.body.description,
            url: computedUrl,
            salary: req.body.salary || 'Not specified',
            source: 'Manual',
            job_type: jobType,
            remote: req.body.remote === 'true',
            posted_date: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
            category: category,
            entry_level: experienceLevel.toLowerCase().includes('entry'),
            experience_level: experienceLevel,
            requirements: req.body.skills ? req.body.skills.split(',').map(s => s.trim()) : [],
            benefits: [],
            featured: featured,
            urgent: urgent,
            application_email: applicationEmail,
            application_url: applicationUrl,
            status: 'active'
        };

        jobs.unshift(newJob); // Add to beginning of array
        
        const success = await writeJSONFile('jobs.json', jobs);
        if (success) {
            // 🚀 AUTO-SEND EMAIL MARKETING CAMPAIGN FOR NEW JOB
            let emailResult = null;
            let emailErrorMsg = null;
            try {
                emailResult = await sendNewJobEmailCampaign(newJob);
                console.log(`✅ Auto email campaign sent for job: ${newJob.title}`);
            } catch (emailError) {
                emailErrorMsg = emailError && emailError.message ? emailError.message : String(emailError);
                console.error('❌ Failed to send auto email campaign:', emailErrorMsg);
            }
            res.json({
                success: true,
                job: newJob,
                message: emailErrorMsg
                    ? 'Job added, but email campaign failed: ' + emailErrorMsg
                    : 'Job added successfully and email campaign sent!',
                emailError: emailErrorMsg || null,
                emailResult: emailResult || null
            });
        } else {
            res.status(500).json({ error: 'Failed to save job' });
        }
    } catch (error) {
        console.error('Error adding job:', error);
        res.status(500).json({ error: 'Failed to add job' });
    }
});

// Bulk update jobs (used by dashboard modal)
router.post('/jobs/bulk', async (req, res) => {
    try {
        const { action, jobIds } = req.body || {};
        if (!Array.isArray(jobIds) || !action) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }

        const jobs = await readJSONFile('jobs.json');
        let affected = 0;

        const setFlag = (job, field, value) => { job[field] = value; };

        const updated = jobs.map(job => {
            if (!jobIds.includes(job.id)) return job;
            affected++;
            switch (action) {
                case 'activate': job.status = 'active'; break;
                case 'deactivate': job.status = 'inactive'; break;
                case 'feature': setFlag(job, 'featured', true); break;
                case 'unfeature': setFlag(job, 'featured', false); break;
                case 'urgent': setFlag(job, 'urgent', true); break;
                case 'unurgent': setFlag(job, 'urgent', false); break;
                case 'delete': return null; // mark for deletion
                default: break;
            }
            job.updated_at = new Date().toISOString();
            return job;
        }).filter(Boolean);

        const success = await writeJSONFile('jobs.json', updated);
        if (!success) return res.status(500).json({ success: false, error: 'Failed to save changes' });

        res.json({ success: true, message: `Bulk action '${action}' applied to ${affected} job(s)` });
    } catch (error) {
        console.error('Error performing bulk job action:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update existing job
router.put('/jobs/:id', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
    const jobIndex = jobs.findIndex(job => String(job.id) === String(req.params.id));
        
        if (jobIndex === -1) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Update job with new data
        jobs[jobIndex] = {
            ...jobs[jobIndex],
            ...req.body,
            updated_at: new Date().toISOString()
        };

        const success = await writeJSONFile('jobs.json', jobs);
        if (success) {
            res.json({ success: true, job: jobs[jobIndex], message: 'Job updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update job' });
        }
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
});

// Delete job
router.delete('/jobs/:id', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
    const filteredJobs = jobs.filter(job => String(job.id) !== String(req.params.id));
        
        if (filteredJobs.length === jobs.length) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const success = await writeJSONFile('jobs.json', filteredJobs);
        if (success) {
            res.json({ success: true, message: 'Job deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete job' });
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// Export users to CSV
router.get('/users/export', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        
        // Create CSV content
        const csvHeaders = 'ID,Name,Email,Type,Status,Created Date,Last Login\n';
        const csvRows = users.map(user => {
            return `"${user.id || ''}","${user.name || ''}","${user.email || ''}","${user.type || 'User'}","${user.status || 'Active'}","${user.createdAt || ''}","${user.lastLogin || 'Never'}"`;
        }).join('\n');
        
        const csvContent = csvHeaders + csvRows;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting users:', error);
        res.status(500).json({ error: 'Failed to export users' });
    }
});

// Add new user manually
router.post('/users', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const newUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: req.body.name,
            email: req.body.email,
            password: req.body.password, // In production, hash this
            type: req.body.type || 'User',
            status: req.body.status || 'Active',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            profile: {
                phone: req.body.phone || '',
                location: req.body.location || '',
                skills: req.body.skills ? req.body.skills.split(',').map(s => s.trim()) : []
            }
        };

        users.push(newUser);
        
        const success = await writeJSONFile('users.json', users);
        if (success) {
            const { password, ...safeUser } = newUser;
            res.json({ success: true, user: safeUser, message: 'User added successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save user' });
        }
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Update user
router.post('/users/update', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const userIndex = users.findIndex(user => user.id === req.body.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user data while preserving password and creation date
        const updatedUser = {
            ...users[userIndex],
            username: req.body.username,
            email: req.body.email,
            userType: req.body.userType,
            status: req.body.status,
            phone: req.body.phone,
            location: req.body.location,
            updatedAt: new Date().toISOString()
        };

        users[userIndex] = updatedUser;
        
        const success = await writeJSONFile('users.json', users);
        if (success) {
            const { password, ...safeUser } = updatedUser;
            res.json({ success: true, user: safeUser, message: 'User updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save user changes' });
        }
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.post('/users/delete', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const userIndex = users.findIndex(user => user.id === req.body.userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove user from array
        const deletedUser = users.splice(userIndex, 1)[0];
        
        const success = await writeJSONFile('users.json', users);
        if (success) {
            res.json({ success: true, message: 'User deleted successfully', deletedUserId: deletedUser.id });
        } else {
            res.status(500).json({ error: 'Failed to delete user' });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        const users = await readJSONFile('users.json');
        const userIndex = users.findIndex(user => user.id === req.params.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user with new data
        users[userIndex] = {
            ...users[userIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        const success = await writeJSONFile('users.json', users);
        if (success) {
            const { password, ...safeUser } = users[userIndex];
            res.json({ success: true, user: safeUser, message: 'User updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update user' });
        }
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Export employers to CSV
router.get('/employers/export', async (req, res) => {
    try {
        const employers = await readJSONFile('employers.json');
        
        // Create CSV content
        const csvHeaders = 'ID,Company Name,Contact Email,Contact Name,Status,Verified,Jobs Posted,Created Date\n';
        const csvRows = employers.map(employer => {
            return `"${employer.id || ''}","${employer.companyName || ''}","${employer.contactEmail || ''}","${employer.contactName || ''}","${employer.status || 'Active'}","${employer.verified || 'No'}","${employer.jobsPosted || '0'}","${employer.createdAt || ''}"`;
        }).join('\n');
        
        const csvContent = csvHeaders + csvRows;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="employers_export.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting employers:', error);
        res.status(500).json({ error: 'Failed to export employers' });
    }
});

// Verify employer company
router.put('/employers/:id/verify', async (req, res) => {
    try {
    const employers = await readJSONFile('employers.json');
    const employerIndex = employers.findIndex(emp => String(emp.id) === String(req.params.id));
        
        if (employerIndex === -1) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        employers[employerIndex].verified = true;
        employers[employerIndex].verifiedAt = new Date().toISOString();
        employers[employerIndex].verifiedBy = 'Admin';

        const success = await writeJSONFile('employers.json', employers);
        if (success) {
            res.json({ success: true, employer: employers[employerIndex], message: 'Company verified successfully' });
        } else {
            res.status(500).json({ error: 'Failed to verify company' });
        }
    } catch (error) {
        console.error('Error verifying employer:', error);
        res.status(500).json({ error: 'Failed to verify company' });
    }
});

// Approve employer application
router.put('/employers/:id/approve', async (req, res) => {
    try {
        const employers = await readJSONFile('employers.json');
    const employerIndex = employers.findIndex(emp => String(emp.id) === String(req.params.id));
        
        if (employerIndex === -1) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        employers[employerIndex].status = 'active';
        employers[employerIndex].approvedAt = new Date().toISOString();
        employers[employerIndex].approvedBy = 'Admin';

        const success = await writeJSONFile('employers.json', employers);
        if (success) {
            res.json({ success: true, employer: employers[employerIndex], message: 'Employer approved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to approve employer' });
        }
    } catch (error) {
        console.error('Error approving employer:', error);
        res.status(500).json({ error: 'Failed to approve employer' });
    }
});

// Deny employer application
router.put('/employers/:id/deny', async (req, res) => {
    try {
        const employers = await readJSONFile('employers.json');
    const employerIndex = employers.findIndex(emp => String(emp.id) === String(req.params.id));
        
        if (employerIndex === -1) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        employers[employerIndex].status = 'denied';
        employers[employerIndex].deniedAt = new Date().toISOString();
        employers[employerIndex].deniedBy = 'Admin';
        employers[employerIndex].deniedReason = req.body.reason || 'Application denied by admin';

        const success = await writeJSONFile('employers.json', employers);
        if (success) {
            res.json({ success: true, employer: employers[employerIndex], message: 'Employer denied successfully' });
        } else {
            res.status(500).json({ error: 'Failed to deny employer' });
        }
    } catch (error) {
        console.error('Error denying employer:', error);
        res.status(500).json({ error: 'Failed to deny employer' });
    }
});

// Update employer
router.put('/employers/:id', async (req, res) => {
    try {
        const employers = await readJSONFile('employers.json');
        const employerIndex = employers.findIndex(emp => emp.id === req.params.id);
        
        if (employerIndex === -1) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        employers[employerIndex] = {
            ...employers[employerIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        const success = await writeJSONFile('employers.json', employers);
        if (success) {
            res.json({ success: true, employer: employers[employerIndex], message: 'Employer updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update employer' });
        }
    } catch (error) {
        console.error('Error updating employer:', error);
        res.status(500).json({ error: 'Failed to update employer' });
    }
});

// Bulk actions for jobs
router.post('/jobs/bulk', async (req, res) => {
    try {
        const { action, jobIds } = req.body;
        const jobs = await readJSONFile('jobs.json');
        
        let updatedJobs = [...jobs];
        let message = '';
        
        switch (action) {
            case 'feature':
                updatedJobs = jobs.map(job => 
                    jobIds.includes(job.id) ? { ...job, featured: true } : job
                );
                message = `${jobIds.length} jobs featured successfully`;
                break;
            case 'unfeature':
                updatedJobs = jobs.map(job => 
                    jobIds.includes(job.id) ? { ...job, featured: false } : job
                );
                message = `${jobIds.length} jobs unfeatured successfully`;
                break;
            case 'delete':
                updatedJobs = jobs.filter(job => !jobIds.includes(job.id));
                message = `${jobIds.length} jobs deleted successfully`;
                break;
            case 'activate':
                updatedJobs = jobs.map(job => 
                    jobIds.includes(job.id) ? { ...job, status: 'active' } : job
                );
                message = `${jobIds.length} jobs activated successfully`;
                break;
            case 'deactivate':
                updatedJobs = jobs.map(job => 
                    jobIds.includes(job.id) ? { ...job, status: 'inactive' } : job
                );
                message = `${jobIds.length} jobs deactivated successfully`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid bulk action' });
        }

        const success = await writeJSONFile('jobs.json', updatedJobs);
        if (success) {
            res.json({ success: true, message });
        } else {
            res.status(500).json({ error: 'Failed to perform bulk action' });
        }
    } catch (error) {
        console.error('Error performing bulk action:', error);
        res.status(500).json({ error: 'Failed to perform bulk action' });
    }
});

// Update application status
router.put('/applications/:id', async (req, res) => {
    try {
        const applications = await readJSONFile('applications.json');
        const appIndex = applications.findIndex(app => app.id === req.params.id);
        
        if (appIndex === -1) {
            return res.status(404).json({ error: 'Application not found' });
        }

        applications[appIndex] = {
            ...applications[appIndex],
            status: req.body.status,
            adminNotes: req.body.adminNotes || '',
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin'
        };

        const success = await writeJSONFile('applications.json', applications);
        if (success) {
            res.json({ success: true, application: applications[appIndex], message: 'Application updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update application' });
        }
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ error: 'Failed to update application' });
    }
});

// Get resume file
router.get('/resumes/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const resumePath = path.join(__dirname, '../uploads/resumes', filename);
        
        // Check if file exists
        try {
            await fs.access(resumePath);
            res.download(resumePath);
        } catch {
            res.status(404).json({ error: 'Resume file not found' });
        }
    } catch (error) {
        console.error('Error downloading resume:', error);
        res.status(500).json({ error: 'Failed to download resume' });
    }
});

// Create new blog post
router.post('/content/blog', async (req, res) => {
    try {
        // Read existing blog posts or create new structure
        let blogPosts = [];
        try {
            blogPosts = await readJSONFile('blog_posts.json');
        } catch {
            // File doesn't exist, start with empty array
        }

        const newPost = {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: req.body.title,
            slug: req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            content: req.body.content,
            excerpt: req.body.excerpt || req.body.content.substring(0, 150) + '...',
            author: 'Admin',
            status: req.body.status || 'published',
            category: req.body.category || 'General',
            tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0
        };

        blogPosts.unshift(newPost);
        
        const success = await writeJSONFile('blog_posts.json', blogPosts);
        if (success) {
            res.json({ success: true, post: newPost, message: 'Blog post created successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save blog post' });
        }
    } catch (error) {
        console.error('Error creating blog post:', error);
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});

// Get blog posts
router.get('/content/blog', async (req, res) => {
    try {
        const blogPosts = await readJSONFile('blog_posts.json');
        res.json({ posts: blogPosts });
    } catch (error) {
        console.error('Error getting blog posts:', error);
        res.json({ posts: [] }); // Return empty array if file doesn't exist
    }
});

// ===============================
// EMAIL MARKETING ENDPOINTS
// ===============================

// Get email list
router.get('/email-list', async (req, res) => {
    try {
        const emailList = await readJSONFile('email_list.json');
        res.json({ success: true, emails: emailList });
    } catch (error) {
        console.error('Error getting email list:', error);
        res.json({ success: true, emails: [] });
    }
});

// Add email to list
router.post('/email-list', async (req, res) => {
    try {
        const { email, name, tags, status } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const emailList = await readJSONFile('email_list.json');
        
        // Check if email already exists
        const existingEmail = emailList.find(item => item.email.toLowerCase() === email.toLowerCase());
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already exists in the list' });
        }

        const newEmailEntry = {
            id: Date.now().toString(),
            email: email.toLowerCase(),
            name: name || '',
            tags: tags || [],
            status: status || 'active',
            addedDate: new Date().toISOString(),
            lastEmailSent: null,
            totalEmailsSent: 0
        };

        emailList.push(newEmailEntry);
        
        const success = await writeJSONFile('email_list.json', emailList);
        if (success) {
            res.json({ success: true, email: newEmailEntry, message: 'Email added successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save email' });
        }
    } catch (error) {
        console.error('Error adding email:', error);
        res.status(500).json({ error: 'Failed to add email' });
    }
});

// Import emails from CSV/file
router.post('/email-list/import', async (req, res) => {
    try {
        const { emails } = req.body; // Array of email objects
        
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'No emails provided for import' });
        }

        const emailList = await readJSONFile('email_list.json');
        const existingEmails = new Set(emailList.map(item => item.email.toLowerCase()));
        
        let addedCount = 0;
        let skippedCount = 0;

        for (const emailData of emails) {
            const email = emailData.email?.toLowerCase();
            if (!email || existingEmails.has(email)) {
                skippedCount++;
                continue;
            }

            const newEmailEntry = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                email: email,
                name: emailData.name || '',
                tags: emailData.tags || [],
                status: 'active',
                addedDate: new Date().toISOString(),
                lastEmailSent: null,
                totalEmailsSent: 0
            };

            emailList.push(newEmailEntry);
            existingEmails.add(email);
            addedCount++;
        }
        
        const success = await writeJSONFile('email_list.json', emailList);
        if (success) {
            res.json({ 
                success: true, 
                message: `Import completed: ${addedCount} emails added, ${skippedCount} skipped (duplicates)`,
                added: addedCount,
                skipped: skippedCount
            });
        } else {
            res.status(500).json({ error: 'Failed to save imported emails' });
        }
    } catch (error) {
        console.error('Error importing emails:', error);
        res.status(500).json({ error: 'Failed to import emails' });
    }
});

// Update email status
router.put('/email-list/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, name, tags } = req.body;
        
        const emailList = await readJSONFile('email_list.json');
        const emailIndex = emailList.findIndex(item => item.id === id);
        
        if (emailIndex === -1) {
            return res.status(404).json({ error: 'Email not found' });
        }

        if (status) emailList[emailIndex].status = status;
        if (name !== undefined) emailList[emailIndex].name = name;
        if (tags !== undefined) emailList[emailIndex].tags = tags;

        const success = await writeJSONFile('email_list.json', emailList);
        if (success) {
            res.json({ success: true, email: emailList[emailIndex], message: 'Email updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update email' });
        }
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// Update email (POST endpoint for frontend compatibility)
router.post('/email-list/update', async (req, res) => {
    try {
        const { id, email, name, tags, status } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Email ID is required' });
        }
        
        const emailList = await readJSONFile('email_list.json');
        const emailIndex = emailList.findIndex(item => item.id === id);
        
        if (emailIndex === -1) {
            return res.status(404).json({ error: 'Email not found' });
        }

        // Update all provided fields
        if (email !== undefined) emailList[emailIndex].email = email;
        if (name !== undefined) emailList[emailIndex].name = name;
        if (tags !== undefined) emailList[emailIndex].tags = Array.isArray(tags) ? tags : [];
        if (status !== undefined) emailList[emailIndex].status = status;
        
        // Add update timestamp
        emailList[emailIndex].updatedDate = new Date().toISOString();

        const success = await writeJSONFile('email_list.json', emailList);
        if (success) {
            res.json({ success: true, email: emailList[emailIndex], message: 'Email updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update email' });
        }
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// Delete email from list
router.delete('/email-list/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const emailList = await readJSONFile('email_list.json');
        const emailIndex = emailList.findIndex(item => item.id === id);
        
        if (emailIndex === -1) {
            return res.status(404).json({ error: 'Email not found' });
        }

        emailList.splice(emailIndex, 1);

        const success = await writeJSONFile('email_list.json', emailList);
        if (success) {
            res.json({ success: true, message: 'Email deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete email' });
        }
    } catch (error) {
        console.error('Error deleting email:', error);
        res.status(500).json({ error: 'Failed to delete email' });
    }
});

// Send job marketing emails
router.post('/send-job-emails', async (req, res) => {
    try {
        const { jobIds, emailIds, subject, customMessage } = req.body;
        
        if (!jobIds || !emailIds || jobIds.length === 0 || emailIds.length === 0) {
            return res.status(400).json({ error: 'Job IDs and email IDs are required' });
        }

        // Get jobs data
        const jobs = await readJSONFile('jobs.json');
        const selectedJobs = jobs.filter(job => jobIds.includes(job.id));

        // Get email list
        const emailList = await readJSONFile('email_list.json');
        const selectedEmails = emailList.filter(email => emailIds.includes(email.id) && email.status === 'active');

        if (selectedJobs.length === 0) {
            return res.status(400).json({ error: 'No valid jobs found' });
        }

        if (selectedEmails.length === 0) {
            return res.status(400).json({ error: 'No valid email recipients found' });
        }

        // Generate email HTML
        const emailHTML = generateJobEmailHTML(selectedJobs, customMessage);
        const emailSubject = subject || `New Job Opportunities - ${selectedJobs.length} Positions Available`;

        // Import email service
        const { sendJobMarketingEmail } = require('../services/emailService');

        let sentCount = 0;
        let errorCount = 0;
        const currentTime = new Date().toISOString();
        const errors = [];

        // Send emails to each recipient
        for (const email of selectedEmails) {
            try {
                await sendJobMarketingEmail({
                    to: email.email,
                    subject: emailSubject,
                    html: emailHTML,
                    text: `New Job Opportunities from TalentSync\n\n${selectedJobs.map(job => 
                        `${job.title} at ${job.company}\nLocation: ${job.location}\nApply: https://talentsync.shop/jobs`
                    ).join('\n\n')}`
                });

                // Update email tracking on successful send
                const emailIndex = emailList.findIndex(item => item.id === email.id);
                if (emailIndex !== -1) {
                    emailList[emailIndex].lastEmailSent = currentTime;
                    emailList[emailIndex].totalEmailsSent = (emailList[emailIndex].totalEmailsSent || 0) + 1;
                }
                
                sentCount++;
                console.log(`✅ Email sent successfully to: ${email.email}`);
                
            } catch (error) {
                errorCount++;
                errors.push({ email: email.email, error: error.message });
                console.error(`❌ Failed to send email to ${email.email}:`, error.message);
            }
        }

        // Save updated email list
        await writeJSONFile('email_list.json', emailList);

        // Log the email campaign
        console.log(`📧 Email Campaign Completed:
        - Subject: ${emailSubject}
        - Successful sends: ${sentCount}
        - Failed sends: ${errorCount}
        - Jobs: ${selectedJobs.map(j => j.title).join(', ')}
        - Time: ${currentTime}`);

        if (errors.length > 0) {
            console.log('❌ Email sending errors:', errors);
        }

        res.json({ 
            success: sentCount > 0, 
            message: sentCount > 0 
                ? `Email campaign sent successfully to ${sentCount} recipients${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
                : 'Failed to send emails to any recipients',
            sentCount: sentCount,
            errorCount: errorCount,
            errors: errors.length > 0 ? errors : undefined,
            jobs: selectedJobs.length,
            preview: emailHTML // Return preview for testing
        });

    } catch (error) {
        console.error('Error sending job emails:', error);
        res.status(500).json({ error: 'Failed to send email campaign' });
    }
});

// Helper function to generate job email HTML
function generateJobEmailHTML(jobs, customMessage) {
    const jobsHTML = jobs.map(job => `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #ffffff;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0;">${job.title}</h3>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Company:</strong> ${job.company}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Location:</strong> ${job.location}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Type:</strong> ${job.job_type}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Salary:</strong> ${job.salary}</p>
            <p style="color: #374151; margin: 15px 0;">${job.description}</p>
            ${job.url ? `<a href="${job.url}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Apply Now</a>` : ''}
        </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>New Job Opportunities</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 10px;">
            <h1 style="color: #1f2937; text-align: center;">🚀 New Job Opportunities</h1>
            
            ${customMessage ? `<div style="background-color: #e0f2fe; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 0; color: #0277bd;">${customMessage}</p>
            </div>` : ''}
            
            <p>We found some exciting job opportunities that might interest you:</p>
            
            ${jobsHTML}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    Visit our <a href="https://talentsync.shop" style="color: #3b82f6;">job board</a> for more opportunities!
                </p>
                <p style="color: #9ca3af; font-size: 12px;">
                    You received this email because you subscribed to our job alerts from TalentSync. 
                    <br>Questions? Contact us at <a href="mailto:talentsync@talentsync.shop" style="color: #3b82f6;">talentsync@talentsync.shop</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;
router.post('/scrape-job-url', async (req, res) => {
    try {
        console.log('Received scrape request:', req.body);
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL and determine job site
        const jobSite = detectJobSite(url);
        console.log('Detected job site:', jobSite);
        
        if (!jobSite) {
            return res.status(400).json({ error: 'Unsupported job site. Please use LinkedIn, Indeed, or ZipRecruiter URLs.' });
        }

        console.log(`Scraping ${jobSite} job from: ${url}`);

        // For demo purposes, let's create sample data for now to test the form filling
        // In production, this would fetch and parse the actual webpage
        const jobDetails = createSampleJobDetails(jobSite, url);
        
        console.log('Extracted job details:', jobDetails);

        res.json({
            success: true,
            jobDetails: jobDetails,
            source: jobSite,
            originalUrl: url
        });

    } catch (error) {
        console.error('Error scraping job URL:', error);
        res.status(500).json({ 
            error: 'Failed to scrape job details. Please try again or fill the form manually.',
            details: error.message 
        });
    }
});

// Helper function to detect job site
function detectJobSite(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('linkedin.com')) {
        return 'LinkedIn';
    } else if (urlLower.includes('indeed.com')) {
        return 'Indeed';
    } else if (urlLower.includes('ziprecruiter.com')) {
        return 'ZipRecruiter';
    }
    
    return null;
}

// Create sample job details for testing (will be replaced with actual scraping)
function createSampleJobDetails(jobSite, url) {
    const sampleData = {
        LinkedIn: {
            title: 'Senior Software Engineer',
            company: 'TechCorp Inc.',
            location: 'New York, NY',
            description: 'We are looking for a Senior Software Engineer to join our growing team. You will be responsible for designing and developing scalable web applications using modern technologies.',
            salary: '$120,000 - $150,000',
            job_type: 'Full-time',
            remote: true,
            category: 'Technology',
            experience_level: 'Senior Level',
            skills: 'JavaScript, React, Node.js, Python, AWS',
            application_url: url,
            application_email: 'careers@techcorp.com'
        },
        Indeed: {
            title: 'Marketing Manager',
            company: 'Growth Ventures LLC',
            location: 'San Francisco, CA',
            description: 'Join our marketing team as a Marketing Manager. You will lead digital marketing campaigns, analyze market trends, and drive customer acquisition strategies.',
            salary: '$80,000 - $100,000',
            job_type: 'Full-time',
            remote: false,
            category: 'Marketing',
            experience_level: 'Mid Level',
            skills: 'Digital Marketing, Analytics, SEO, Content Marketing',
            application_url: url,
            application_email: 'hr@growthventures.com'
        },
        ZipRecruiter: {
            title: 'Data Analyst',
            company: 'Analytics Pro',
            location: 'Chicago, IL',
            description: 'We are seeking a Data Analyst to help us make data-driven decisions. You will work with large datasets, create visualizations, and provide insights to stakeholders.',
            salary: '$65,000 - $85,000',
            job_type: 'Full-time',
            remote: true,
            category: 'Analytics',
            experience_level: 'Entry Level',
            skills: 'SQL, Python, Tableau, Excel, Statistics',
            application_url: url,
            application_email: 'jobs@analyticspro.com'
        }
    };

    return sampleData[jobSite] || sampleData.LinkedIn;
}

// Helper function to fetch webpage content
function fetchWebpage(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        const req = client.get(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });
    });
}

// Helper function to extract job details based on job site
async function extractJobDetails(html, jobSite, url) {
    const jobDetails = {
        title: '',
        company: '',
        location: '',
        description: '',
        salary: '',
        job_type: 'Full-time',
        remote: false,
        category: 'General',
        experience_level: 'Mid Level',
        skills: '',
        application_url: url,
        application_email: ''
    };

    try {
        switch (jobSite) {
            case 'LinkedIn':
                return extractLinkedInJobDetails(html, jobDetails);
            case 'Indeed':
                return extractIndeedJobDetails(html, jobDetails);
            case 'ZipRecruiter':
                return extractZipRecruiterJobDetails(html, jobDetails);
            default:
                return jobDetails;
        }
    } catch (error) {
        console.error(`Error extracting ${jobSite} job details:`, error);
        return jobDetails;
    }
}

// Extract LinkedIn job details
function extractLinkedInJobDetails(html, jobDetails) {
    // LinkedIn job title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*job-details-jobs-unified-top-card__job-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+job[^<]*)<\/h1>/i) ||
                     html.match(/<title>([^|]+)\s*\|/i);
    if (titleMatch) {
        jobDetails.title = cleanText(titleMatch[1]);
    }

    // LinkedIn company
    const companyMatch = html.match(/<span[^>]*class="[^"]*job-details-jobs-unified-top-card__company-name[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                        html.match(/<a[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (companyMatch) {
        jobDetails.company = cleanText(companyMatch[1]);
    }

    // LinkedIn location
    const locationMatch = html.match(/<span[^>]*class="[^"]*job-details-jobs-unified-top-card__bullet[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                         html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (locationMatch) {
        jobDetails.location = cleanText(locationMatch[1]);
    }

    // LinkedIn description
    const descMatch = html.match(/<div[^>]*class="[^"]*job-details-jobs-unified-top-card__job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                     html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
        jobDetails.description = cleanText(descMatch[1]).substring(0, 500);
    }

    // Detect job type
    const jobTypeText = html.toLowerCase();
    if (jobTypeText.includes('part-time') || jobTypeText.includes('part time')) {
        jobDetails.job_type = 'Part-time';
    } else if (jobTypeText.includes('contract') || jobTypeText.includes('freelance')) {
        jobDetails.job_type = 'Contract';
    } else if (jobTypeText.includes('internship')) {
        jobDetails.job_type = 'Internship';
    }

    // Detect remote work
    if (jobTypeText.includes('remote') || jobTypeText.includes('work from home')) {
        jobDetails.remote = true;
    }

    return jobDetails;
}

// Extract Indeed job details
function extractIndeedJobDetails(html, jobDetails) {
    // Indeed job title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*jobsearch-JobInfoHeader-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^|]+)\s*-/i);
    if (titleMatch) {
        jobDetails.title = cleanText(titleMatch[1]);
    }

    // Indeed company
    const companyMatch = html.match(/<div[^>]*class="[^"]*jobsearch-InlineCompanyRating[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
                        html.match(/<span[^>]*class="[^"]*jobsearch-JobInfoHeader-subtitle[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (companyMatch) {
        jobDetails.company = cleanText(companyMatch[1]);
    }

    // Indeed location
    const locationMatch = html.match(/<div[^>]*class="[^"]*jobsearch-JobInfoHeader-subtitle[^"]*"[^>]*>[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) ||
                         html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (locationMatch) {
        jobDetails.location = cleanText(locationMatch[1]);
    }

    // Indeed description
    const descMatch = html.match(/<div[^>]*class="[^"]*jobsearch-jobDescriptionText[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
        jobDetails.description = cleanText(descMatch[1]).substring(0, 500);
    }

    // Indeed salary
    const salaryMatch = html.match(/<span[^>]*class="[^"]*salary[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/\$[\d,]+ - \$[\d,]+/i);
    if (salaryMatch) {
        jobDetails.salary = cleanText(salaryMatch[1]);
    }

    // Detect job type and remote
    const jobTypeText = html.toLowerCase();
    if (jobTypeText.includes('part-time')) {
        jobDetails.job_type = 'Part-time';
    } else if (jobTypeText.includes('contract')) {
        jobDetails.job_type = 'Contract';
    } else if (jobTypeText.includes('temporary')) {
        jobDetails.job_type = 'Temporary';
    }

    if (jobTypeText.includes('remote')) {
        jobDetails.remote = true;
    }

    return jobDetails;
}

// Extract ZipRecruiter job details
function extractZipRecruiterJobDetails(html, jobDetails) {
    // ZipRecruiter job title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*job_title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^|]+)\s*\|/i);
    if (titleMatch) {
        jobDetails.title = cleanText(titleMatch[1]);
    }

    // ZipRecruiter company
    const companyMatch = html.match(/<a[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                        html.match(/<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (companyMatch) {
        jobDetails.company = cleanText(companyMatch[1]);
    }

    // ZipRecruiter location
    const locationMatch = html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (locationMatch) {
        jobDetails.location = cleanText(locationMatch[1]);
    }

    // ZipRecruiter description
    const descMatch = html.match(/<div[^>]*class="[^"]*job_description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
        jobDetails.description = cleanText(descMatch[1]).substring(0, 500);
    }

    // ZipRecruiter salary
    const salaryMatch = html.match(/<div[^>]*class="[^"]*salary[^"]*"[^>]*>([^<]+)<\/div>/i);
    if (salaryMatch) {
        jobDetails.salary = cleanText(salaryMatch[1]);
    }

    return jobDetails;
}

// Helper function to clean extracted text
function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&amp;/g, '&') // Replace &amp; with &
        .replace(/&lt;/g, '<') // Replace &lt; with <
        .replace(/&gt;/g, '>') // Replace &gt; with >
        .replace(/&quot;/g, '"') // Replace &quot; with "
        .replace(/&#39;/g, "'") // Replace &#39; with '
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing whitespace
}

// 🚀 AUTO EMAIL CAMPAIGN API ENDPOINTS

// Get auto campaign statistics
router.get('/auto-campaign-stats', async (req, res) => {
    try {
        const [emailList, campaigns] = await Promise.all([
            readJSONFile('email_list.json'),
            readJSONFile('email_campaigns.json')
        ]);
        
        // Filter auto campaigns
        const autoCampaigns = campaigns.filter(c => c.type === 'auto_job_alert');
        
        // Calculate stats
        const stats = {
            totalCampaigns: autoCampaigns.length,
            totalJobs: autoCampaigns.length, // Each campaign = 1 job
            subscribers: emailList.length,
            totalEmailsSent: autoCampaigns.reduce((sum, c) => sum + (c.sentTo || 0), 0),
            recentCampaigns: autoCampaigns.slice(0, 10) // Last 10 campaigns
        };
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error getting auto campaign stats:', error);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// Save auto email settings
router.post('/email-settings', async (req, res) => {
    try {
        const { autoEmailEnabled } = req.body;
        
        // For now, we'll just acknowledge the setting
        // In production, you might want to save this to a settings file
        console.log(`Auto email campaigns ${autoEmailEnabled ? 'enabled' : 'disabled'}`);
        
        res.json({ success: true, message: 'Setting saved' });
    } catch (error) {
        console.error('Error saving email settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Test auto email campaign (for testing without posting real job)
router.post('/test-auto-campaign', async (req, res) => {
    try {
        const testJob = {
            id: 'test_' + Date.now(),
            title: 'Test Job Position',
            company: 'Test Company',
            location: 'Remote',
            description: 'This is a test job to verify the auto email campaign system is working correctly.',
            job_type: 'Full-time',
            salary: '$50,000 - $70,000',
            url: 'https://talentsync.shop/jobs.html',
            entry_level: true,
            remote: true
        };
        
        const result = await sendNewJobEmailCampaign(testJob);
        
        res.json({ 
            success: true, 
            message: 'Test campaign sent successfully!', 
            result 
        });
    } catch (error) {
        console.error('Error sending test campaign:', error);
        res.status(500).json({ error: 'Failed to send test campaign' });
    }
});

module.exports = router;
