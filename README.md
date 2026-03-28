# Tripoli Explorer – Web

Web version of Tripoli Explorer: same theme and quality as the mobile app. **Separate Node.js backend** in this repo that connects to the **same database** as the mobile app (Postgres/Supabase).

## Structure

- **client/** – React (Vite) SPA – Explore, Map, Place/Tour/Event detail, Login, Register, Trips, Profile.
- **server/** – Node.js (Express) API – same DB as the Flutter app; auth, places, tours, events, categories, user profile, trips.
- **server/src/index.js** – Process bootstrap: loads `.env`, validates production env, starts HTTP server, graceful shutdown, DB pool drain.
- **server/src/app.js** – Express application only (Helmet CSP, CORS, rate limits, routes, `/health` + `/ready`, error handler). Used by tests via `require('./app')`.

## Setup

### 1. Database (same as mobile app)

Use the **same database** as your Tripoli Explorer mobile app:

- If you use **Figma1 backend**: run migrations and seed from `Figma1/backend` once (`npm run db:migrate`, `npm run db:seed`). The web server only connects; it does not run migrations.
- Or use any Postgres/Supabase instance that has the Tripoli Explorer schema (users, profiles, places, place_translations, tours, tour_translations, events, event_translations, categories, category_translations, trips, email_verification_tokens, password_reset_tokens).

### 2. Web API (Node – this repo)

```bash
cd server
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, CORS_ORIGIN=http://localhost:5173, PORT=3095 (default)
npm install
npm run dev
```

The API listens on **http://localhost:3095** by default (`PORT`). **GET /health** is liveness; **GET /ready** runs `SELECT 1` and returns **503** if Postgres is unreachable.

From the **repo root**, run **`npm run db:migrate`** once `DATABASE_URL` is set so web-specific tables exist (including **`auth_abuse_tracking`** in migration `018` — shared login / forgot-password / reset-password limits and verification-email cooldown across all API instances). Set **`AUTH_ABUSE_STORE=memory`** only if you want in-process counters (single instance, no migration).

**Production:** `DATABASE_URL`, `JWT_SECRET`, and **`CORS_ORIGIN`** are required at boot (the process exits if they are missing). Use comma-separated origins or `*` only for controlled testing.

### 3. Web client

```bash
cd client
cp .env.example .env
```

**Local dev:** leave **`VITE_API_URL` empty** so Vite proxies `/api` and `/uploads` to the API (**`DEV_API_PROXY_TARGET`**, default `http://127.0.0.1:3095`). Do not use port **3000** for this API.

**Split hosting:** set **`VITE_API_URL`** to your public API origin (no trailing slash).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Server (.env)

| Variable        | Description |
|----------------|-------------|
| `PORT`         | API port (default **3095**). |
| `HOST`         | Bind address (default `0.0.0.0`). |
| `DATABASE_URL` | Postgres connection string – **same DB as mobile app** (e.g. Supabase). |
| `JWT_SECRET`   | Secret for JWT (min 32 chars in production). |
| `CORS_ORIGIN`  | Comma-separated browser origins, or `*`. **Required in production** (fail-closed at boot if unset). |
| `UPLOADS_BASE_URL` | Optional: public base for `/uploads/*` when using local disk + split hosting. |
| `SERVE_CLIENT_DIST` | `true` to serve the built SPA from Node (Docker / single VM). |
| `AUTH_ABUSE_STORE` | Set to `memory` to keep auth abuse counters in RAM only (default: use Postgres when `DATABASE_URL` is set). |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` (repo root) | API + Vite together |
| `npm run test` (repo root) | Server Jest smoke tests (`/health`, `/ready`) |
| `npm run build --prefix client` | Production client bundle |

## Tech

- **Frontend:** React 19, Vite, React Router, CSS (theme variables).
- **Backend:** Node.js, Express, `pg`, JWT, bcrypt.
