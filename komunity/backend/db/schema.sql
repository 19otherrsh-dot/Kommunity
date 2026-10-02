-- Komunity Database Schema v1.1
-- PostgreSQL

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  website_url   TEXT,
  twitter_url   TEXT,
  linkedin_url  TEXT,
  stripe_customer_id VARCHAR(255),
  role          VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'creator', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  fcm_token TEXT,
  notification_settings JSONB DEFAULT '{"email_mentions": true, "email_replies": true, "email_digest": "weekly"}',
  referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  wallet_address VARCHAR(255) UNIQUE,
  stripe_account_id VARCHAR(255),
  payouts_enabled BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Communities ──────────────────────────────────────────────────────────────
CREATE TABLE communities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  cover_image   TEXT,
  icon_image    TEXT,
  is_public     BOOLEAN DEFAULT TRUE,
  is_active     BOOLEAN DEFAULT TRUE,
  custom_domain VARCHAR(255) UNIQUE,
  theme_config  JSONB DEFAULT '{"preset": "indigo", "custom_css": ""}',
  monthly_price DECIMAL(10, 2) DEFAULT 0, -- 0 = free
  stripe_price_id VARCHAR(255),
  stripe_product_id VARCHAR(255),
  member_count  INTEGER DEFAULT 0,
  plan          VARCHAR(20) DEFAULT 'hobby' CHECK (plan IN ('hobby', 'pro')),
  category      VARCHAR(100) DEFAULT 'General',
  join_mode     VARCHAR(20) DEFAULT 'open' CHECK (join_mode IN ('open', 'application', 'invite_only')),
  intake_questions JSONB DEFAULT '[]',
  affiliate_commission_percent INTEGER DEFAULT 0,
  welcome_message_enabled BOOLEAN DEFAULT FALSE,
  welcome_message TEXT,
  token_gate_enabled BOOLEAN DEFAULT FALSE,
  token_contract_address VARCHAR(255),
  token_network VARCHAR(50) DEFAULT 'ethereum',
  min_token_balance DECIMAL(20, 4) DEFAULT 1,
  stripe_account_id VARCHAR(255),
  charges_enabled BOOLEAN DEFAULT FALSE,
  annual_price  DECIMAL(10, 2) DEFAULT 0,
  stripe_annual_price_id VARCHAR(255),
  trial_period_days INTEGER DEFAULT 0,
  currency      VARCHAR(10) DEFAULT 'usd',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Community Subscription Tiers ─────────────────────────────────────────────
CREATE TABLE community_tiers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  price             DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stripe_product_id VARCHAR(255),
  stripe_price_id   VARCHAR(255),
  features          JSONB DEFAULT '[]', -- List of features as strings
  annual_price      DECIMAL(10, 2) DEFAULT 0,
  stripe_annual_price_id VARCHAR(255),
  trial_period_days INTEGER DEFAULT 0,
  currency          VARCHAR(10) DEFAULT 'usd',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Community Members ────────────────────────────────────────────────────────
CREATE TABLE community_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  points          INTEGER DEFAULT 0,
  level           INTEGER DEFAULT 1,
  tier_id         UUID REFERENCES community_tiers(id) ON DELETE SET NULL,
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(20) DEFAULT 'active',
  wants_newsletter BOOLEAN DEFAULT TRUE,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'banned', 'rejected')),
  intake_answers  JSONB,
  cancelled_at    TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- ─── Spaces (Community Channels) ──────────────────────────────────────────────
CREATE TABLE spaces (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  slug              VARCHAR(100) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  icon_emoji        VARCHAR(10) DEFAULT '💬',
  type              VARCHAR(20) DEFAULT 'feed' CHECK (type IN ('feed', 'chat', 'announcements')),
  is_default        BOOLEAN DEFAULT FALSE,
  min_level_required INTEGER DEFAULT 1,
  min_tier_id       UUID REFERENCES community_tiers(id) ON DELETE SET NULL,
  position          INTEGER DEFAULT 0,
  is_archived       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, slug)
);

