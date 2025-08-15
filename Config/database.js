const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;
if (process.env.DB_URL) {
  // Use connection string if available
  pool = mysql.createPool(process.env.DB_URL);
} else {
  // Fallback to manual config
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  pool = mysql.createPool(dbConfig);
}

// Test connection function
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully to:', process.env.DB_HOST);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Check your .env file database credentials');
  }
}

module.exports = { pool, testConnection };
