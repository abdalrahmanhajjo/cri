# Operations and release discipline

This document supports **layer 4** goals: calm production operations, observability, and safe releases.

## Environment variables (server)

| Variable | Purpose |
|----------|---------|
| `LOG_FORMAT=json` | One JSON object per log line for log aggregators (Render, Datadog, etc.). |
| `DB_SLOW_QUERY_MS` | Log queries slower than this many ms (default `750`). Set `0` to disable. |
| `SENTRY_DSN` | Optional. When set (and not disabled below), the API loads `@sentry/node` and reports unhandled errors from the Express error handler. Use `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE` for filtering in Sentry. |
| `SENTRY_ENABLED` | Optional killswitch: `off`, `false`, `0`, or `no` disables Sentry even if `SENTRY_DSN` is set. |
| `GOOGLE_SITE_VERIFICATION` | Search Console HTML-tag value (injected by SEO middleware). |

**Site settings (`site_settings` row):** If the admin **Tagline** field still holds an old English sentence, the public home page used to show it for every language. The web app now falls back to **i18n** hero copy when the tagline is empty, matches the built-in default, or matches a few known legacy strings. To force a single custom line for all locales, save a **new** tagline in Admin → Settings; to rely on translations only, clear the tagline and save.

## Health and uptime

- **Liveness:** `GET /health` — process is up (used in `render.yaml`).
- **Readiness:** `GET /ready` — database reachable; use for monitors that should alert when the API cannot serve DB-backed routes.
- **Request correlation:** Responses include `X-Request-Id`; JSON error bodies include `id` for the same value.

## Web Vitals (real users)

The client sends Core Web Vitals to `POST /api/metrics/vitals` (rate-limited). With `LOG_FORMAT=json`, entries appear as `web_vitals` log lines for aggregation or BigQuery-style pipelines.

## Images and performance

- Admin uploads already enforce **MIME type** and extension (see `server/src/routes/admin/upload.js`).
- For smaller LCP: resize and compress **before** upload (e.g. max width 1600px, WebP/JPEG quality ~80). A future improvement is server-side resizing with `sharp` (not included yet).

## Database

- Migrations: `npm run db:migrate` from repo root (requires `DATABASE_URL`).
- Backups: use **Supabase** scheduled backups or Postgres dumps; test a restore at least once.
- After large data changes, review **indexes** on hot filters (places list, feed, reviews).

## Release checklist (short)

1. `npm test --prefix server` and `npm run build --prefix client` pass locally (same as CI).
2. Run pending **SQL migrations** against production.
3. Confirm **CORS_ORIGIN** and critical secrets on the host match the live site.
4. Deploy; smoke-test **home**, **discover**, **login**, and **/ready**.
5. Watch error rate and `slow_query` / `request_error` logs for ~30 minutes.

## Security hygiene

- Rotate **JWT_SECRET** and DB password if leaked; invalidate sessions if needed.
- Run `npm audit` in `client` and `server` regularly; CI runs a high-severity audit on push.
- **Gitleaks** runs on push/PR (`.github/workflows/gitleaks.yml`) to catch accidental secret commits.
- Re-read **OWASP Top 10** when adding new write endpoints or file uploads.

## Places API pagination

`GET /api/places?limit=50&offset=0` returns the same `popular` / `locations` arrays plus `page: { limit, offset, total, hasMore }`. Omit `limit` for the full list (backward compatible with the home page and existing clients).
