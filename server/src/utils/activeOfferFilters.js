/**
 * Shared SQL fragments for public place_promotions + coupons (Discover + place detail).
 * Date rules: ends_at / valid_until stay valid through end of local calendar day when stored as midnight.
 */

const PLACE_PROMOTION_ACTIVE = `
  pr.active = true
  AND (pr.starts_at IS NULL OR pr.starts_at <= NOW())
  AND (
    pr.ends_at IS NULL
    OR pr.ends_at >= NOW()
    OR (
      pr.ends_at = date_trunc('day', pr.ends_at)
      AND date_trunc('day', pr.ends_at) + interval '1 day' > NOW()
    )
  )`;

const COUPON_ACTIVE = `
  (c.valid_from IS NULL OR c.valid_from <= NOW())
  AND (
    c.valid_until IS NULL
    OR c.valid_until >= NOW()
    OR (
      c.valid_until = date_trunc('day', c.valid_until)
      AND date_trunc('day', c.valid_until) + interval '1 day' > NOW()
    )
  )
  AND (
    c.usage_limit IS NULL
    OR (SELECT COUNT(*)::bigint FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) < c.usage_limit
  )`;

function placePromoBranch(placeAndLine) {
  return `
    SELECT ('promo-' || pr.id::text) AS id,
           pr.place_id AS "placeId",
           pr.title, pr.subtitle, pr.code,
           pr.discount_label AS "discountLabel",
           pr.terms,
           pr.starts_at AS "startsAt",
           pr.ends_at AS "endsAt",
           COALESCE(NULLIF(TRIM(pl.name), ''), NULLIF(TRIM(pr.place_id::text), ''), '') AS "placeName",
           pr.created_at AS _sort
    FROM place_promotions pr
    LEFT JOIN places pl ON pl.id = pr.place_id
    WHERE ` + PLACE_PROMOTION_ACTIVE + `
      AND (` + placeAndLine + ')';
}

function couponAsPromoBranch(placeAndLine) {
  return `
    SELECT ('coupon-' || c.id::text) AS id,
           c.place_id AS "placeId",
           COALESCE(NULLIF(TRIM(cl.name), ''), 'Special offer') AS title,
           CASE
             WHEN c.min_purchase > 0 THEN ('Min. purchase: ' || TRIM(TO_CHAR(c.min_purchase, 'FM999990.99')))
             ELSE NULL
           END AS subtitle,
           c.code,
           CASE (c.discount_type)::text
             WHEN 'percent' THEN TRIM(TO_CHAR(c.discount_value, 'FM999990.99')) || '% off'
             ELSE TRIM(TO_CHAR(c.discount_value, 'FM999990.99')) || ' off'
           END AS "discountLabel",
           CASE WHEN c.usage_limit IS NOT NULL THEN 'Usage limit: ' || c.usage_limit::text ELSE NULL END AS terms,
           c.valid_from AS "startsAt",
           c.valid_until AS "endsAt",
           COALESCE(NULLIF(TRIM(cl.name), ''), '') AS "placeName",
           c.created_at AS _sort
    FROM coupons c
    LEFT JOIN places cl ON cl.id = c.place_id
    WHERE ` + COUPON_ACTIVE + `
      AND (` + placeAndLine + ')';
}

/** Inner SELECT for merged public query (Discover); $1 = limit, $2 = optional place id. */
const PLACE_PROMO_SELECT = placePromoBranch('$2::text IS NULL OR pr.place_id = $2::text');

/** Inner SELECT for merged public query (Discover); coupon branch. */
const COUPON_AS_PROMO_SELECT = couponAsPromoBranch('$2::text IS NULL OR c.place_id = $2::text');

/** Single-place inner branches: $1 = place_id, $2 = limit on outer query. */
const PLACE_PROMO_SELECT_FOR_PLACE = placePromoBranch('pr.place_id = $1');
/** Match mobile/public feed: venue-scoped coupons plus app-wide coupons (place_id IS NULL). */
const COUPON_AS_PROMO_SELECT_FOR_PLACE = couponAsPromoBranch('(c.place_id IS NULL OR c.place_id = $1)');

const SQL_PLACE_PROMOTIONS = `
SELECT id, title, subtitle, code, "discountLabel", terms, "startsAt", "endsAt"
FROM (
` + PLACE_PROMO_SELECT_FOR_PLACE + `
    UNION ALL
` + COUPON_AS_PROMO_SELECT_FOR_PLACE + `
) AS sub
ORDER BY sub._sort DESC
LIMIT $2`;

const SQL_PROMOTIONS_ONLY = `
  SELECT ('promo-' || pr.id::text) AS id, pr.place_id AS "placeId", pr.title, pr.subtitle, pr.code,
         pr.discount_label AS "discountLabel", pr.terms,
         pr.starts_at AS "startsAt", pr.ends_at AS "endsAt",
         COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(pr.place_id::text), ''), '') AS "placeName"
  FROM place_promotions pr
  LEFT JOIN places p ON p.id = pr.place_id
  WHERE ` + PLACE_PROMOTION_ACTIVE + `
    AND ($2::text IS NULL OR pr.place_id = $2::text)
  ORDER BY pr.created_at DESC
  LIMIT $1`;

const SQL_PLACE_PROMOTIONS_FALLBACK = `
  SELECT ('promo-' || pr.id::text) AS id,
         pr.title, pr.subtitle, pr.code,
         pr.discount_label AS "discountLabel",
         pr.terms,
         pr.starts_at AS "startsAt",
         pr.ends_at AS "endsAt"
  FROM place_promotions pr
  WHERE ` + PLACE_PROMOTION_ACTIVE + `
    AND pr.place_id = $1
  ORDER BY pr.created_at DESC
  LIMIT $2`;

module.exports = {
  PLACE_PROMOTION_ACTIVE,
  COUPON_ACTIVE,
  COUPON_AS_PROMO_SELECT,
  PLACE_PROMO_SELECT,
  SQL_PLACE_PROMOTIONS,
  SQL_PLACE_PROMOTIONS_FALLBACK,
  SQL_PROMOTIONS_ONLY,
};
