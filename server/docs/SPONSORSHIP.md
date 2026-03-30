# Paid place sponsorship (Stripe)

Self-serve sponsorship lets verified **place owners** (Business portal) purchase a time-limited **all-surfaces** placement (`surface = all`). The API upserts [`sponsored_places`](../migrations/028_sponsored_places.sql) with `source = paid` after Stripe confirms payment.

## Prerequisites

1. Apply migrations through `029_sponsorship_purchases.sql` (from repo root: `npm run db:migrate --prefix server`).
2. In **Site settings → Features** (admin UI), enable **self-serve sponsorship** and set duration / price (cents + currency). If `STRIPE_PRICE_ID` is set on the server, the Dashboard price wins over `sponsorshipAmountCents`.
3. Configure Stripe environment variables on the API host (see below).
4. Register the webhook endpoint in the Stripe Dashboard: `POST https://YOUR_API_ORIGIN/api/webhooks/stripe` — subscribe at minimum to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`

Local testing:

```bash
stripe listen --forward-to localhost:3095/api/webhooks/stripe
```

Use the signing secret the CLI prints as `STRIPE_WEBHOOK_SECRET`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret API key (required for checkout). |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (required for `/api/webhooks/stripe`). |
| `STRIPE_PRICE_ID` | Optional. Fixed **Price** ID for Checkout; if set, ignores site-setting cents for line item. |
| `SPONSORSHIP_PAID_DEFAULT_RANK` | Optional. Integer rank for new paid rows (default `500`). Lower rank sorts earlier on public queries. |

See also placeholders in `server/.env.example`.

## Conflict rules

- Checkout is **blocked** if a row already exists for `(place_id, 'all')` with `source = admin`.
- Checkout is **blocked** while a **paid** row is still active (`enabled` and `ends_at` in the future).
- After a paid slot **expires**, a new purchase may upsert the same row.

## Operations

- **Admin → Sponsored places** shows `Source` (Admin vs Paid) and Stripe references; **Recent self-serve purchases** lists audit rows.
- Refunds: `charge.refunded` sets the purchase to `refunded` and sets `sponsored_places.enabled = false` for rows linked by `purchase_id`.
