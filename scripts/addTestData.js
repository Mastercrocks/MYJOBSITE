const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function addTestData() {
  try {
    console.log('Adding test data...');
    
    // Create a test job seeker
    const jobSeekerPassword = await bcrypt.hash('password123', 12);
    const [jobSeekerResult] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, user_type, status, first_name, last_name) 
       VALUES (?, ?, ?, 'job_seeker', 'active', ?, ?)`,
      ['testjobseeker', 'jobseeker@test.com', jobSeekerPassword, 'John', 'Doe']
    );
    
    // Create a test employer
    const employerPassword = await bcrypt.hash('password123', 12);
    const [employerResult] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, user_type, status, first_name, last_name) 
       VALUES (?, ?, ?, 'employer', 'active', ?, ?)`,
      ['testemployer', 'employer@test.com', employerPassword, 'Jane', 'Smith']
    );
    
    // Create a test company
    const [companyResult] = await pool.execute(
      'INSERT INTO companies (name, website, industry, status) VALUES (?, ?, ?, ?)',
      ['Test Company Inc', 'https://testcompany.com', 'Technology', 'approved']
    );
    
    // Link employer to company
    await pool.execute(
      'INSERT INTO employer_profiles (user_id, company_id, job_title, is_company_admin) VALUES (?, ?, ?, ?)',
      [employerResult.insertId, companyResult.insertId, 'HR Manager', true]
    );
    
    // Create a test job
    await pool.execute(
      `INSERT INTO jobs (company_id, posted_by, title, description, requirements, job_type, remote_type, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyResult.insertId, 
        employerResult.insertId, 
        'Software Developer',
        'We are looking for a talented Software Developer...',
        'Bachelor degree in Computer Science, 2+ years experience',
        'full_time',
        'hybrid',
        'pending_review'
      ]
    );
    
    console.log('✅ Test data added successfully!');
    console.log('');
    console.log('Test accounts created:');
    console.log('📧 Job Seeker: testjobseeker / password123');
    console.log('📧 Employer: testemployer / password123');
    console.log('📧 Admin: admin / TalentSync2025!');
    
  } catch (error) {
    console.error('❌ Error adding test data:', error);
  }
}

addTestData().then(() => process.exit(0));