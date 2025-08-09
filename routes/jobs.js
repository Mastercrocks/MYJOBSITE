const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const jobApiService = require('../services/jobApiService');

const router = express.Router();

// GET /api/jobs - Search jobs (both internal and external)
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      location = '',
      remote = 'all',
      jobType = 'all',
      salaryMin = 0,
      source = 'all', // 'internal', 'external', 'all'
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    let jobs = [];

    if (source === 'all' || source === 'internal') {
      // Get internal jobs (posted by employers on your platform)
      let whereClause = "WHERE j.status = 'active'";
      let params = [];

      if (search) {
        whereClause += " AND (j.title LIKE ? OR j.description LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (location) {
        whereClause += " AND (j.location_city LIKE ? OR j.location_state LIKE ?)";
        const locationTerm = `%${location}%`;
        params.push(locationTerm, locationTerm);
      }

      if (remote !== 'all') {
        whereClause += " AND j.remote_type = ?";
        params.push(remote === 'true' ? 'remote' : 'on_site');
      }

      if (jobType !== 'all') {
        whereClause += " AND j.job_type = ?";
        params.push(jobType);
      }

      if (salaryMin > 0) {
        whereClause += " AND j.salary_min >= ?";
        params.push(salaryMin);
      }

      const [internalJobs] = await pool.execute(`
        SELECT 
          j.id,
          j.title,
          c.name as company,
          CONCAT(j.location_city, ', ', j.location_state) as location,
          j.description,
          j.salary_min,
          j.salary_max,
          j.job_type,
          j.remote_type,
          j.created_at as posted_date,
          'internal' as source,
          j.expires_at
        FROM jobs j
        JOIN companies c ON j.company_id = c.id
        ${whereClause}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      jobs = jobs.concat(internalJobs.map(job => ({
        ...job,
        salary: job.salary_max ? `${job.salary_min} - ${job.salary_max}` : null,
        url: `/jobs/${job.id}`,
        remote: job.remote_type === 'remote'
      })));
    }

    if (source === 'all' || source === 'external') {
      // Get external jobs from cache
      let externalWhereClause = "WHERE 1=1";
      let externalParams = [];

      if (search) {
        externalWhereClause += " AND (title LIKE ? OR description LIKE ?)";
        const searchTerm = `%${search}%`;
        externalParams.push(searchTerm, searchTerm);
      }

      if (location) {
        externalWhereClause += " AND location LIKE ?";
        externalParams.push(`%${location}%`);
      }

      if (remote !== 'all') {
        externalWhereClause += " AND is_remote = ?";
        externalParams.push(remote === 'true');
      }

      const [externalJobs] = await pool.execute(`
        SELECT 
          external_id as id,
          title,
          company,
          location,
          description,
          salary,
          job_type,
          is_remote as remote,
          posted_date,
          source,
          url
        FROM external_jobs
        ${externalWhereClause}
        ORDER BY posted_date DESC
        LIMIT ? OFFSET ?
      `, [...externalParams, parseInt(limit), parseInt(offset)]);

      jobs = jobs.concat(externalJobs);
    }

    // Sort all jobs by posted date
    jobs.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));

    res.json({
      jobs: jobs.slice(0, limit),
      pagination: {
        currentPage: parseInt(page),
        totalJobs: jobs.length,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Job search error:', error);
    res.status(500).json({ error: 'Failed to search jobs' });
  }
});

// GET /api/jobs/refresh - Refresh external jobs (admin only)
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const searchParams = req.body;
    const jobs = await jobApiService.aggregateJobs(searchParams);
    await jobApiService.saveExternalJobs(jobs);

    res.json({
      message: `Refreshed ${jobs.length} external jobs`,
      jobCount: jobs.length
    });

  } catch (error) {
    console.error('Job refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh jobs' });
  }
});

// GET /api/jobs/sources - Get available job sources
router.get('/sources', (req, res) => {
  res.json({
    sources: [
      { id: 'internal', name: 'TalentSync Jobs', description: 'Jobs posted directly on our platform' },
      { id: 'ziprecruiter', name: 'ZipRecruiter', description: 'Jobs from ZipRecruiter' },
      { id: 'adzuna', name: 'Adzuna', description: 'Jobs from Adzuna' },
      { id: 'jsearch', name: 'JSearch', description: 'Jobs from JSearch API' }
    ]
  });
});

// GET /api/jobs/:id - Get specific job details
router.get('/:id', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Check if it's an internal job first
    if (!jobId.includes('_')) {
      const [internalJob] = await pool.execute(`
        SELECT 
          j.*,
          c.name as company_name,
          c.website as company_website,
          c.description as company_description,
          u.first_name as posted_by_name,
          COUNT(ja.id) as application_count
        FROM jobs j
        JOIN companies c ON j.company_id = c.id
        JOIN users u ON j.posted_by = u.id
        LEFT JOIN job_applications ja ON j.id = ja.job_id
        WHERE j.id = ? AND j.status = 'active'
        GROUP BY j.id
      `, [jobId]);

      if (internalJob.length > 0) {
        const job = internalJob[0];
        return res.json({
          ...job,
          source: 'internal',
          canApply: true,
          location: `${job.location_city}, ${job.location_state}`,
          salary: job.salary_max ? `${job.salary_min} - ${job.salary_max}` : null
        });
      }
    }

    // Check external jobs
    const [externalJob] = await pool.execute(
      'SELECT * FROM external_jobs WHERE external_id = ?',
      [jobId]
    );

    if (externalJob.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      ...externalJob[0],
      canApply: false, // External jobs redirect to original site
      isExternal: true
    });

  } catch (error) {
    console.error('Job fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

module.exports = router;