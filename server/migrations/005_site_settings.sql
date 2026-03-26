-- Site-wide settings (web + mobile app can read via GET /api/admin/site-settings)
CREATE TABLE IF NOT EXISTS site_settings (
  id VARCHAR(50) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, data) VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
