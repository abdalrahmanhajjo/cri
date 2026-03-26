-- Check-ins, visitor inquiries (business replies), and promotions per place.

CREATE TABLE IF NOT EXISTS place_checkins (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_checkins_place ON place_checkins(place_id);
CREATE INDEX IF NOT EXISTS idx_place_checkins_user ON place_checkins(user_id);

-- One check-in per user per place per calendar day (UTC)
CREATE UNIQUE INDEX IF NOT EXISTS idx_place_checkins_one_per_day
  ON place_checkins (place_id, user_id, (date_trunc('day', created_at AT TIME ZONE 'UTC')));

CREATE TABLE IF NOT EXISTS place_inquiries (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_name VARCHAR(200),
  guest_email VARCHAR(320),
  message TEXT NOT NULL,
  response TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT place_inquiries_status_chk CHECK (status IN ('open', 'answered', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_place_inquiries_place ON place_inquiries(place_id);
CREATE INDEX IF NOT EXISTS idx_place_inquiries_created ON place_inquiries(place_id, created_at DESC);

CREATE TABLE IF NOT EXISTS place_promotions (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500),
  code VARCHAR(64),
  discount_label VARCHAR(120),
  terms TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_promotions_place ON place_promotions(place_id);
CREATE INDEX IF NOT EXISTS idx_place_promotions_active ON place_promotions(place_id, active);
