const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function createAdmin() {
  try {
    console.log('Creating admin account...');
    
    const email = 'admin@talentsync.com';
    const username = 
    const password = 
    
    // Check if admin already exists
    const [existingAdmin] = await pool.execute(
      'SELECT id FROM users WHERE user_type = ? OR email = ?',
      ['admin', email]
    );
    
    if (existingAdmin.length > 0) {
      console.log('❌ Admin account already exists!');
      return;
    }
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create admin user
    const [result] = await pool.execute(
      `INSERT INTO users (email, username, password_hash, user_type, status, first_name, last_name) 
       VALUES (?, ?, ?, 'admin', 'active', 'Admin', 'User')`,
      [email, username, passwordHash]
    );
    
    console.log('✅ Admin account created successfully!');
    console.log('');
    console.log('🔐 Login Details:');
    console.log('   Email:', email);
    console.log('   Username:', username);
    console.log('   Password:', password);
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after your first login!');
    console.log('📊 Access admin dashboard at: http://localhost:3000/admin/dashboard.html');
    
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
  }
}

// Run the function
createAdmin().then(() => {
  process.exit(0);
});