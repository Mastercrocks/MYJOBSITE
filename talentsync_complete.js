// server.js - Node.js Express Server
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Create directories if they don't exist
const dirs = ['uploads/resumes', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/resumes/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Simple file-based database functions
const readData = (filename) => {
    try {
        const data = fs.readFileSync(`data/${filename}`, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeData = (filename, data) => {
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, userType } = req.body;
        
        const users = readData('users.json');
        
        // Check if user already exists
        if (users.find(user => user.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword,
            userType: userType || 'jobseeker',
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeData('users.json', users);

        // Generate JWT token
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
        
        res.status(201).json({ 
            message: 'User created successfully', 
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, userType: newUser.userType }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const users = readData('users.json');
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        
        res.json({ 
            token,
            user: { id: user.id, name: user.name, email: user.email, userType: user.userType }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Post Resume
app.post('/api/resumes', authenticateToken, upload.single('resume'), (req, res) => {
    try {
        const { title, skills, experience } = req.body;
        
        const resumes = readData('resumes.json');
        
        const newResume = {
            id: Date.now().toString(),
            userId: req.user.id,
            title,
            skills: skills ? skills.split(',').map(s => s.trim()) : [],
            experience,
            filename: req.file ? req.file.filename : null,
            originalName: req.file ? req.file.originalname : null,
            createdAt: new Date().toISOString()
        };

        resumes.push(newResume);
        writeData('resumes.json', resumes);

        res.status(201).json({ message: 'Resume posted successfully', resume: newResume });
    } catch (error) {
        res.status(500).json({ error: 'Failed to post resume' });
    }
});

// Get Resumes (for employers)
app.get('/api/resumes', authenticateToken, (req, res) => {
    try {
        const resumes = readData('resumes.json');
        const users = readData('users.json');
        
        const resumesWithUserData = resumes.map(resume => {
            const user = users.find(u => u.id === resume.userId);
            return {
                ...resume,
                userName: user ? user.name : 'Unknown',
                userEmail: user ? user.email : 'Unknown'
            };
        });

        res.json(resumesWithUserData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resumes' });
    }
});

// Post Job
app.post('/api/jobs', authenticateToken, (req, res) => {
    try {
        const { title, company, location, description, requirements, salary } = req.body;
        
        const jobs = readData('jobs.json');
        
        const newJob = {
            id: Date.now().toString(),
            employerId: req.user.id,
            title,
            company,
            location,
            description,
            requirements,
            salary,
            applications: [],
            createdAt: new Date().toISOString()
        };

        jobs.push(newJob);
        writeData('jobs.json', jobs);

        res.status(201).json({ message: 'Job posted successfully', job: newJob });
    } catch (error) {
        res.status(500).json({ error: 'Failed to post job' });
    }
});

// Get Jobs
app.get('/api/jobs', (req, res) => {
    try {
        const { keyword, location } = req.query;
        let jobs = readData('jobs.json');

        // Filter jobs based on search criteria
        if (keyword) {
            jobs = jobs.filter(job => 
                job.title.toLowerCase().includes(keyword.toLowerCase()) ||
                job.description.toLowerCase().includes(keyword.toLowerCase())
            );
        }

        if (location) {
            jobs = jobs.filter(job => 
                job.location.toLowerCase().includes(location.toLowerCase())
            );
        }

        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Apply for Job
app.post('/api/jobs/:jobId/apply', authenticateToken, (req, res) => {
    try {
        const jobId = req.params.jobId;
        const { coverLetter } = req.body;
        
        const jobs = readData('jobs.json');
        const jobIndex = jobs.findIndex(job => job.id === jobId);
        
        if (jobIndex === -1) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const application = {
            id: Date.now().toString(),
            userId: req.user.id,
            coverLetter,
            appliedAt: new Date().toISOString()
        };

        jobs[jobIndex].applications.push(application);
        writeData('jobs.json', jobs);

        res.json({ message: 'Application submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit application' });
    }
});

// Get Job Applications (for employers)
app.get('/api/jobs/:jobId/applications', authenticateToken, (req, res) => {
    try {
        const jobId = req.params.jobId;
        const jobs = readData('jobs.json');
        const users = readData('users.json');
        const resumes = readData('resumes.json');
        
        const job = jobs.find(job => job.id === jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if the user is the employer who posted this job
        if (job.employerId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const applicationsWithUserData = job.applications.map(application => {
            const user = users.find(u => u.id === application.userId);
            const userResume = resumes.find(r => r.userId === application.userId);
            
            return {
                ...application,
                userName: user ? user.name : 'Unknown',
                userEmail: user ? user.email : 'Unknown',
                userResume: userResume
            };
        });

        res.json(applicationsWithUserData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Download Resume
app.get('/api/resumes/:filename/download', authenticateToken, (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', 'resumes', filename);
        
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
    }
    res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
    console.log(`TalentSync server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});