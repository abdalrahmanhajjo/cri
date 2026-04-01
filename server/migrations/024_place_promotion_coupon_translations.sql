-- Localized copy for venue offers (place_promotions) and coupons.

CREATE TABLE IF NOT EXISTS place_promotion_translations (
  promotion_id BIGINT NOT NULL REFERENCES place_promotions (id) ON DELETE CASCADE,
  lang VARCHAR(5) NOT NULL,
  title VARCHAR(200),
  subtitle VARCHAR(500),
  discount_label VARCHAR(120),
  terms TEXT,
  PRIMARY KEY (promotion_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_place_promotion_translations_lang
  ON place_promotion_translations (lang);

-- coupons table exists in production Supabase; skip if missing (older local DBs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coupons'
  ) THEN
    CREATE TABLE IF NOT EXISTS coupon_translations (
      coupon_id UUID NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
      lang VARCHAR(5) NOT NULL,
      title VARCHAR(200),
      subtitle VARCHAR(500),
      discount_label VARCHAR(120),
      terms TEXT,
      PRIMARY KEY (coupon_id, lang)
    );
    CREATE INDEX IF NOT EXISTS idx_coupon_translations_lang ON coupon_translations (lang);
  END IF;
END $$;
