const { pool, query } = require('../db');

const PAID_RANK = (() => {
  const n = parseInt(process.env.SPONSORSHIP_PAID_DEFAULT_RANK || '500', 10);
  return Number.isFinite(n) ? n : 500;
})();

function sponsorshipConfigFromSettings(settings) {
  const root = settings && typeof settings === 'object' ? settings : {};
  return {
    sponsorshipEnabled: root.sponsorshipEnabled === true,
    sponsorshipDurationDays: Math.min(
      365,
      Math.max(1, parseInt(String(root.sponsorshipDurationDays ?? 30), 10) || 30)
    ),
    sponsorshipAmountCents: Math.max(
      50,
      parseInt(String(root.sponsorshipAmountCents ?? 4999), 10) || 4999
    ),
    sponsorshipCurrency:
      String(root.sponsorshipCurrency || 'usd')
        .trim()
        .toLowerCase()
        .slice(0, 12) || 'usd',
  };
}

async function assertCanStartPaidCheckout(placeId, surface = 'all') {
  const { rows } = await query(
    `SELECT id, source, enabled, ends_at
     FROM sponsored_places
     WHERE place_id = $1 AND surface = $2`,
    [placeId, surface]
  );
  const row = rows[0];
  if (!row) return { ok: true };
  if (row.source === 'admin') {
    return {
      ok: false,
      error:
        'This place has a curated admin sponsorship on this surface. Remove it in admin or use another channel.',
    };
  }
  const ends = row.ends_at ? new Date(row.ends_at) : null;
  const activeWindow = row.enabled && (ends == null || Number.isNaN(ends.getTime()) || ends > new Date());
  if (activeWindow) {
    return {
      ok: false,
      error: 'A paid sponsorship is already active for this place. Renew when it ends.',
    };
  }
  return { ok: true };
}

/**
 * Apply paid placement after Stripe checkout.session.completed (idempotent).
 */
async function applyCheckoutSessionCompleted(session) {
  const purchaseId = session.metadata?.purchaseId ? String(session.metadata.purchaseId).trim() : '';
  if (!purchaseId) {
    console.warn('[sponsorship] checkout.session.completed missing metadata.purchaseId');
    return;
  }

  const stripePaymentIntentId = session.payment_intent ? String(session.payment_intent) : null;
  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;
  const currency = session.currency ? String(session.currency).toLowerCase() : 'usd';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: purRows } = await client.query(
      `SELECT id, user_id, place_id, surface, duration_days, status, sponsored_place_id
       FROM sponsorship_purchases
       WHERE id = $1
       FOR UPDATE`,
      [purchaseId]
    );
    const pur = purRows[0];
    if (!pur) {
      await client.query('ROLLBACK');
      console.warn('[sponsorship] purchase not found', purchaseId);
      return;
    }
    if (pur.status === 'active') {
      await client.query('COMMIT');
      return;
    }
    if (pur.status !== 'pending' && pur.status !== 'paid') {
      await client.query('COMMIT');
      return;
    }

    const placeId = String(pur.place_id);
    const surface = String(pur.surface || 'all');
    const userId = pur.user_id;
    const durationDays = Math.max(1, parseInt(String(pur.duration_days), 10) || 30);

    const starts = new Date();
    const ends = new Date(starts);
    ends.setUTCDate(ends.getUTCDate() + durationDays);

    const { rows: upsertRows } = await client.query(
      `INSERT INTO sponsored_places
         (place_id, surface, rank, enabled, starts_at, ends_at, source, purchase_id, purchased_by_user_id,
          created_at, updated_at)
       VALUES ($1, $2, $3, true, $4::timestamptz, $5::timestamptz, 'paid', $6, $7, NOW(), NOW())
       ON CONFLICT (place_id, surface) DO UPDATE SET
         rank = EXCLUDED.rank,
         enabled = true,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         source = 'paid',
         purchase_id = EXCLUDED.purchase_id,
         purchased_by_user_id = EXCLUDED.purchased_by_user_id,
         updated_at = NOW()
       RETURNING id`,
      [placeId, surface, PAID_RANK, starts.toISOString(), ends.toISOString(), purchaseId, userId]
    );

    const spId = upsertRows[0]?.id;

    const amountParam = typeof amountTotal === 'number' && Number.isFinite(amountTotal) ? Math.round(amountTotal) : null;

    await client.query(
      `UPDATE sponsorship_purchases SET
         status = 'active',
         stripe_payment_intent_id = COALESCE($2::text, stripe_payment_intent_id),
         amount_cents = COALESCE($3::int, amount_cents),
         currency = COALESCE(NULLIF($4::text, ''), currency),
         sponsored_place_id = $5,
         starts_at = $6::timestamptz,
         ends_at = $7::timestamptz,
         updated_at = NOW()
       WHERE id = $1`,
      [purchaseId, stripePaymentIntentId, amountParam, currency || null, spId || null, starts.toISOString(), ends.toISOString()]
    );

    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

async function markCheckoutSessionExpired(sessionId) {
  await query(
    `UPDATE sponsorship_purchases SET status = 'canceled', updated_at = NOW()
     WHERE stripe_checkout_session_id = $1 AND status = 'pending'`,
    [sessionId]
  );
}

async function markRefundedByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return;
  const { rows } = await query(
    `UPDATE sponsorship_purchases SET status = 'refunded', updated_at = NOW()
     WHERE stripe_payment_intent_id = $1 AND status NOT IN ('refunded', 'canceled')
     RETURNING id`,
    [String(paymentIntentId)]
  );
  for (const r of rows) {
    await query(
      `UPDATE sponsored_places SET enabled = false, updated_at = NOW()
       WHERE purchase_id = $1`,
      [r.id]
    );
  }
}

async function handleStripeWebhook(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await applyCheckoutSessionCompleted(event.data.object);
      break;
    case 'checkout.session.expired':
      await markCheckoutSessionExpired(event.data.object?.id);
      break;
    case 'charge.refunded': {
      const pi = event.data.object?.payment_intent;
      if (pi) await markRefundedByPaymentIntent(typeof pi === 'string' ? pi : pi.id);
      break;
    }
    default:
      break;
  }
}

module.exports = {
  sponsorshipConfigFromSettings,
  assertCanStartPaidCheckout,
  applyCheckoutSessionCompleted,
  handleStripeWebhook,
  PAID_RANK,
};