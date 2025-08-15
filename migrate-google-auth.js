const { pool } = require('./Config/database');

async function addGoogleIdColumn() {
    try {
        console.log('Adding google_id column to users table...');
        
        // Check if column already exists
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'google_id'
        `);
        
        if (columns.length === 0) {
            // Add google_id column
            await pool.execute(`
                ALTER TABLE users 
                ADD COLUMN google_id VARCHAR(255) UNIQUE NULL,
                ADD COLUMN profile_picture TEXT NULL
            `);
            console.log('✅ Added google_id and profile_picture columns successfully');
        } else {
            console.log('✅ google_id column already exists');
        }

        // Also add session table for express-session if needed
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
                expires INT(11) UNSIGNED NOT NULL,
                data MEDIUMTEXT COLLATE utf8mb4_bin,
                PRIMARY KEY (session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
        `);
        console.log('✅ Sessions table ready');

        console.log('🎉 Database migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

addGoogleIdColumn();