-- ─── Posts (Community Feed) ───────────────────────────────────────────────────
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  space_id      UUID REFERENCES spaces(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  media_urls    JSONB DEFAULT '[]',
  poll_data     JSONB, -- { question, options: [{id, text, votes}], ends_at }
  is_pinned     BOOLEAN DEFAULT FALSE,
  is_announcement BOOLEAN DEFAULT FALSE,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  send_email_broadcast BOOLEAN DEFAULT FALSE,
  email_broadcast_status VARCHAR(20) DEFAULT 'none',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Poll Votes ───────────────────────────────────────────────────────────────
CREATE TABLE post_poll_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id   VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- ─── Comments ─────────────────────────────────────────────────────────────────
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE, -- for threading
  content     TEXT NOT NULL,
  like_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Likes ────────────────────────────────────────────────────────────────────
CREATE TABLE likes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id),
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- ─── Courses ──────────────────────────────────────────────────────────────────
CREATE TABLE courses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  is_published  BOOLEAN DEFAULT FALSE,
  min_level_required INTEGER DEFAULT 1, -- Level gate: 1 = open, 2+ = locked until member reaches this level
  min_tier_id   UUID REFERENCES community_tiers(id) ON DELETE SET NULL,
  price         DECIMAL(10, 2) DEFAULT 0,
  stripe_product_id VARCHAR(255),
  lesson_count  INTEGER DEFAULT 0,
  sequential    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Course Purchases ─────────────────────────────────────────────────────────
CREATE TABLE course_purchases (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ─── Course Modules ───────────────────────────────────────────────────────────
CREATE TABLE course_modules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lessons ──────────────────────────────────────────────────────────────────
CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id       UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  content         TEXT,
  video_url       TEXT,    -- Mux playback URL
  mux_asset_id    TEXT,    -- Mux asset for management
  attachments     JSONB DEFAULT '[]',
  duration_seconds INTEGER DEFAULT 0,
  position        INTEGER NOT NULL DEFAULT 0,
  is_published    BOOLEAN DEFAULT FALSE,
  drip_days_after_enroll INTEGER DEFAULT 0,
  available_at    TIMESTAMPTZ,
  quiz            JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lesson Progress ──────────────────────────────────────────────────────────
CREATE TABLE lesson_progress (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed     BOOLEAN DEFAULT FALSE,
  watch_time    INTEGER DEFAULT 0, -- seconds watched
  completed_at  TIMESTAMPTZ,
  quiz_score    INTEGER,
  UNIQUE(user_id, lesson_id)
);

-- ─── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  cover_image     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  timezone        VARCHAR(100) DEFAULT 'UTC',
  daily_room_url  TEXT,   -- Daily.co room URL for video calls
  recording_url   TEXT,   -- Post-event recording
  max_attendees   INTEGER DEFAULT 50,
  rsvp_count      INTEGER DEFAULT 0,
  is_cancelled    BOOLEAN DEFAULT FALSE,
  is_webinar      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Event RSVPs ──────────────────────────────────────────────────────────────
CREATE TABLE event_rsvps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── Gamification: Point Rules ────────────────────────────────────────────────
CREATE TABLE point_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  action          VARCHAR(50) NOT NULL, -- 'post', 'comment', 'lesson_complete', 'event_attend', 'like_received'
  points          INTEGER NOT NULL DEFAULT 0,
  daily_cap       INTEGER, -- max points per day for this action (null = unlimited)
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, action)
);

-- ─── Gamification: Point Ledger ───────────────────────────────────────────────
CREATE TABLE point_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        VARCHAR(50) NOT NULL,
  points        INTEGER NOT NULL,
  reference_id  UUID,   -- post_id, lesson_id, event_id etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Badges ───────────────────────────────────────────────────────────────────
CREATE TABLE badges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  icon_emoji    VARCHAR(10),
  points_required INTEGER NOT NULL DEFAULT 0,
  level_required  INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- ─── Referrals (Affiliate System) ─────────────────────────────────────────────
