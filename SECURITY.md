# Security

## Production checklist

- **Environment**
  - Set `NODE_ENV=production`.
  - Set `JWT_SECRET` to a long, random value (e.g. 32+ bytes). Auth and protected routes will return 503 if it is missing in production.
  - Set `CORS_ORIGIN` to your frontend origin(s), comma-separated (e.g. `https://yourapp.com`). Do not use a wildcard with `credentials: true`.

- **Server**
  - Serve the API over HTTPS. Helmet is configured with HSTS.
  - Keep dependencies updated: run `npm audit` in `server/` and address critical/high issues.

- **Auth**
  - Login and register are rate-limited (per-IP and global). Passwords are hashed with bcrypt; JWT is short-lived and signed with HS256.
  - Tokens are stored in the client (localStorage). Prefer HTTPS and secure cookie options if you move to cookie-based auth.

- **Input**
  - Route params (`id`, `placeId`) are validated as positive integers. Language is restricted to `en`, `ar`, `fr`. All DB access uses parameterized queries.

- **Headers**
  - Helmet sets X-Content-Type-Options, X-Frame-Options, HSTS, etc. CSP is disabled; enable and tune if you need it.
