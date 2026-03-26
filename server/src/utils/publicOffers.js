/**
 * Public offers — single algorithm for web Discover + place pages, aligned with place_promotions
 * semantics and mobile coupons (valid windows + usage_limit vs coupon_redemptions).
 *
 * - place_promotions: active, starts_at / ends_at (inclusive end-of-calendar-day when ends_at is midnight)
 * - coupons: valid_from / valid_until with the same end-day rule; omit when global redemptions >= usage_limit
 */

/** ends_at / valid_until: still valid through end of local calendar day when stored as midnight. */
const PROMO_DATE_ACTIVE = `
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

const COUPON_DATE_ACTIVE = `
  (c.valid_from IS NULL OR c.valid_from <= NOW())
  AND (
    c.valid_until IS NULL
    OR c.valid_until >= NOW()
    OR (
      c.valid_until = date_trunc('day', c.valid_until)
      AND date_trunc('day', c.valid_until) + interval '1 day' > NOW()
    )
  )`;

/** When usage_limit is set, hide coupon once redemptions count reaches it (app-style cap). */
const COUPON_USAGE_OK = `
  (
    c.usage_limit IS NULL
    OR (SELECT COUNT(*)::bigint FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) < c.usage_limit
  )`;

const SQL_MERGED = `
  SELECT id, "placeId", title, subtitle, code, "discountLabel", terms, "startsAt", "endsAt", "placeName"
  FROM (
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
    WHERE ${PROMO_DATE_ACTIVE}
      AND ($2::text IS NULL OR pr.place_id = $2::text)
    UNION ALL
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
    WHERE ${COUPON_DATE_ACTIVE}
      AND (${COUPON_USAGE_OK})
      AND (
        $2::text IS NULL
        OR c.place_id IS NULL
        OR c.place_id = $2::text
      )
  ) AS merged
  ORDER BY merged._sort DESC
  LIMIT $1`;

const SQL_PROMO_ONLY = `
  SELECT ('promo-' || pr.id::text) AS id, pr.place_id AS "placeId", pr.title, pr.subtitle, pr.code,
         pr.discount_label AS "discountLabel", pr.terms,
         pr.starts_at AS "startsAt", pr.ends_at AS "endsAt",
         COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(pr.place_id::text), ''), '') AS "placeName"
  FROM place_promotions pr
  LEFT JOIN places p ON p.id = pr.place_id
  WHERE ${PROMO_DATE_ACTIVE}
    AND ($2::text IS NULL OR pr.place_id = $2::text)
  ORDER BY pr.created_at DESC
  LIMIT $1`;

/**
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>} dbQuery pool.query
 * @param {number} limit outer LIMIT (Discover: 1–200; place page: use a sane cap e.g. 200)
 * @param {string | null} placeId when set, only rows for that place (Discover: null = all places)
 */
async function queryPublicOffers(dbQuery, limit, placeId = null) {
  const params = [limit, placeId];
  try {
    const { rows } = await dbQuery(SQL_MERGED, params);
    return rows;
  } catch (e) {
    if (e.code === '42P01') {
      const { rows } = await dbQuery(SQL_PROMO_ONLY, params);
      return rows;
    }
    throw e;
  }
}

module.exports = { queryPublicOffers };
