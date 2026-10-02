require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update communities
    console.log('Adding join_mode and intake_questions to communities...');
    await client.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS join_mode VARCHAR(20) DEFAULT 'open' CHECK (join_mode IN ('open', 'application', 'invite_only')),
      ADD COLUMN IF NOT EXISTS intake_questions JSONB DEFAULT '[]';
    `);

    // 2. Update community_members
    console.log('Adding status and intake_answers to community_members...');
    await client.query(`
      ALTER TABLE community_members 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'banned', 'rejected')),
      ADD COLUMN IF NOT EXISTS intake_answers JSONB;
    `);

    // 3. Create webhooks table
    console.log('Creating webhooks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        endpoint_url TEXT NOT NULL,
        events JSONB DEFAULT '[]',
        secret VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Migrations applied successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migrations:', error);
  } finally {
    client.release();
    pool.end();
  }
}

applyMigrations();
