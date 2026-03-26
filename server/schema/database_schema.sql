-- =============================================================================
-- Tripoli Explorer — consolidated PostgreSQL schema (reference)
-- =============================================================================
-- This file documents all tables, columns, and key indexes used by the Node API
-- and mobile app. Production databases are usually built from historical state
-- plus incremental files in server/migrations/ (see 011_feed_engagement_fk.sql
-- for feed_likes / feed_saves foreign keys). Use this as a single place to
-- read the full picture; compare with your live DB (e.g. \d+ table in psql).
--
-- PostgreSQL 14+ recommended (gen_random_uuid, JSONB).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users & auth
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  auth_provider VARCHAR(50) DEFAULT 'email',
  auth_provider_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  is_business_owner BOOLEAN DEFAULT false,
  avatar_url TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE INDEX idx_users_is_blocked ON users (is_blocked) WHERE is_blocked = true;

CREATE TABLE profiles (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  username VARCHAR(100),
  city VARCHAR(255),
  bio TEXT,
  mood VARCHAR(50) DEFAULT 'mixed',
  pace VARCHAR(50) DEFAULT 'normal',
  analytics BOOLEAN DEFAULT true,
  show_tips BOOLEAN DEFAULT true,
  app_rating INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id)
);

CREATE TABLE email_verification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE phone_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- Taxonomy & content (places, categories, interests, events, tours)
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  count INTEGER DEFAULT 0,
  color VARCHAR(20),
  PRIMARY KEY (id)
);

CREATE TABLE category_translations (
  category_id VARCHAR(50) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  name VARCHAR(100),
  description TEXT,
  tags JSONB,
  PRIMARY KEY (category_id, lang)
);

CREATE TABLE interests (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL,
  count INTEGER DEFAULT 0,
  popularity INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE interest_translations (
  interest_id VARCHAR(50) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  name VARCHAR(100),
  description TEXT,
  tags JSONB,
  PRIMARY KEY (interest_id, lang)
);

CREATE TABLE places (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  search_name VARCHAR(255),
  images JSONB DEFAULT '[]'::jsonb,
  category VARCHAR(100),
  category_id VARCHAR(50),
  duration VARCHAR(50),
  price VARCHAR(50),
  best_time VARCHAR(100),
  rating DOUBLE PRECISION,
  review_count INTEGER,
  hours JSONB,
  tags JSONB,
  PRIMARY KEY (id)
);

CREATE TABLE place_translations (
  place_id VARCHAR(50) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(100),
  duration VARCHAR(50),
  price VARCHAR(50),
  best_time VARCHAR(100),
  tags JSONB,
  PRIMARY KEY (lang, place_id)
);

CREATE TABLE place_owners (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  place_id VARCHAR(50) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, user_id)
);

