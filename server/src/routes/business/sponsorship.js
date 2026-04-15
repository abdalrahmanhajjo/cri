const express = require('express');
const Stripe = require('stripe');
const { getCollection } = require('../../mongo');
const { parsePlaceId } = require('../../utils/validate');
const { userManagesPlace } = require('../../middleware/placeOwner');
const { loadSiteSettings } = require('../../utils/siteSettingsLoad');
const {
  sponsorshipConfigFromSettings,
  assertCanStartPaidCheckout,
} = require('../../services/sponsorshipStripe');
const crypto = require('crypto');

const router = express.Router();

function buildSuccessUrl(base) {
  const u = String(base || '').trim();
  if (!u) return '';
  if (u.includes('{CHECKOUT_SESSION_ID}')) return u;
  return `${u}${u.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
}

/** GET /api/business/sponsorship/config */
router.get('/config', async (req, res) => {
  try {
    const settings = await loadSiteSettings();
    const cfg = sponsorshipConfigFromSettings(settings);
    const stripePriceId = process.env.STRIPE_PRICE_ID?.trim() || '';
    const paymentsReady = Boolean(process.env.STRIPE_SECRET_KEY?.trim() && (stripePriceId || cfg.sponsorshipAmountCents >= 50));
    res.json({
      sponsorshipEnabled: cfg.sponsorshipEnabled,
      sponsorshipDurationDays: cfg.sponsorshipDurationDays,
      sponsorshipAmountCents: cfg.sponsorshipAmountCents,
      sponsorshipCurrency: cfg.sponsorshipCurrency,
      stripePriceConfigured: Boolean(stripePriceId),
      paymentsReady,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sponsorship config' });
  }
});

/** POST /api/business/sponsorship/checkout-session */
router.post('/checkout-session', async (req, res) => {
  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!sk) return res.status(503).json({ error: 'Payments are not configured on the server.' });

  try {
    const settings = await loadSiteSettings();
    const cfg = sponsorshipConfigFromSettings(settings);
    if (!cfg.sponsorshipEnabled) {
      return res.status(403).json({ error: 'Sponsorship purchases are currently disabled.' });
    }

    const placeParsed = parsePlaceId(req.body?.placeId);
    if (!placeParsed.valid) return res.status(400).json({ error: 'placeId is required' });
    const placeId = placeParsed.value;

    const userId = req.user.userId;
    if (!(await userManagesPlace(userId, placeId))) {
      return res.status(403).json({ error: 'You do not manage this place.' });
    }

    const gate = await assertCanStartPaidCheckout(placeId, 'all');
    if (!gate.ok) return res.status(409).json({ error: gate.error });

    const successUrl = String(req.body?.successUrl || '').trim();
    const cancelUrl = String(req.body?.cancelUrl || '').trim();
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required.' });
    }

    const stripe = new Stripe(sk);
    const priceId = process.env.STRIPE_PRICE_ID?.trim();

    const purColl = await getCollection('sponsorship_purchases');
    const purchaseId = crypto.randomUUID();
    const newPurchase = {
      id: purchaseId,
      user_id: userId,
      place_id: placeId,
      status: 'pending',
      amount_cents: cfg.sponsorshipAmountCents,
      currency: cfg.sponsorshipCurrency,
      duration_days: cfg.sponsorshipDurationDays,
      surface: 'all',
      created_at: new Date(),
      updated_at: new Date()
    };
    await purColl.insertOne(newPurchase);

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: cfg.sponsorshipCurrency,
              unit_amount: cfg.sponsorshipAmountCents,
              product_data: {
                name: 'Sponsored placement — all surfaces',
                description: `${cfg.sponsorshipDurationDays} days on Home / Discover / Community feed.`,
              },
            },
            quantity: 1,
          },
        ];

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        success_url: buildSuccessUrl(successUrl),
        cancel_url: cancelUrl,
        client_reference_id: String(purchaseId),
        metadata: {
          purchaseId: String(purchaseId),
          placeId: String(placeId),
          userId: String(userId),
        },
      });

      await purColl.updateOne({ id: purchaseId }, { $set: { stripe_checkout_session_id: session.id } });

      return res.status(201).json({ url: session.url, purchaseId: String(purchaseId) });
    } catch (stripeErr) {
      await purColl.deleteOne({ id: purchaseId, status: 'pending' });
      console.error(stripeErr);
      return res.status(502).json({ error: stripeErr.message || 'Could not start checkout.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/** GET /api/business/sponsorship/session-status?session_id= */
router.get('/session-status', async (req, res) => {
  const sessionId = String(req.query.session_id || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

  try {
    const userId = req.user.userId;
    const purColl = await getCollection('sponsorship_purchases');
    
    const rows = await purColl.aggregate([
      { $match: { stripe_checkout_session_id: sessionId, user_id: userId } },
      { $lookup: {
          from: 'places',
          localField: 'place_id',
          foreignField: 'id',
          as: 'place'
      }},
      { $unwind: '$place' }
    ]).toArray();

    if (!rows.length) return res.status(404).json({ error: 'Session not found.' });
    const r = rows[0];
    res.json({
      status: r.status,
      startsAt: r.starts_at || null,
      endsAt: r.ends_at || null,
      placeId: r.place_id,
      placeName: r.place.name || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load session status.' });
  }
});

module.exports = router;
