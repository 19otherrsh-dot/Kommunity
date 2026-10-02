const { getClient } = require('./komunity/backend/db');

async function migrate() {
  const client = await getClient();
  try {
    console.log('Adding email broadcast columns to posts...');
    await client.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS send_email_broadcast BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_broadcast_status VARCHAR(20) DEFAULT 'none';
    `);
    
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
