# Tripoli Explorer – Web

Web version of Tripoli Explorer: same theme and quality as the mobile app. **Separate Node.js backend** in this repo that connects to the **same database** as the mobile app (Postgres/Supabase).

## Structure

- **client/** – React (Vite) SPA – Explore, Map, Place/Tour/Event detail, Login, Register, Forgot password, Trips, Profile.
- **server/** – Node.js (Express) API – same DB as the Flutter app; auth, places, tours, events, categories, user profile, trips.

## Setup

### 1. Database (same as mobile app)

Use the **same database** as your Tripoli Explorer mobile app:

- If you use **Figma1 backend**: run migrations and seed from `Figma1/backend` once (`npm run db:migrate`, `npm run db:seed`). The web server only connects; it does not run migrations.
- Or use any Postgres/Supabase instance that has the Tripoli Explorer schema (users, profiles, places, place_translations, tours, tour_translations, events, event_translations, categories, category_translations, trips, email_verification_tokens, password_reset_tokens).

### 2. Web API (Node – this repo)

```bash
cd server
cp .env.example .env
# Edit .env: set DATABASE_URL (same as mobile app), JWT_SECRET, CORS_ORIGIN=http://localhost:5173
npm install
npm run dev
```

API runs at http://localhost:3000. Uses the same `DATABASE_URL` and (optionally) same `JWT_SECRET` as the mobile backend so accounts and data are shared.

### 3. Web client

```bash
cd client
cp .env.example .env
# .env: VITE_API_URL=http://localhost:3000 (default)
npm install
npm run dev
```

Open http://localhost:5173. Log in with the same account as the app; data comes from the same DB via this server.

## Server (.env)

| Variable        | Description |
|----------------|-------------|
| `PORT`         | API port (default 3000). |
| `DATABASE_URL` | Postgres connection string – **same DB as mobile app** (e.g. Supabase). |
| `JWT_SECRET`   | Secret for JWT (min 32 chars in production). Use same as Figma1 backend to share sessions. |
| `CORS_ORIGIN`  | Allowed origin(s), e.g. `http://localhost:5173`. |
| `UPLOADS_BASE_URL` | Optional: base URL for place/tour images. |

## Tech

- **Frontend:** React 18, Vite, React Router, CSS (theme variables).
- **Backend:** Node.js, Express, pg, JWT, bcrypt – same API shape as mobile backend.
- **DB:** Same Postgres/Supabase as the mobile app; no separate DB for web.
