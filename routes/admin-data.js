const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

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

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [jobs, users, employers, applications] = await Promise.all([
            readJSONFile('jobs.json'),
            readJSONFile('users.json'),
            readJSONFile('employers.json'),
            readJSONFile('applications.json')
        ]);

        // Calculate statistics
        const now = new Date();
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Job statistics
        const newJobsThisWeek = jobs.filter(job => new Date(job.posted_date) >= thisWeek).length;
        const newJobsThisMonth = jobs.filter(job => new Date(job.posted_date) >= thisMonth).length;
        
        // User statistics
        const newUsersThisWeek = users.filter(user => new Date(user.createdAt) >= thisWeek).length;
        
        // Application statistics
        const newApplicationsThisWeek = applications.filter(app => new Date(app.createdAt) >= thisWeek).length;

        // Category distribution
        const categoryStats = {};
        jobs.forEach(job => {
            categoryStats[job.category] = (categoryStats[job.category] || 0) + 1;
        });

        // Company statistics
        const companyStats = {};
        jobs.forEach(job => {
            companyStats[job.company] = (companyStats[job.company] || 0) + 1;
        });

        // Location statistics
        const locationStats = {};
        jobs.forEach(job => {
            locationStats[job.location] = (locationStats[job.location] || 0) + 1;
        });

        res.json({
            totals: {
                jobs: jobs.length,
                users: users.length,
                employers: employers.length,
                applications: applications.length
            },
            weekly: {
                newJobs: newJobsThisWeek,
                newUsers: newUsersThisWeek,
                newApplications: newApplicationsThisWeek
            },
            monthly: {
                newJobs: newJobsThisMonth
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
                .map(([location, count]) => ({ location, count }))
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

        // Filter jobs
        let filteredJobs = jobs.filter(job => {
            const matchesSearch = !search || 
                job.title.toLowerCase().includes(search.toLowerCase()) ||
                job.company.toLowerCase().includes(search.toLowerCase()) ||
                job.location.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = !category || job.category === category;
            const matchesCompany = !company || job.company === company;
            const matchesLocation = !location || job.location === location;
            
            return matchesSearch && matchesCategory && matchesCompany && matchesLocation;
        });

        // Sort by posted date (newest first)
        filteredJobs.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));

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
        const employers = await readJSONFile('employers.json');
        res.json({ employers });
    } catch (error) {
        console.error('Error getting employers:', error);
        res.status(500).json({ error: 'Failed to load employers' });
    }
});

// Get all applications
router.get('/applications', async (req, res) => {
    try {
        const applications = await readJSONFile('applications.json');
        res.json({ applications });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({ error: 'Failed to load applications' });
    }
});

// Add new job manually
router.post('/jobs', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
        const newJob = {
            id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: req.body.title,
            company: req.body.company,
            location: req.body.location,
            description: req.body.description,
            url: `https://talentsync.shop/job-detail.html?id=manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            salary: req.body.salary || 'Not specified',
            source: 'Manual',
            job_type: req.body.job_type || 'Full-time',
            remote: req.body.remote === 'true',
            posted_date: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
            category: req.body.category || 'General',
            entry_level: req.body.experience_level === 'Entry Level',
            experience_level: req.body.experience_level || 'Mid Level',
            requirements: req.body.skills ? req.body.skills.split(',').map(s => s.trim()) : [],
            benefits: [],
            featured: req.body.featured === 'true',
            urgent: req.body.urgent === 'true',
            application_email: req.body.application_email,
            application_url: req.body.application_url
        };

        jobs.unshift(newJob); // Add to beginning of array
        
        const success = await writeJSONFile('jobs.json', jobs);
        if (success) {
            res.json({ success: true, job: newJob, message: 'Job added successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save job' });
        }
    } catch (error) {
        console.error('Error adding job:', error);
        res.status(500).json({ error: 'Failed to add job' });
    }
});

// Update existing job
router.put('/jobs/:id', async (req, res) => {
    try {
        const jobs = await readJSONFile('jobs.json');
        const jobIndex = jobs.findIndex(job => job.id === req.params.id);
        
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
        const filteredJobs = jobs.filter(job => job.id !== req.params.id);
        
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

module.exports = router;
