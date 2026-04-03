const { getCollection, getDb } = require('../mongo');

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
  const spColl = await getCollection('sponsored_places');
  const row = await spColl.findOne({ place_id: placeId, surface });
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

  const db = await getDb();
  const mongoSession = db.client.startSession();
  
  try {
    await mongoSession.withTransaction(async () => {
      const spColl = db.collection('sponsored_places');
      const purColl = db.collection('sponsorship_purchases');

      const pur = await purColl.findOne({ id: purchaseId }, { session: mongoSession });
      if (!pur) {
        console.warn('[sponsorship] purchase not found', purchaseId);
        return;
      }
      if (pur.status === 'active') return;
      if (pur.status !== 'pending' && pur.status !== 'paid') return;

      const placeId = String(pur.place_id);
      const surface = String(pur.surface || 'all');
      const userId = pur.user_id;
      const durationDays = Math.max(1, parseInt(String(pur.duration_days), 10) || 30);

      const starts = new Date();
      const ends = new Date(starts);
      ends.setUTCDate(ends.getUTCDate() + durationDays);

      const spDoc = {
        place_id: placeId,
        surface: surface,
        rank: PAID_RANK,
        enabled: true,
        starts_at: starts,
        ends_at: ends,
        source: 'paid',
        purchase_id: purchaseId,
        purchased_by_user_id: userId,
        updated_at: new Date()
      };

      const existingSP = await spColl.findOne({ place_id: placeId, surface: surface }, { session: mongoSession });
      const spId = existingSP ? existingSP.id : require('crypto').randomUUID();
      if (!existingSP) spDoc.id = spId;
      if (!existingSP) spDoc.created_at = new Date();

      await spColl.replaceOne({ place_id: placeId, surface: surface }, spDoc, { upsert: true, session: mongoSession });

      const amountParam = typeof amountTotal === 'number' && Number.isFinite(amountTotal) ? Math.round(amountTotal) : null;

      await purColl.updateOne(
        { id: purchaseId },
        {
          $set: {
            status: 'active',
            stripe_payment_intent_id: stripePaymentIntentId || pur.stripe_payment_intent_id,
            amount_cents: amountParam || pur.amount_cents,
            currency: currency || pur.currency,
            sponsored_place_id: spId,
            starts_at: starts,
            ends_at: ends,
            updated_at: new Date()
          }
        },
        { session: mongoSession }
      );
    });
  } catch (e) {
    console.error('[sponsorship] applyCheckoutSessionCompleted error:', e);
    throw e;
  } finally {
    await mongoSession.endSession();
  }
}

async function markCheckoutSessionExpired(sessionId) {
  const purColl = await getCollection('sponsorship_purchases');
  await purColl.updateOne(
    { stripe_checkout_session_id: sessionId, status: 'pending' },
    { $set: { status: 'canceled', updated_at: new Date() } }
  );
}

async function markRefundedByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return;
  const purColl = await getCollection('sponsorship_purchases');
  const spColl = await getCollection('sponsored_places');

  const rows = await purColl.find({
    stripe_payment_intent_id: String(paymentIntentId),
    status: { $nin: ['refunded', 'canceled'] }
  }).toArray();

  for (const r of rows) {
    await purColl.updateOne({ id: r.id }, { $set: { status: 'refunded', updated_at: new Date() } });
    await spColl.updateOne({ purchase_id: r.id }, { $set: { enabled: false, updated_at: new Date() } });
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