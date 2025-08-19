// Load environment variables
require('dotenv').config();

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');

// Import and configure passport
require('./Config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable compression
app.use(compression());

// Trust proxy in production so secure cookies work behind HTTPS proxies (Railway/Heroku)
if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    // trust first proxy
    app.set('trust proxy', 1);
}

// Cookie parser
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import auth middleware and routes
const { redirectIfAuthenticated, authenticateToken } = require('./middleware/auth-json'); // Use JSON-based auth middleware
const trackPageView = require('./middleware/analytics');
const authRoutes = require('./routes/auth-json'); // Use JSON-based auth instead of MySQL
const adminDataRoutes = require('./routes/admin-data');
const resumeUploadRoutes = require('./routes/resume-upload');

// Add analytics tracking middleware (before routes)
app.use(trackPageView);

// Mount auth routes
app.use('/auth', authRoutes);

// Mount admin data API routes
app.use('/api/admin', adminDataRoutes);

// Mount resume upload routes
app.use('/api', resumeUploadRoutes);

// API routes FIRST (before static files)
app.get('/api/fresh', (req, res) => {
    try {
        const jobsPath = path.join(__dirname, 'data', 'jobs.json');
        const scrapedPath = path.join(__dirname, 'data', 'scraped_jobs.json');
    const includeScraped = (req.query.includeScraped || '').toString().toLowerCase() === 'true';

        let manualJobs = [];
        let scrapedJobs = [];

        // Load manual/admin jobs
    if (fs.existsSync(jobsPath)) {
            try {
                const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8')) || [];
                manualJobs = jobs
                    .filter(j => (j.status || 'active') === 'active')
                    .map(j => ({
                        // Preserve existing fields, normalize some keys
                        ...j,
            // Normalize application URL so frontend can use job.url consistently
            url: j.url || j.apply_url || j.applyUrl || j.applyLink || j.application_url || j.apply || j.link || '',
                        job_type: j.job_type || j.type || 'Full-time',
                        posted_date: j.posted_date || j.datePosted || new Date().toISOString(),
                        source: j.source || 'Manual'
                    }));
            } catch (e) {
                console.error('Failed to parse jobs.json:', e);
            }
        }

        // Load scraped jobs (LinkedIn/ZipRecruiter/etc.)
    if (fs.existsSync(scrapedPath)) {
            try {
                const scraped = JSON.parse(fs.readFileSync(scrapedPath, 'utf8')) || [];
                scrapedJobs = scraped.map(j => ({
                    ...j,
                    status: j.status || 'active',
            url: j.url || j.apply_url || j.link || '',
                    job_type: j.job_type || j.type || 'Full-time',
                    posted_date: j.posted_date || j.datePosted || j.posted_date || new Date().toISOString(),
                })).filter(j => j.status === 'active');
            } catch (e) {
                console.error('Failed to parse scraped_jobs.json:', e);
            }
        }

    // Combine jobs based on flag (default: manual only)
    const combined = includeScraped ? [...scrapedJobs, ...manualJobs] : manualJobs;

        // Build source counts
        const countBy = (pred) => combined.filter(pred).length;
        const sources = {
            linkedin: countBy(j => (j.source || '').toLowerCase().includes('linkedin')),
            ziprecruiter: countBy(j => (j.source || '').toLowerCase().includes('ziprecruiter')),
            indeed: countBy(j => (j.source || '').toLowerCase().includes('indeed')),
            glassdoor: countBy(j => (j.source || '').toLowerCase().includes('glassdoor')),
            manual: countBy(j => (j.source || '').toLowerCase().includes('manual')),
            total: combined.length
        };

    res.json({
            success: true,
            jobs: combined,
            sources
        });
    } catch (error) {
        console.error('Error reading jobs:', error);
        res.json({ success: false, jobs: [], sources: { total: 0 } });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const scrapedJobsPath = path.join(__dirname, 'data', 'scraped_jobs.json');
        if (fs.existsSync(scrapedJobsPath)) {
            const jobs = JSON.parse(fs.readFileSync(scrapedJobsPath, 'utf8'));
            const stats = {
                total: jobs.length,
                linkedin: jobs.filter(j => j.source === 'LinkedIn').length,
                indeed: jobs.filter(j => j.source === 'Indeed').length,
                ziprecruiter: jobs.filter(j => j.source === 'ZipRecruiter').length,
                google: jobs.filter(j => j.source === 'Google Jobs').length
            };
            res.json(stats);
        } else {
            res.json({ total: 0, linkedin: 0, indeed: 0, ziprecruiter: 0, google: 0 });
        }
    } catch (error) {
        console.error('Error getting stats:', error);
        res.json({ total: 0, linkedin: 0, indeed: 0, ziprecruiter: 0, google: 0 });
    }
});

