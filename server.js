// server.js - TalentSync Node.js Express Server

const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_super_secret_key';

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create directories if they don't exist
const dirs = ['uploads/resumes', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer setup for file uploads
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
    limits: { fileSize: 5 * 1024 * 1024 }
});

// File-based database functions
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

// JWT Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, userType } = req.body;
        const users = readData('users.json');
        if (users.find(user => user.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }
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
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
        res.status(201).json({ message: 'User created successfully', token, user: newUser });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readData('users.json');
        const user = users.find(u => u.email === email);
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

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
            filename: req.file?.filename || null,
            originalName: req.file?.originalname || null,
            createdAt: new Date().toISOString()
        };
        resumes.push(newResume);
        writeData('resumes.json', resumes);
        res.status(201).json({ message: 'Resume posted successfully', resume: newResume });
    } catch (error) {
        res.status(500).json({ error: 'Failed to post resume' });
    }
});

app.get('/api/resumes', authenticateToken, (req, res) => {
    try {
        const resumes = readData('resumes.json');
        const users = readData('users.json');
        const results = resumes.map(r => {
            const user = users.find(u => u.id === r.userId);
            return { ...r, userName: user?.name || 'Unknown', userEmail: user?.email || 'Unknown' };
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resumes' });
    }
});

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

app.get('/api/jobs', (req, res) => {
    try {
        const { keyword, location } = req.query;
        let jobs = readData('jobs.json');
        if (keyword) jobs = jobs.filter(j => j.title.toLowerCase().includes(keyword.toLowerCase()) || j.description.toLowerCase().includes(keyword.toLowerCase()));
        if (location) jobs = jobs.filter(j => j.location.toLowerCase().includes(location.toLowerCase()));
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

app.post('/api/jobs/:jobId/apply', authenticateToken, (req, res) => {
    try {
        const jobId = req.params.jobId;
        const { coverLetter } = req.body;
        const jobs = readData('jobs.json');
        const jobIndex = jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return res.status(404).json({ error: 'Job not found' });
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

app.get('/api/jobs/:jobId/applications', authenticateToken, (req, res) => {
    try {
        const jobId = req.params.jobId;
        const jobs = readData('jobs.json');
        const users = readData('users.json');
        const resumes = readData('resumes.json');
        const job = jobs.find(j => j.id === jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.employerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        const applications = job.applications.map(app => {
            const user = users.find(u => u.id === app.userId);
            const resume = resumes.find(r => r.userId === app.userId);
            return { ...app, userName: user?.name || 'Unknown', userEmail: user?.email || 'Unknown', userResume: resume || null };
        });
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

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

// Error Handling Middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: error.message });
});

// Start the Server
app.listen(PORT, () => {
    console.log(`TalentSync server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});
