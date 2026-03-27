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

API runs at http://localhost:3095. Uses the same `DATABASE_URL` and (optionally) same `JWT_SECRET` as the mobile backend so accounts and data are shared.

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
| `PORT`         | API port (default 3095). |
| `DATABASE_URL` | Postgres connection string – **same DB as mobile app** (e.g. Supabase). |
| `JWT_SECRET`   | Secret for JWT (min 32 chars in production). Use same as Figma1 backend to share sessions. |
| `CORS_ORIGIN`  | Allowed origin(s), e.g. `http://localhost:5173`. In production, this must be set (fail-closed). |
| `UPLOADS_BASE_URL` | Optional: base URL for place/tour images. |
| `SERVE_CLIENT_DIST` | Set to `true` to serve the built React app from the Node server (Docker/Production). |

## Database Ownership

> [!IMPORTANT]
> This repository **does not own** the primary database schema. The schema is shared with the [Tripoli Explorer Mobile App](https://github.com/abdalrahmanhajjo/VisitTripoliApp).
> - **Schema updates**: Should be performed in the mobile app / Figma1 backend repository.
> - **Migrations**: This repo contains migrations for web-specific features, but core tables are shared.

## Environment Variables

### Build-time vs. Runtime
- **Vite (Client)**: Variables prefixed with `VITE_` are inlined into the frontend bundle at **build time**. If you are using Docker, these must be passed as `--build-arg` or set in the environment during `npm run build`.
- **Node (Server)**: Environment variables are read at **runtime** from `.env` or the host system.

## Tech

- **Frontend:** React 18, Vite, React Router, CSS (theme variables).
- **Backend:** Node.js, Express, pg, JWT, bcrypt – same API shape as mobile backend.
- **DB:** Same Postgres/Supabase as the mobile app; no separate DB for web.
