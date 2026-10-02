const { getClient } = require('./komunity/backend/db');

async function migrate() {
  const client = await getClient();
  try {
    console.log('Adding affiliate_commission_percent to communities...');
    await client.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS affiliate_commission_percent INTEGER DEFAULT 0;
    `);
    
    // Also update schema.sql for future setups
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
