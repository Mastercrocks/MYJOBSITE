const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

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
        const [jobs, users, employers, applications, analytics, revenue] = await Promise.all([
            readJSONFile('jobs.json'),
            readJSONFile('users.json'),
            readJSONFile('employers.json'),
            readJSONFile('applications.json'),
            readJSONFile('analytics.json'),
            readJSONFile('revenue.json')
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
                jobs: jobs.length,
                users: users.length,
                employers: employers.length,
                applications: applications.length,
                pageViews: analytics?.pageViews?.total || 0,
                revenue: revenue?.revenue?.total || 0
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

// Approve employer application
router.put('/employers/:id/approve', async (req, res) => {
    try {
        const employers = await readJSONFile('employers.json');
        const employerIndex = employers.findIndex(emp => emp.id === parseInt(req.params.id));
        
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
        const employerIndex = employers.findIndex(emp => emp.id === parseInt(req.params.id));
        
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

// Scrape job from URL endpoint
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

module.exports = router;
