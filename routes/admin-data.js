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
        const employerIndex = employers.findIndex(emp => emp.id === req.params.id);
        
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

module.exports = router;
