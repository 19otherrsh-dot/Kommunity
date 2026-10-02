require('dotenv').config({ path: '../.env' });
const { query, pool } = require('./index');

async function up() {
  console.log('Creating products and product_purchases tables...');
  await query(`
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price         DECIMAL(10, 2) DEFAULT 0,
  currency      VARCHAR(3) DEFAULT 'usd',
  file_url      TEXT,
  file_key      TEXT,
  thumbnail_url TEXT,
  is_published  BOOLEAN DEFAULT FALSE,
  purchase_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_purchases (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);
  `);
  console.log('Done!');
  await pool.end();
}

up().catch(console.error);