// Page routes BEFORE static files
app.get('/jobs', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobs.html'));
});

app.get('/employers', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'employers.html'));
});

app.get('/post-job', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'employers.html'));
});

app.get('/blog', (req, res) => {
    console.log('📝 Blog route accessed from:', req.get('User-Agent'));
    console.log('📝 Referer:', req.get('Referer'));
    console.log('📝 Full URL:', req.url);
    try {
        const blogPath = path.join(__dirname, 'Public', 'blog.html');
        console.log('📝 Serving blog from:', blogPath);
        res.sendFile(blogPath);
    } catch (error) {
        console.error('❌ Blog route error:', error);
        res.status(500).send('Blog page error: ' + error.message);
    }
});

app.get('/login', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'login.html'));
});

app.get('/register', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'register.html'));
});

// '/post-job' handled above

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'terms.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'contact.html'));
});

app.get('/resumes', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'resumes.html'));
});

app.get('/dashboard', (req, res) => {
    // No unified dashboard file; send users to login which will route them appropriately
    res.redirect('/login');
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'reset-password.html'));
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'forgot-password.html'));
});

app.get('/careers', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'careers.html'));
});

// Employer dashboard
app.get('/employer/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'employer', 'dashboard.html'));
});

// Jobseeker dashboard  
app.get('/jobseeker/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobseeker', 'dashboard.html'));
});

// Authentication status check routes
// Check if user is authenticated - returns user info if logged in
app.get('/api/auth/status', authenticateToken, (req, res) => {
    res.json({ 
        authenticated: true, 
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            userType: req.user.user_type
        }
    });
});

// Optional endpoint for checking auth status without requiring authentication
app.get('/api/auth/check', (req, res) => {
    // Try to get token from Authorization header first, then from cookies
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    if (!token && req.cookies) {
        token = req.cookies.authToken;
    }

    if (!token) {
        return res.json({ authenticated: false });
    }

    try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Basic check - we could also verify user exists in JSON file here
        res.json({ 
            authenticated: true,
            userId: decoded.userId
        });
    } catch (error) {
        res.json({ authenticated: false });
    }
});

// Public: list uploaded resumes (sanitized) for search page
app.get('/api/resumes', (req, res) => {
    try {
        const resumesPath = path.join(__dirname, 'data', 'resumes.json');
        if (!fs.existsSync(resumesPath)) {
            return res.json({ success: true, resumes: [] });
        }

        const resumes = JSON.parse(fs.readFileSync(resumesPath, 'utf8'));

        // Map to a safe, searchable shape; include a file URL for preview/download
        const result = resumes
            .filter(r => r && r.status !== 'rejected')
            .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
            .map(r => ({
                id: r.id,
                name: r.fullName,
                position: r.position || '',
                experience: r.experience || '',
                uploadDate: r.uploadDate,
                fileName: r.fileName,
                originalName: r.originalName,
                fileUrl: r.fileName ? `/uploads/resumes/${encodeURIComponent(r.fileName)}` : null
            }));

        res.json({ success: true, resumes: result });
    } catch (err) {
        console.error('Error listing resumes:', err);
        res.status(500).json({ success: false, resumes: [], message: 'Server error' });
    }
});