CREATE TABLE referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  reward_points     INTEGER DEFAULT 50,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, referred_user_id)
);

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id  UUID REFERENCES communities(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL, -- 'comment_reply', 'post_like', 'new_event', 'level_up', 'badge_earned', 'mention'
  title         TEXT NOT NULL,
  body          TEXT,
  reference_id  UUID,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Direct Messaging ─────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Webhooks ─────────────────────────────────────────────────────────
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  endpoint_url TEXT NOT NULL,
  events JSONB DEFAULT '[]',
  secret VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_posts_community_created ON posts(community_id, created_at DESC);
CREATE INDEX idx_posts_space_created ON posts(space_id, created_at DESC);
CREATE INDEX idx_spaces_community ON spaces(community_id, position ASC);
CREATE INDEX idx_comments_post ON comments(post_id, created_at ASC);
CREATE INDEX idx_lesson_progress_user_course ON lesson_progress(user_id, course_id);
CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_point_transactions_user_community ON point_transactions(user_id, community_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_events_community_starts ON events(community_id, starts_at ASC);

-- ─── Products (Storefront) ────────────────────────────────────────────────────
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price         DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency      VARCHAR(10) DEFAULT 'usd',
  file_url      TEXT,
  file_key      TEXT,
  thumbnail_url TEXT,
  is_published  BOOLEAN DEFAULT FALSE,
  purchase_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_products_community ON products(community_id);

CREATE TABLE product_purchases (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- ─── Content Reports (Moderation Queue) ───────────────────────────────────────
CREATE TABLE content_reports (
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
CREATE INDEX idx_content_reports_community_status ON content_reports(community_id, status);

-- ─── Affiliate Commissions Ledger ─────────────────────────────────────────────
CREATE TABLE affiliate_commissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  amount            DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(10) NOT NULL DEFAULT 'usd',
  source            VARCHAR(20) NOT NULL DEFAULT 'subscription',
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  stripe_payment_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  UNIQUE(stripe_payment_id, referrer_id)
);
CREATE INDEX idx_affiliate_commissions_community ON affiliate_commissions(community_id, status);
CREATE INDEX idx_affiliate_commissions_referrer ON affiliate_commissions(referrer_id, community_id);

-- ─── Space Messages (Real-time Group Chat) ────────────────────────────────────
CREATE TABLE space_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_space_messages_space ON space_messages(space_id, created_at DESC);

-- ─── Certificates ─────────────────────────────────────────────────────────────
CREATE TABLE certificates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  serial       VARCHAR(40) NOT NULL,
  issued_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ─── Public API Keys (Zapier / Integrations) ──────────────────────────────────
CREATE TABLE api_keys (
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
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE revoked = FALSE;

-- ─── Webhook Delivery Log ─────────────────────────────────────────────────────
CREATE TABLE webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id   UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  community_id UUID,
  event        VARCHAR(100),
  status       VARCHAR(20) NOT NULL,
  status_code  INTEGER,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_webhook_deliveries_wh ON webhook_deliveries(webhook_id, created_at DESC);

-- ─── Email Suppression List ───────────────────────────────────────────────────
CREATE TABLE email_suppressions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        VARCHAR(255) NOT NULL,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  reason       VARCHAR(40) NOT NULL DEFAULT 'unsubscribe',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, community_id)
);
CREATE INDEX idx_email_suppressions_email ON email_suppressions(email);
CREATE UNIQUE INDEX idx_email_suppressions_global ON email_suppressions(email) WHERE community_id IS NULL;

-- ─── Additional Indexes ───────────────────────────────────────────────────────
CREATE INDEX idx_posts_content_fts ON posts USING GIN (to_tsvector('english', content));

-- ─── Default Point Rules (inserted on community creation) ─────────────────────
-- These are seeded via application logic using the DEFAULT_POINT_RULES constant
-- post: 5 pts | comment: 2 pts | lesson_complete: 10 pts | event_attend: 15 pts | like_received: 1 pt
