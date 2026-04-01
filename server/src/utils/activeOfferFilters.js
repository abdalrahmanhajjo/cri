/**
 * Shared SQL for public place_promotions + coupons (Discover + place detail).
 * - $1 / $2 depend on query (see each SQL_* constant).
 * - $3 = lang (en | ar | fr) for place_translations + promotion/coupon translation joins.
 * Coupon rows include raw numeric fields so the client can format labels without English SQL.
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
           COALESCE(NULLIF(TRIM(ppt.title), ''), pr.title) AS title,
           COALESCE(NULLIF(TRIM(ppt.subtitle), ''), pr.subtitle) AS subtitle,
           pr.code,
           COALESCE(NULLIF(TRIM(ppt.discount_label), ''), pr.discount_label) AS "discountLabel",
           COALESCE(NULLIF(TRIM(ppt.terms), ''), pr.terms) AS terms,
           pr.starts_at AS "startsAt",
           pr.ends_at AS "endsAt",
           COALESCE(
             NULLIF(TRIM(plt.name), ''),
             NULLIF(TRIM(pl.name), ''),
             NULLIF(TRIM(pr.place_id::text), ''),
             ''
           ) AS "placeName",
           NULL::text AS "discountType",
           NULL::numeric AS "discountValue",
           NULL::numeric AS "minPurchase",
           NULL::int AS "usageLimit",
           pr.created_at AS _sort
    FROM place_promotions pr
    LEFT JOIN places pl ON pl.id = pr.place_id
    LEFT JOIN place_translations plt ON plt.place_id = pl.id AND plt.lang = $3
    LEFT JOIN place_promotion_translations ppt ON ppt.promotion_id = pr.id AND ppt.lang = $3
    WHERE ` + PLACE_PROMOTION_ACTIVE + `
      AND (` + placeAndLine + `)`;
}

function couponAsPromoBranch(placeAndLine) {
  return `
    SELECT ('coupon-' || c.id::text) AS id,
           c.place_id AS "placeId",
           COALESCE(
             NULLIF(TRIM(ct.title), ''),
             NULLIF(TRIM(clt.name), ''),
             NULLIF(TRIM(cl.name), ''),
             ''
           ) AS title,
           NULLIF(TRIM(ct.subtitle), '') AS subtitle,
           c.code,
           NULLIF(TRIM(ct.discount_label), '') AS "discountLabel",
           NULLIF(TRIM(ct.terms), '') AS terms,
           c.valid_from AS "startsAt",
           c.valid_until AS "endsAt",
           COALESCE(NULLIF(TRIM(clt.name), ''), NULLIF(TRIM(cl.name), ''), '') AS "placeName",
           (c.discount_type)::text AS "discountType",
           c.discount_value AS "discountValue",
           c.min_purchase AS "minPurchase",
           c.usage_limit AS "usageLimit",
           c.created_at AS _sort
    FROM coupons c
    LEFT JOIN places cl ON cl.id = c.place_id
    LEFT JOIN place_translations clt ON clt.place_id = cl.id AND clt.lang = $3
    LEFT JOIN coupon_translations ct ON ct.coupon_id = c.id AND ct.lang = $3
    WHERE ` + COUPON_ACTIVE + `
      AND (` + placeAndLine + `)`;
}

/** Discover merged list: $1 = LIMIT, $2 = optional place_id filter, $3 = lang */
const PLACE_PROMO_SELECT = placePromoBranch(`$2::text IS NULL OR pr.place_id = $2::text`);
const COUPON_AS_PROMO_SELECT = couponAsPromoBranch(
  `($2::text IS NULL OR c.place_id IS NULL OR c.place_id = $2::text)`
);

/** Single place: $1 = place_id, $3 = lang; outer LIMIT uses $2 */
const PLACE_PROMO_SELECT_FOR_PLACE = placePromoBranch(`pr.place_id = $1`);
const COUPON_AS_PROMO_SELECT_FOR_PLACE = couponAsPromoBranch(`(c.place_id IS NULL OR c.place_id = $1)`);

const SQL_PLACE_PROMOTIONS = `
SELECT id, "placeId", title, subtitle, code, "discountLabel", terms, "startsAt", "endsAt", "placeName",
       "discountType", "discountValue", "minPurchase", "usageLimit"
FROM (
` + PLACE_PROMO_SELECT_FOR_PLACE + `
    UNION ALL
` + COUPON_AS_PROMO_SELECT_FOR_PLACE + `
) AS sub
ORDER BY sub._sort DESC
LIMIT $2`;

const SQL_PROMOTIONS_ONLY = `
  SELECT ('promo-' || pr.id::text) AS id, pr.place_id AS "placeId",
         COALESCE(NULLIF(TRIM(ppt.title), ''), pr.title) AS title,
         COALESCE(NULLIF(TRIM(ppt.subtitle), ''), pr.subtitle) AS subtitle,
         pr.code,
         COALESCE(NULLIF(TRIM(ppt.discount_label), ''), pr.discount_label) AS "discountLabel",
         COALESCE(NULLIF(TRIM(ppt.terms), ''), pr.terms) AS terms,
         pr.starts_at AS "startsAt", pr.ends_at AS "endsAt",
         COALESCE(
           NULLIF(TRIM(plt.name), ''),
           NULLIF(TRIM(p.name), ''),
           NULLIF(TRIM(pr.place_id::text), ''),
           ''
         ) AS "placeName",
         NULL::text AS "discountType",
         NULL::numeric AS "discountValue",
         NULL::numeric AS "minPurchase",
         NULL::int AS "usageLimit"
  FROM place_promotions pr
  LEFT JOIN places p ON p.id = pr.place_id
  LEFT JOIN place_translations plt ON plt.place_id = p.id AND plt.lang = $3
  LEFT JOIN place_promotion_translations ppt ON ppt.promotion_id = pr.id AND ppt.lang = $3
  WHERE ` + PLACE_PROMOTION_ACTIVE + `
    AND ($2::text IS NULL OR pr.place_id = $2::text)
  ORDER BY pr.created_at DESC
  LIMIT $1`;

const SQL_PLACE_PROMOTIONS_FALLBACK = `
  SELECT ('promo-' || pr.id::text) AS id,
         pr.place_id AS "placeId",
         COALESCE(NULLIF(TRIM(ppt.title), ''), pr.title) AS title,
         COALESCE(NULLIF(TRIM(ppt.subtitle), ''), pr.subtitle) AS subtitle,
         pr.code,
         COALESCE(NULLIF(TRIM(ppt.discount_label), ''), pr.discount_label) AS "discountLabel",
         COALESCE(NULLIF(TRIM(ppt.terms), ''), pr.terms) AS terms,
         pr.starts_at AS "startsAt",
         pr.ends_at AS "endsAt",
         COALESCE(
           NULLIF(TRIM(plt.name), ''),
           NULLIF(TRIM(pl.name), ''),
           NULLIF(TRIM(pr.place_id::text), ''),
           ''
         ) AS "placeName",
         NULL::text AS "discountType",
         NULL::numeric AS "discountValue",
         NULL::numeric AS "minPurchase",
         NULL::int AS "usageLimit"
  FROM place_promotions pr
  LEFT JOIN places pl ON pl.id = pr.place_id
  LEFT JOIN place_translations plt ON plt.place_id = pl.id AND plt.lang = $3
  LEFT JOIN place_promotion_translations ppt ON ppt.promotion_id = pr.id AND ppt.lang = $3
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
