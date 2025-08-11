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
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            res.json({
                success: true,
                user: { id: user.id, email: user.email, name: user.name }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        let users = [];
        
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        
        // Create new user
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        res.json({
            success: true,
            user: { id: newUser.id, email: newUser.email, name: newUser.name }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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
