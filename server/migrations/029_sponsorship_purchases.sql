-- Paid self-serve sponsorship (Stripe) — purchases audit + link to sponsored_places

CREATE TABLE IF NOT EXISTS sponsorship_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  place_id VARCHAR(120) NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(12) NOT NULL DEFAULT 'usd',
  duration_days INTEGER NOT NULL DEFAULT 30,
  surface VARCHAR(32) NOT NULL DEFAULT 'all',
  sponsored_place_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT sponsorship_purchases_status_chk CHECK (
    status IN ('pending', 'paid', 'active', 'expired', 'refunded', 'canceled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sponsorship_purchases_stripe_session
  ON sponsorship_purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsorship_purchases_user_created
  ON sponsorship_purchases (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sponsorship_purchases_place
  ON sponsorship_purchases (place_id);

ALTER TABLE sponsored_places
  ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS purchase_id UUID,
  ADD COLUMN IF NOT EXISTS purchased_by_user_id UUID;

ALTER TABLE sponsored_places
  DROP CONSTRAINT IF EXISTS sponsored_places_source_chk;

ALTER TABLE sponsored_places
  ADD CONSTRAINT sponsored_places_source_chk CHECK (source IN ('admin', 'paid'));

-- FK purchase after table exists (avoid circular insert issues via transaction + deferral optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsored_places_purchase_id_fkey'
  ) THEN
    ALTER TABLE sponsored_places
      ADD CONSTRAINT sponsored_places_purchase_id_fkey
      FOREIGN KEY (purchase_id) REFERENCES sponsorship_purchases (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsored_places_purchased_by_user_id_fkey'
  ) THEN
    ALTER TABLE sponsored_places
      ADD CONSTRAINT sponsored_places_purchased_by_user_id_fkey
      FOREIGN KEY (purchased_by_user_id) REFERENCES users (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_purchases_sponsored_place_id_fkey'
  ) THEN
    ALTER TABLE sponsorship_purchases
      ADD CONSTRAINT sponsorship_purchases_sponsored_place_id_fkey
      FOREIGN KEY (sponsored_place_id) REFERENCES sponsored_places (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN sponsored_places.source IS 'admin = curated; paid = Stripe self-serve';
COMMENT ON COLUMN sponsorship_purchases.status IS 'pending: checkout created; paid/active: live or complete; refunded/canceled/expired';
