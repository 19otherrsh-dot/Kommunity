require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Consolidated, idempotent migration for the critical-bug fixes and the
 * priority roadmap (Stripe Connect, course drip, content reporting, etc.).
 * Safe to run multiple times.
 */
async function applyMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 2.3  AI course generation: course_modules.description was missing ──────
    console.log('Adding description to course_modules...');
    await client.query(`ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS description TEXT`);

    // ── 2.5  Churn analytics: need a cancellation timestamp ───────────────────
    console.log('Adding cancelled_at to community_members...');
    await client.query(`ALTER TABLE community_members ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`);

    // ── 2.1 / Priority 1  Stripe Connect payouts ──────────────────────────────
    console.log('Adding Stripe Connect fields to communities...');
    await client.query(`
      ALTER TABLE communities
      ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS charges_enabled BOOLEAN DEFAULT FALSE;
    `);

    // ── Priority 4  Course drip / scheduled lesson release ────────────────────
    console.log('Adding drip-release fields to lessons...');
    await client.query(`
      ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS drip_days_after_enroll INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;
    `);

    // ── Priority 4  Annual billing / trials on tiers and communities ──────────
    console.log('Adding annual price + trial fields...');
    await client.query(`
      ALTER TABLE communities
      ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_annual_price_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE community_tiers
      ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_annual_price_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;
    `);

    // ── Priority 4  Content reporting / moderation queue ──────────────────────
    console.log('Creating content_reports table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type   VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment')),
        target_id     UUID NOT NULL,
        reason        TEXT,
        status        VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
        resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        resolved_at   TIMESTAMPTZ
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_content_reports_community_status ON content_reports(community_id, status)`);

    // ── Gap #1  Monetary affiliate commissions ledger ────────────────────────
    console.log('Creating affiliate_commissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliate_commissions (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
        amount            DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency          VARCHAR(10) NOT NULL DEFAULT 'usd',
        source            VARCHAR(20) NOT NULL DEFAULT 'subscription',
        status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
        stripe_payment_id VARCHAR(255),
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        paid_at           TIMESTAMPTZ,
        UNIQUE(stripe_payment_id, referrer_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_community ON affiliate_commissions(community_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referrer ON affiliate_commissions(referrer_id, community_id)`);

    // ── Real-time group chat for chat-type spaces ─────────────────────────────
    console.log('Creating space_messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS space_messages (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content      TEXT NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_space_messages_space ON space_messages(space_id, created_at DESC)`);

    // ── Quizzes, certificates, sequential unlock (courses) ────────────────────
    console.log('Adding quiz + sequential-unlock fields to lessons/courses...');
    await client.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS quiz JSONB`);
    await client.query(`ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS quiz_score INTEGER`);
    await client.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS sequential BOOLEAN DEFAULT FALSE`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        serial       VARCHAR(40) NOT NULL,
        issued_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(course_id, user_id)
      );
    `);

    // ── Multi-currency + affiliate auto-payout ────────────────────────────────
    console.log('Adding currency + affiliate payout fields...');
    await client.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'usd'`);
    await client.query(`ALTER TABLE community_tiers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'usd'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255)`);

    // ── Public API keys (Zapier / integrations) ───────────────────────────────
    console.log('Creating api_keys table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR(255) NOT NULL,
        key_prefix   VARCHAR(16) NOT NULL,
        key_hash     VARCHAR(255) NOT NULL,
        last_used_at TIMESTAMPTZ,
        revoked      BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE revoked = FALSE`);

    // ── Digital products storefront ───────────────────────────────────────────
    console.log('Creating products + product_purchases tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        price         DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency      VARCHAR(10) DEFAULT 'usd',
        file_url      TEXT,
        file_key      TEXT,
        thumbnail_url TEXT,
        is_published  BOOLEAN DEFAULT FALSE,
        purchase_count INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_community ON products(community_id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_purchases (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(product_id, user_id)
      );
    `);

    // ── Webhook delivery log + auto-disable ───────────────────────────────────
    console.log('Creating webhook_deliveries + failure tracking...');
    await client.query(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        webhook_id   UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        community_id UUID,
        event        VARCHAR(100),
        status       VARCHAR(20) NOT NULL,
        status_code  INTEGER,
        error        TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_wh ON webhook_deliveries(webhook_id, created_at DESC)`);

    // ── Email suppression list (unsubscribes, bounces, spam complaints) ───────
    console.log('Creating email_suppressions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_suppressions (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email        VARCHAR(255) NOT NULL,
        community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
        reason       VARCHAR(40) NOT NULL DEFAULT 'unsubscribe',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(email, community_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email)`);
    // Dedupe global (community_id IS NULL) suppressions, which the table UNIQUE can't cover
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_global ON email_suppressions(email) WHERE community_id IS NULL`);

    // ── Priority 5  Full-text search index for posts ──────────────────────────
    console.log('Adding full-text search index on posts...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING GIN (to_tsvector('english', content))`);

    await client.query('COMMIT');
    console.log('✅ migrate_fixes applied successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying migrations:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    pool.end();
  }
}

applyMigrations();
