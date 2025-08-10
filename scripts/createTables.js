const { pool } = require('../config/database');

async function createTables() {
  try {
    console.log('Creating TalentSync database tables...');

    // Users table (job seekers, employers, admins)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        user_type ENUM('job_seeker', 'employer', 'admin') NOT NULL DEFAULT 'job_seeker',
        status ENUM('pending', 'active', 'suspended', 'banned') DEFAULT 'pending',
        email_verified BOOLEAN DEFAULT FALSE,
        
        -- Personal Info
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        
        -- Admin fields
        admin_notes TEXT,
        approved_by INT,
        approved_at TIMESTAMP NULL,
        
        -- Activity tracking
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        login_count INT DEFAULT 0,
        
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_user_type (user_type),
        INDEX idx_status (status)
      )
    `);

    // Job seeker profiles
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS job_seeker_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        resume_url VARCHAR(500),
        skills JSON,
        experience_level ENUM('entry', 'mid', 'senior', 'executive'),
        desired_salary_min DECIMAL(10,2),
        desired_salary_max DECIMAL(10,2),
        location_city VARCHAR(100),
        location_state VARCHAR(100),
        bio TEXT,
        portfolio_url VARCHAR(500),
        linkedin_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Companies table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        website VARCHAR(500),
        industry VARCHAR(100),
        company_size ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
        description TEXT,
        logo_url VARCHAR(500),
        headquarters_city VARCHAR(100),
        headquarters_state VARCHAR(100),
        status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Employer profiles (links users to companies)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS employer_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        job_title VARCHAR(150),
        is_company_admin BOOLEAN DEFAULT FALSE,
        can_post_jobs BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      )
    `);

    // Jobs table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        posted_by INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT,
        salary_min DECIMAL(10,2),
        salary_max DECIMAL(10,2),
        job_type ENUM('full_time', 'part_time', 'contract', 'freelance', 'internship'),
        remote_type ENUM('on_site', 'remote', 'hybrid'),
        location_city VARCHAR(100),
        location_state VARCHAR(100),
        
        -- Admin moderation
        status ENUM('draft', 'pending_review', 'active', 'paused', 'expired', 'rejected') DEFAULT 'pending_review',
        admin_reviewed BOOLEAN DEFAULT FALSE,
        reviewed_by INT NULL,
        reviewed_at TIMESTAMP NULL,
        rejection_reason TEXT,
        
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_company (company_id),
        INDEX idx_location (location_city, location_state)
      )
    `);

    // Job applications
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT NOT NULL,
        applicant_id INT NOT NULL,
        status ENUM('applied', 'viewed', 'shortlisted', 'interviewed', 'rejected', 'hired') DEFAULT 'applied',
        cover_letter TEXT,
        resume_url VARCHAR(500),
        employer_notes TEXT,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_application (job_id, applicant_id)
      )
    `);

    // Admin activity logs
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INT,
        description TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_admin (admin_id),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      )
    `);

    console.log('✅ All database tables created successfully!');
    
    // Show what was created
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('\n📋 Created tables:');
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createTables().then(() => {
    console.log('\n🎉 Database setup complete! You can now run your server.');
    process.exit(0);
  });
}

module.exports = createTables;