CREATE TABLE place_checkins (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_checkins_place ON place_checkins (place_id);
CREATE INDEX idx_place_checkins_user ON place_checkins (user_id);

CREATE UNIQUE INDEX idx_place_checkins_one_per_day ON place_checkins (
  place_id,
  user_id,
  (date_trunc('day', created_at AT TIME ZONE 'UTC'))
);

CREATE TABLE place_inquiries (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  guest_name VARCHAR(200),
  guest_email VARCHAR(320),
  message TEXT NOT NULL,
  response TEXT,
  visitor_followups JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT place_inquiries_status_chk CHECK (status IN ('open', 'answered', 'archived'))
);

CREATE INDEX idx_place_inquiries_place ON place_inquiries (place_id);
CREATE INDEX idx_place_inquiries_created ON place_inquiries (place_id, created_at DESC);

CREATE TABLE place_messaging_blocks (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  blocked_user_id UUID NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_email VARCHAR(320) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT place_messaging_blocks_identifier_chk CHECK (
    (blocked_user_id IS NOT NULL AND blocked_email IS NULL)
    OR (blocked_user_id IS NULL AND blocked_email IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_place_messaging_blocks_user ON place_messaging_blocks (place_id, blocked_user_id) WHERE blocked_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_place_messaging_blocks_email ON place_messaging_blocks (place_id, lower(trim(blocked_email))) WHERE blocked_email IS NOT NULL AND blocked_user_id IS NULL;

CREATE TABLE place_promotions (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500),
  code VARCHAR(64),
  discount_label VARCHAR(120),
  terms TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_promotions_place ON place_promotions (place_id);
CREATE INDEX idx_place_promotions_active ON place_promotions (place_id, active);

CREATE TABLE events (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location VARCHAR(255) NOT NULL,
  image VARCHAR(500),
  category VARCHAR(100) NOT NULL,
  organizer VARCHAR(255),
  price DOUBLE PRECISION,
  price_display VARCHAR(50),
  status VARCHAR(50),
  place_id VARCHAR(50),
  PRIMARY KEY (id)
);

CREATE TABLE event_translations (
  event_id VARCHAR(50) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(100),
  organizer VARCHAR(255),
  price_display VARCHAR(50),
  status VARCHAR(50),
  PRIMARY KEY (event_id, lang)
);

CREATE TABLE tours (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  duration VARCHAR(50) NOT NULL,
  duration_hours INTEGER NOT NULL,
  locations INTEGER NOT NULL,
  rating DOUBLE PRECISION NOT NULL,
  reviews INTEGER NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  currency VARCHAR(10) NOT NULL,
  price_display VARCHAR(50) NOT NULL,
  badge VARCHAR(50),
  badge_color VARCHAR(20),
  description TEXT NOT NULL,
  image VARCHAR(500) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  languages JSONB DEFAULT '[]'::jsonb,
  includes JSONB DEFAULT '[]'::jsonb,
  excludes JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  itinerary JSONB DEFAULT '[]'::jsonb,
  place_ids JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE tour_translations (
  tour_id VARCHAR(50) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  difficulty VARCHAR(50),
  badge VARCHAR(50),
  duration VARCHAR(50),
  price_display VARCHAR(50),
  includes JSONB,
  excludes JSONB,
  highlights JSONB,
  itinerary JSONB,
  PRIMARY KEY (lang, tour_id)
);

-- -----------------------------------------------------------------------------
-- User saves & trips
-- -----------------------------------------------------------------------------

CREATE TABLE saved_places (
  user_id UUID NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX idx_saved_places_user_id ON saved_places (user_id);

CREATE TABLE saved_events (
  user_id UUID NOT NULL,
  event_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE saved_tours (
  user_id UUID NOT NULL,
  tour_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (tour_id, user_id)
);

CREATE TABLE user_favourites (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  place_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX idx_user_favourites_user_id ON user_favourites (user_id);

CREATE TABLE trips (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  days JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trips_user_id ON trips (user_id);

-- -----------------------------------------------------------------------------
-- Site config & i18n overrides (admin / web)
-- -----------------------------------------------------------------------------

CREATE TABLE translation_overrides (
  id VARCHAR(100) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE site_settings (
  id VARCHAR(50) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Community feed (web + mobile)
-- -----------------------------------------------------------------------------

CREATE TABLE feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  author_name VARCHAR(255) NOT NULL,
  place_id VARCHAR(50),
  caption TEXT,
  image_url VARCHAR(500),
  video_url VARCHAR(500),
  type VARCHAR(20) DEFAULT 'image',
  created_at TIMESTAMPTZ DEFAULT now(),
  author_role VARCHAR(20) DEFAULT 'regular',
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  discoverable BOOLEAN NOT NULL DEFAULT true,
  admin_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

COMMENT ON COLUMN feed_posts.moderation_status IS 'pending | approved | rejected — rejected/hidden from public feed';
COMMENT ON COLUMN feed_posts.discoverable IS 'When approved, whether post appears in discovery/explore surfaces';

CREATE TABLE feed_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  parent_id UUID REFERENCES feed_comments (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_feed_comments_post_parent ON feed_comments (post_id, parent_id);
CREATE INDEX idx_feed_comments_parent ON feed_comments (parent_id);

CREATE TABLE feed_likes (
  post_id UUID NOT NULL REFERENCES feed_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_feed_likes_user_id ON feed_likes (user_id);

CREATE TABLE feed_saves (
  post_id UUID NOT NULL REFERENCES feed_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE feed_comment_likes (
  comment_id UUID NOT NULL REFERENCES feed_comments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX idx_feed_comment_likes_user ON feed_comment_likes (user_id);

-- =============================================================================
-- End of consolidated schema
-- =============================================================================