// Serve static files AFTER routes
app.use(express.static(path.join(__dirname, 'Public'), {
    caseSensitive: false,
    dotfiles: 'deny'
}));

// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, 'Public/admin'), {
    caseSensitive: false,
    dotfiles: 'deny'
}));

// Serve uploaded files (resumes, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    caseSensitive: false,
    dotfiles: 'deny'
}));

// Auth routes are handled via routes/auth-json.js mounted at /auth

// Forgot password route
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        const user = users.find(u => u.email === email);
        
        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }
        
        // Generate a temporary reset token (valid for 1 hour)
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const resetExpiry = Date.now() + 3600000; // 1 hour from now
        
        // Update user with reset token
        user.resetToken = resetToken;
        user.resetExpiry = resetExpiry;
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        // Send password reset email
        try {
            const { sendAccountEmail } = require('./services/emailService');
            const resetLink = `https://talentsync.shop/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
            
            await sendAccountEmail({
                to: email,
                subject: 'TalentSync - Password Reset Request',
                text: `Hello,\n\nYou requested a password reset for your TalentSync account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nTalentSync Team`,
                html: `
                    <h2>Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>You requested a password reset for your TalentSync account.</p>
                    <p><a href="${resetLink}" style="background: #8b5cf6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Your Password</a></p>
                    <p><small>This link will expire in 1 hour.</small></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <br>
                    <p>Best regards,<br>TalentSync Team</p>
                `
            });
            console.log('📧 Password reset email sent to:', email);
        } catch (emailError) {
            console.error('❌ Failed to send password reset email:', emailError.message);
            return res.status(500).json({
                success: false,
                message: 'Unable to send password reset email. Please try again later.'
            });
        }
        
        res.json({
            success: true,
            message: 'Password reset link has been sent to your email address.'
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

// Reset password route
app.post('/auth/reset-password', async (req, res) => {
    const { token, email, newPassword } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        const user = users.find(u => u.email === email && u.resetToken === token);
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token.'
            });
        }
        
        // Check if token is expired
        if (!user.resetExpiry || Date.now() > user.resetExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired. Please request a new one.'
            });
        }
        
        // Hash new password
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user password and remove reset token
        user.password = hashedPassword;
        delete user.resetToken;
        delete user.resetExpiry;
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        res.json({
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads', 'resumes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only PDF, DOC, and DOCX files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/msword' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// API Routes for Dashboard Functionality

// Career application endpoint
app.post('/api/careers/apply', upload.single('resume'), async (req, res) => {
    try {
        const {
            firstName, lastName, email, phone, location, timezone,
            position, experience, skills, linkedIn, portfolio,
            salary, availability, coverLetter
        } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Resume file is required' });
        }

        // Validate required fields
        const requiredFields = { firstName, lastName, email, location, timezone, position, experience, skills, availability, coverLetter };
        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value || !value.trim()) {
                return res.status(400).json({ success: false, message: `${field} is required` });
            }
        }

        // Create career application object
        const careerApplication = {
            id: Date.now(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || '',
            location: location.trim(),
            timezone: timezone.trim(),
            position: position.trim(),
            experience: experience.trim(),
            skills: skills.trim(),
            linkedIn: linkedIn?.trim() || '',
            portfolio: portfolio?.trim() || '',
            salary: salary?.trim() || '',
            availability: availability.trim(),
            coverLetter: coverLetter.trim(),
            resumePath: path.relative(__dirname, req.file.path),
            resumeOriginalName: req.file.originalname,
            appliedAt: new Date().toISOString(),
            status: 'pending',
            reviewed: false
        };

        // Save to career applications file
        const careerApplicationsPath = path.join(__dirname, 'data', 'career_applications.json');
        let careerApplications = [];
        
        if (fs.existsSync(careerApplicationsPath)) {
            careerApplications = JSON.parse(fs.readFileSync(careerApplicationsPath, 'utf8'));
        }

        careerApplications.push(careerApplication);
        fs.writeFileSync(careerApplicationsPath, JSON.stringify(careerApplications, null, 2));

        // Send email notification
        try {
            const emailService = require('./services/emailService');
            
            const emailContent = `
                <h2>New Career Application Received</h2>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Timezone:</strong> ${timezone}</p>
                <p><strong>Position:</strong> ${position}</p>
                <p><strong>Experience:</strong> ${experience}</p>
                <p><strong>Skills:</strong> ${skills}</p>
                <p><strong>LinkedIn:</strong> ${linkedIn || 'Not provided'}</p>
                <p><strong>Portfolio:</strong> ${portfolio || 'Not provided'}</p>
                <p><strong>Expected Salary:</strong> ${salary || 'Not specified'}</p>
                <p><strong>Availability:</strong> ${availability}</p>
                <p><strong>Cover Letter:</strong></p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${coverLetter.replace(/\n/g, '<br>')}
                </div>
                <p><strong>Resume:</strong> ${req.file.originalname} (saved on server)</p>
                <p><strong>Application ID:</strong> ${careerApplication.id}</p>
                <p><strong>Applied:</strong> ${new Date().toLocaleString()}</p>
                
                <p style="margin-top: 20px;">
                    <a href="https://talentsync.shop/admin/dashboard.html" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        View in Admin Dashboard
                    </a>
                </p>
            `;

            await emailService.sendJobMarketingEmail({
                to: process.env.ADMIN_NOTIFY_EMAIL || 'talentsync@talentsync.shop',
                subject: `New Career Application - ${position}`,
                text: `New application from ${firstName} ${lastName} for ${position}.`,
                html: emailContent
            });

            console.log('✅ Career application email sent successfully');
        } catch (emailError) {
            console.error('❌ Failed to send career application email:', emailError);
            // Don't fail the whole request if email fails
        }

        res.json({
            success: true,
            message: 'Application submitted successfully',
            applicationId: careerApplication.id
        });

    } catch (error) {
        console.error('Career application error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// Simple email debug endpoint (GET /api/debug/email?to=you@example.com)
app.get('/api/debug/email', async (req, res) => {
    try {
        const { sendAccountEmail, isEmailConfigured } = require('./services/emailService');
        if (!isEmailConfigured()) {
            return res.status(400).json({ success: false, message: 'Email not configured. Set EMAIL_USER and EMAIL_PASS (or SMTP_HOST, SMTP_PORT, SMTP_SECURE).' });
        }
        const to = (req.query.to || process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || '').toString();
        if (!to) return res.status(400).json({ success: false, message: 'Provide ?to=email@example.com' });
        await sendAccountEmail({
            to,
            subject: 'TalentSync test email',
            text: 'This is a test email from TalentSync.',
            html: '<p>This is a <strong>test</strong> email from TalentSync.</p>'
        });
        res.json({ success: true, message: 'Test email sent', to });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Email config status (no secrets)
app.get('/api/debug/email-status', (req, res) => {
    try {
        const { getEmailStatus } = require('./services/emailService');
        return res.json({ success: true, ...getEmailStatus() });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

// Get career applications for admin
app.get('/api/admin/career-applications', (req, res) => {
    try {
        const careerApplicationsPath = path.join(__dirname, 'data', 'career_applications.json');
        let careerApplications = [];
        
        if (fs.existsSync(careerApplicationsPath)) {
            careerApplications = JSON.parse(fs.readFileSync(careerApplicationsPath, 'utf8'));
        }

        // Sort by most recent first
        careerApplications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

        res.json({ success: true, applications: careerApplications });
    } catch (error) {
        console.error('Get career applications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update career application status
app.put('/api/admin/career-applications/:id', (req, res) => {
    try {
        const applicationId = req.params.id;
        const { status, notes } = req.body;

        const careerApplicationsPath = path.join(__dirname, 'data', 'career_applications.json');
        
        if (!fs.existsSync(careerApplicationsPath)) {
            return res.status(404).json({ success: false, message: 'No applications found' });
        }

        let careerApplications = JSON.parse(fs.readFileSync(careerApplicationsPath, 'utf8'));
        const applicationIndex = careerApplications.findIndex(app => app.id.toString() === applicationId);

        if (applicationIndex === -1) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Update application
        careerApplications[applicationIndex] = {
            ...careerApplications[applicationIndex],
            status: status || careerApplications[applicationIndex].status,
            notes: notes || careerApplications[applicationIndex].notes,
            reviewed: true,
            reviewedAt: new Date().toISOString()
        };

        fs.writeFileSync(careerApplicationsPath, JSON.stringify(careerApplications, null, 2));

        res.json({ success: true, application: careerApplications[applicationIndex] });
    } catch (error) {
        console.error('Update career application error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user profile
app.get('/api/profile/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const usersPath = path.join(__dirname, 'data', 'users.json');
        
        if (!fs.existsSync(usersPath)) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => u.id.toString() === userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Don't send password
        const { password, ...userProfile } = user;
        res.json({ success: true, profile: userProfile });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user profile
app.put('/api/profile/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const { name, email, phone, location, skills, bio } = req.body;
        const usersPath = path.join(__dirname, 'data', 'users.json');
        
        if (!fs.existsSync(usersPath)) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userIndex = users.findIndex(u => u.id.toString() === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Update user data
        users[userIndex] = {
            ...users[userIndex],
            name: name || users[userIndex].name,
            email: email || users[userIndex].email,
            phone: phone || users[userIndex].phone,
            location: location || users[userIndex].location,
            skills: skills || users[userIndex].skills,
            bio: bio || users[userIndex].bio,
            updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        // Don't send password back
        const { password, ...updatedProfile } = users[userIndex];
        res.json({ success: true, profile: updatedProfile });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Upload resume
app.post('/api/resume/upload/:userId', authenticateToken, upload.single('resume'), (req, res) => {
    try {
        const userId = req.params.userId;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        const usersPath = path.join(__dirname, 'data', 'users.json');
        
        if (!fs.existsSync(usersPath)) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userIndex = users.findIndex(u => u.id.toString() === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Delete old resume if exists
        if (users[userIndex].resumePath) {
            const oldResumePath = path.join(__dirname, users[userIndex].resumePath);
            if (fs.existsSync(oldResumePath)) {
                fs.unlinkSync(oldResumePath);
            }
        }
        
        // Update user with new resume info
        const resumePath = path.relative(__dirname, req.file.path);
        users[userIndex].resumePath = resumePath;
        users[userIndex].resumeOriginalName = req.file.originalname;
        users[userIndex].resumeUploadDate = new Date().toISOString();
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Resume uploaded successfully',
            resumeInfo: {
                originalName: req.file.originalname,
                uploadDate: users[userIndex].resumeUploadDate
            }
        });
        
    } catch (error) {
        console.error('Resume upload error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user applications
app.get('/api/applications/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const applicationsPath = path.join(__dirname, 'data', 'applications.json');
        
        let applications = [];
        if (fs.existsSync(applicationsPath)) {
            applications = JSON.parse(fs.readFileSync(applicationsPath, 'utf8'));
        }
        
        const userApplications = applications.filter(app => app.userId.toString() === userId);
        res.json({ success: true, applications: userApplications });
        
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Apply for a job
app.post('/api/jobs/:jobId/apply', (req, res) => {
    try {
        const jobId = req.params.jobId;
        const { userId, coverLetter } = req.body;
        
        const applicationsPath = path.join(__dirname, 'data', 'applications.json');
        let applications = [];
        
        if (fs.existsSync(applicationsPath)) {
            applications = JSON.parse(fs.readFileSync(applicationsPath, 'utf8'));
        }
        
        // Check if user already applied for this job
        const existingApplication = applications.find(app => 
            app.userId.toString() === userId && app.jobId.toString() === jobId
        );
        
        if (existingApplication) {
            return res.status(400).json({ success: false, message: 'You have already applied for this job' });
        }
        
        // Create new application
        const newApplication = {
            id: Date.now(),
            userId: parseInt(userId),
            jobId: parseInt(jobId),
            coverLetter: coverLetter || '',
            appliedAt: new Date().toISOString(),
            status: 'applied'
        };
        
        applications.push(newApplication);
        fs.writeFileSync(applicationsPath, JSON.stringify(applications, null, 2));
        
        res.json({ success: true, message: 'Application submitted successfully' });
        
    } catch (error) {
        console.error('Job application error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get saved jobs
app.get('/api/saved-jobs/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const savedJobsPath = path.join(__dirname, 'data', 'saved_jobs.json');
        
        let savedJobs = [];
        if (fs.existsSync(savedJobsPath)) {
            savedJobs = JSON.parse(fs.readFileSync(savedJobsPath, 'utf8'));
        }
        
        const userSavedJobs = savedJobs.filter(saved => saved.userId.toString() === userId);
        res.json({ success: true, savedJobs: userSavedJobs });
        
    } catch (error) {
        console.error('Get saved jobs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Save/unsave a job
app.post('/api/jobs/:jobId/save', (req, res) => {
    try {
        const jobId = req.params.jobId;
        const { userId } = req.body;
        
        const savedJobsPath = path.join(__dirname, 'data', 'saved_jobs.json');
        let savedJobs = [];
        
        if (fs.existsSync(savedJobsPath)) {
            savedJobs = JSON.parse(fs.readFileSync(savedJobsPath, 'utf8'));
        }
        
        // Check if job is already saved
        const existingIndex = savedJobs.findIndex(saved => 
            saved.userId.toString() === userId && saved.jobId.toString() === jobId
        );
        
        if (existingIndex !== -1) {
            // Remove from saved jobs
            savedJobs.splice(existingIndex, 1);
            fs.writeFileSync(savedJobsPath, JSON.stringify(savedJobs, null, 2));
            res.json({ success: true, message: 'Job removed from saved jobs', saved: false });
        } else {
            // Add to saved jobs
            const newSavedJob = {
                id: Date.now(),
                userId: parseInt(userId),
                jobId: parseInt(jobId),
                savedAt: new Date().toISOString()
            };
            
            savedJobs.push(newSavedJob);
            fs.writeFileSync(savedJobsPath, JSON.stringify(savedJobs, null, 2));
            res.json({ success: true, message: 'Job saved successfully', saved: true });
        }
        
    } catch (error) {
        console.error('Save job error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get dashboard statistics
app.get('/api/dashboard-stats/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Get applications count
        const applicationsPath = path.join(__dirname, 'data', 'applications.json');
        let applications = [];
        if (fs.existsSync(applicationsPath)) {
            applications = JSON.parse(fs.readFileSync(applicationsPath, 'utf8'));
        }
        const userApplications = applications.filter(app => app.userId.toString() === userId);
        
        // Get saved jobs count
        const savedJobsPath = path.join(__dirname, 'data', 'saved_jobs.json');
        let savedJobs = [];
        if (fs.existsSync(savedJobsPath)) {
            savedJobs = JSON.parse(fs.readFileSync(savedJobsPath, 'utf8'));
        }
        const userSavedJobs = savedJobs.filter(saved => saved.userId.toString() === userId);
        
        // Count interviews (applications with interview status)
        const interviews = userApplications.filter(app => app.status === 'interview' || app.status === 'interviewed');
        
        // Calculate profile views (mock data for now)
        const profileViews = Math.floor(Math.random() * 50) + userApplications.length * 3;
        
        const stats = {
            applied: userApplications.length,
            saved: userSavedJobs.length,
            interviews: interviews.length,
            profileViews: profileViews
        };
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Auto-scraping disabled - Jobs will be added manually from admin dashboard
console.log('📝 Manual job management enabled - Auto-scraping disabled');

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Job board available at http://localhost:${PORT}`);
});

module.exports = app;
