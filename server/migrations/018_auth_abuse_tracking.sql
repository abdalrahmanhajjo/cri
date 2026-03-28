-- Shared auth abuse / cooldown counters (multi-instance safe; survives restarts).
-- Run: npm run db:migrate (from repo root with DATABASE_URL set).

CREATE TABLE IF NOT EXISTS auth_abuse_tracking (
  bucket_key VARCHAR(512) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, kind)
);

CREATE INDEX IF NOT EXISTS idx_auth_abuse_tracking_window ON auth_abuse_tracking (kind, window_start);
