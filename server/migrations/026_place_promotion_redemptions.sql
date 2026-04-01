-- Track user redemptions for place_promotions (coded offers), same UX as coupons.

CREATE TABLE IF NOT EXISTS place_promotion_redemptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  promotion_id BIGINT NOT NULL REFERENCES place_promotions (id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_place_promo_redemptions_user
  ON place_promotion_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_place_promo_redemptions_promo
  ON place_promotion_redemptions (promotion_id);
