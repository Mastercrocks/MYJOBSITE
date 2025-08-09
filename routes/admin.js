const express = require('express');
const { pool } = require('../config/database');

// Import middleware safely
let { authenticateToken, requireAdmin } = require('../middleware/auth') || {};

// Fallbacks if imports are missing or not functions
if (typeof authenticateToken !== 'function') {
  console.error('❌ ERROR: authenticateToken middleware is missing or not a function.');
  authenticateToken = (req, res, next) => res.status(500).json({ error: 'Server middleware error' });
}
if (typeof requireAdmin !== 'function') {
  console.error('❌ ERROR: requireAdmin middleware is missing or not a function.');
  requireAdmin = (req, res, next) => res.status(500).json({ error: 'Server middleware error' });
}

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// (rest of your original code here, unchanged...)

module.exports = router;


// ========== DASHBOARD OVERVIEW ==========
router.get('/dashboard', async (req, res) => {
  try {
    // Get all the statistics for dashboard
    const stats = {};

    // Total users by type
    const [userStats] = await pool.execute(`
      SELECT 
        user_type,
        status,
        COUNT(*) as count
      FROM users 
      WHERE user_type != 'admin'
      GROUP BY user_type, status
    `);

    // Process user stats
    stats.totalUsers = 0;
    stats.totalJobSeekers = 0;
    stats.totalEmployers = 0;
    stats.pendingUsers = 0;
    stats.activeUsers = 0;

    userStats.forEach(stat => {
      stats.totalUsers += stat.count;
      
      if (stat.user_type === 'job_seeker') {
        stats.totalJobSeekers += stat.count;
      } else if (stat.user_type === 'employer') {
        stats.totalEmployers += stat.count;
      }

      if (stat.status === 'pending') {
        stats.pendingUsers += stat.count;
      } else if (stat.status === 'active') {
        stats.activeUsers += stat.count;
      }
    });

    // Company stats
    const [companyStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM companies
      GROUP BY status
    `);

    stats.totalCompanies = 0;
    stats.pendingCompanies = 0;
    stats.approvedCompanies = 0;

    companyStats.forEach(stat => {
      stats.totalCompanies += stat.count;
      if (stat.status === 'pending') {
        stats.pendingCompanies += stat.count;
      } else if (stat.status === 'approved') {
        stats.approvedCompanies += stat.count;
      }
    });

    // Job stats
    const [jobStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM jobs
      GROUP BY status
    `);

    stats.totalJobs = 0;
    stats.activeJobs = 0;
    stats.pendingJobs = 0;

    jobStats.forEach(stat => {
      stats.totalJobs += stat.count;
      if (stat.status === 'active') {
        stats.activeJobs += stat.count;
      } else if (stat.status === 'pending_review') {
        stats.pendingJobs += stat.count;
      }
    });

    // Application stats
    const [applicationStats] = await pool.execute('SELECT COUNT(*) as count FROM job_applications');
    stats.totalApplications = applicationStats[0].count;

    // Recent registrations (last 7 days)
    const [recentStats] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
        AND user_type != 'admin'
    `);
    stats.recentRegistrations = recentStats[0].count;

    res.json({ stats });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

// ========== USER MANAGEMENT ==========
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const userType = req.query.userType || 'all';
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let whereClause = "WHERE u.user_type != 'admin'";
    let params = [];

    if (userType !== 'all') {
      whereClause += " AND u.user_type = ?";
      params.push(userType);
    }

    if (status !== 'all') {
      whereClause += " AND u.status = ?";
      params.push(status);
    }

    if (search) {
      whereClause += " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get users with company info for employers
    const [users] = await pool.execute(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
        u.user_type, u.status, u.email_verified, u.created_at, u.last_login,
        u.login_count, u.admin_notes,
        CASE 
          WHEN u.user_type = 'employer' THEN c.name
          ELSE NULL 
        END as company_name
      FROM users u
      LEFT JOIN employer_profiles ep ON u.id = ep.user_id
      LEFT JOIN companies c ON ep.company_id = c.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get total count for pagination
    const [totalCount] = await pool.execute(`
      SELECT COUNT(*) as count FROM users u ${whereClause}
    `, params);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount[0].count / limit),
        totalUsers: totalCount[0].count,
        limit
      }
    });

  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user status
router.patch('/users/:id/status', async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, adminNotes } = req.body;

    if (!['pending', 'active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update user
    await pool.execute(
      'UPDATE users SET status = ?, admin_notes = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, adminNotes || null, req.user.id, userId]
    );

    // Log the action
    await logAdminAction(
      req.user.id,
      'UPDATE_USER_STATUS',
      'user',
      userId,
      `Changed user status to ${status}${adminNotes ? ': ' + adminNotes : ''}`,
      req
    );

    res.json({ message: 'User status updated successfully' });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ========== COMPANY MANAGEMENT ==========
router.get('/companies', async (req, res) => {
  try {
    const [companies] = await pool.execute(`
      SELECT 
        c.*,
        COUNT(DISTINCT j.id) as job_count,
        COUNT(DISTINCT ep.user_id) as employer_count,
        u.username as created_by_username
      FROM companies c
      LEFT JOIN jobs j ON c.id = j.company_id
      LEFT JOIN employer_profiles ep ON c.id = ep.company_id
      LEFT JOIN users u ON ep.user_id = u.id AND ep.is_company_admin = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ companies });

  } catch (error) {
    console.error('Companies fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Update company status
router.patch('/companies/:id/status', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.execute(
      'UPDATE companies SET status = ? WHERE id = ?',
      [status, companyId]
    );

    await logAdminAction(
      req.user.id,
      'UPDATE_COMPANY_STATUS',
      'company',
      companyId,
      `Changed company status to ${status}`,
      req
    );

    res.json({ message: 'Company status updated successfully' });

  } catch (error) {
    console.error('Company status update error:', error);
    res.status(500).json({ error: 'Failed to update company status' });
  }
});

// ========== JOB MANAGEMENT ==========
router.get('/jobs', async (req, res) => {
  try {
    const [jobs] = await pool.execute(`
      SELECT 
        j.*,
        c.name as company_name,
        u.username as posted_by_username,
        COUNT(ja.id) as application_count
      FROM jobs j
      JOIN companies c ON j.company_id = c.id
      JOIN users u ON j.posted_by = u.id
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      GROUP BY j.id
      ORDER BY j.created_at DESC
      LIMIT 50
    `);

    res.json({ jobs });

  } catch (error) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Update job status (approve/reject)
router.patch('/jobs/:id/status', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { status, rejectionReason } = req.body;

    if (!['pending_review', 'active', 'rejected', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.execute(
      'UPDATE jobs SET status = ?, admin_reviewed = TRUE, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?',
      [status, req.user.id, rejectionReason || null, jobId]
    );

    await logAdminAction(
      req.user.id,
      'REVIEW_JOB',
      'job',
      jobId,
      `${status === 'active' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} job${rejectionReason ? ': ' + rejectionReason : ''}`,
      req
    );

    res.json({ message: 'Job status updated successfully' });

  } catch (error) {
    console.error('Job status update error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

module.exports = router;