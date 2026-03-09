-- Translation overrides for admin content editor.
-- Run: psql $DATABASE_URL -f server/migrations/004_translation_overrides.sql

CREATE TABLE IF NOT EXISTS translation_overrides (
  id VARCHAR(100) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single row for all overrides: id='default', data={ en: { nav: {...}, home: {...} }, ar: {...}, fr: {...} }
INSERT INTO translation_overrides (id, data) VALUES ('default', '{}')
ON CONFLICT (id) DO NOTHING;
