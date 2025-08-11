const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable compression
app.use(compression());

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes FIRST (before static files)
app.get('/api/fresh', (req, res) => {
    try {
        const scrapedJobsPath = path.join(__dirname, 'data', 'scraped_jobs.json');
        if (fs.existsSync(scrapedJobsPath)) {
            const scrapedJobs = JSON.parse(fs.readFileSync(scrapedJobsPath, 'utf8'));
            res.json({
                success: true,
                jobs: scrapedJobs,
                sources: {
                    scraped: scrapedJobs.length,
                    api: 0
                }
            });
        } else {
            res.json({
                success: false,
                jobs: [],
                sources: { scraped: 0, api: 0 }
            });
        }
    } catch (error) {
        console.error('Error reading scraped jobs:', error);
        res.json({
            success: false,
            jobs: [],
            sources: { scraped: 0, api: 0 }
        });
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

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'register.html'));
});

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
    res.sendFile(path.join(__dirname, 'Public', 'dashboard.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'reset-password.html'));
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'forgot-password.html'));
});

// Employer dashboard
app.get('/employer/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'employer', 'dashboard.html'));
});

// Jobseeker dashboard  
app.get('/jobseeker/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'jobseeker', 'dashboard.html'));
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

// Basic auth routes
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        const user = users.find(u => u.email === email);
        
        if (user) {
            // Check if password is hashed (starts with $2b$) or plaintext
            let isValidPassword = false;
            if (user.password.startsWith('$2b$')) {
                // Hashed password - use bcrypt
                const bcrypt = require('bcrypt');
                isValidPassword = await bcrypt.compare(password, user.password);
            } else {
                // Plaintext password - direct comparison
                isValidPassword = user.password === password;
            }
            
            if (isValidPassword) {
                res.json({
                    success: true,
                    user: { 
                        id: user.id, 
                        email: user.email, 
                        name: user.name, 
                        userType: user.userType 
                    }
                });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/auth/register', async (req, res) => {
    const { name, email, password, userType = 'job_seeker', companyName } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        // Check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'An account with this email already exists. Try logging in or use the "Forgot Password" option to reset your password.',
                showLogin: true
            });
        }
        
        // Hash password
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword,
            userType,
            companyName: companyName || null,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        // Send welcome email for employers
        if (userType === 'employer') {
            try {
                const { sendAccountEmail } = require('./services/emailService');
                await sendAccountEmail({
                    to: email,
                    subject: 'Welcome to TalentSync - Employer Account Created',
                    text: `Welcome to TalentSync!\n\nYour employer account has been created successfully.\n\nEmail: ${email}\nCompany: ${companyName || 'Not specified'}\n\nYou can now log in at http://localhost:3000/login\n\nBest regards,\nTalentSync Team`,
                    html: `
                        <h2>Welcome to TalentSync!</h2>
                        <p>Your employer account has been created successfully.</p>
                        <ul>
                            <li><strong>Email:</strong> ${email}</li>
                            <li><strong>Company:</strong> ${companyName || 'Not specified'}</li>
                        </ul>
                        <p><a href="http://localhost:3000/login">Click here to log in</a></p>
                        <p>Best regards,<br>TalentSync Team</p>
                    `
                });
                console.log('📧 Welcome email sent to:', email);
            } catch (emailError) {
                console.error('❌ Failed to send welcome email:', emailError.message);
                // Continue registration even if email fails
            }
        }
        
        res.json({
            success: true,
            message: `${userType === 'employer' ? 'Employer' : 'User'} account created successfully${userType === 'employer' ? '. Welcome email sent!' : ''}`,
            user: { id: newUser.id, email: newUser.email, name: newUser.name, userType: newUser.userType }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

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
            const resetLink = `http://localhost:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
            
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

// Initialize job scraping if enabled
if (process.env.ENABLE_AUTO_SCRAPING === 'true') {
    try {
        const JobScrapingScheduler = require('./services/jobScheduler');
        const jobScheduler = new JobScrapingScheduler();
        jobScheduler.startScheduler();
        console.log('🤖 Automated job scraping enabled');
    } catch (error) {
        console.warn('⚠️ Job scraping scheduler not available:', error.message);
    }
}

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
