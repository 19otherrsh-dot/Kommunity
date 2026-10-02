require('dotenv').config({ path: '../.env' });
const { query } = require('./index');

async function migrate() {
  try {
    console.log('Applying DB changes for v1.1...');
    
    // Add notification settings & fcm_token to users
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email_mentions": true, "email_replies": true, "email_digest": "weekly"}'`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
    
    // Add welcome automation to communities
    await query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS welcome_message_enabled BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS welcome_message TEXT`);
    
    // Create community_tiers
    await query(`
      CREATE TABLE IF NOT EXISTS community_tiers (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        name              VARCHAR(255) NOT NULL,
        description       TEXT,
        price             DECIMAL(10, 2) NOT NULL DEFAULT 0,
        stripe_product_id VARCHAR(255),
        stripe_price_id   VARCHAR(255),
        features          JSONB DEFAULT '[]',
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add to community_members
    await query(`ALTER TABLE community_members ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES community_tiers(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE community_members ADD COLUMN IF NOT EXISTS wants_newsletter BOOLEAN DEFAULT TRUE`);

    // Add to spaces
    await query(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS min_tier_id UUID REFERENCES community_tiers(id) ON DELETE SET NULL`);

    // Add to courses
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_tier_id UUID REFERENCES community_tiers(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_level_required INT DEFAULT 1`);
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0`);
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255)`);
    
    // Create course purchases
    await query(`
      CREATE TABLE IF NOT EXISTS course_purchases (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(course_id, user_id)
      )
    `);

    // Create Direct Messaging tables
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at    TIMESTAMPTZ DEFAULT NOW(),
        joined_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(conversation_id, user_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content         TEXT NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes safely
    await query(`CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)`);

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
