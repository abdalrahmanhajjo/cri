const express = require('express');
const Stripe = require('stripe');
const { handleStripeWebhook } = require('../services/sponsorshipStripe');

const router = express.Router();

router.post('/', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !sk) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY are required');
    return res.status(503).send('Webhook not configured');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    const stripe = new Stripe(sk);
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.warn('[stripe webhook] signature verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeWebhook(event);
  } catch (e) {
    console.error('[stripe webhook] handler error', e);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

module.exports = router;
