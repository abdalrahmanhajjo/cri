# Tripoli Explorer Web — full in-repo code guide

This file explains how the project is wired. It uses **line-by-line notes** for small entry files, **line-range / block notes** for large modules, and a **short purpose line for every source file** under `client/src` and `server/src`.

**Scope:** There are well over 200 application source files. Explaining every line of every file would be longer than the code itself. This guide gives enough context to read any file, plus exact explanations for bootstrap files.

---

## Table of contents

1. [Repository layout](#1-repository-layout)
2. [Root package.json — line by line](#2-root-packagejson--line-by-line)
3. [Client package.json — line by line](#3-client-packagejson--line-by-line)
4. [Server package.json — line by line](#4-server-packagejson--line-by-line)
5. [Client vite.config.js — blocks](#5-client-viteconfigjs--blocks)
6. [Server src/index.js — line by line](#6-server-srcindexjs--line-by-line)
7. [Server src/app.js — line ranges](#7-server-srcappjs--line-ranges)
8. [Client src/main.jsx — line by line](#8-client-srcmainjsx--line-by-line)
9. [Client src/App.jsx — structure and routes](#9-client-srcappjsx--structure-and-routes)
10. [Client src/api/client.js — how to read it](#10-client-srcapiclientjs--how-to-read-it)
11. [Every file under server/src](#11-every-file-under-serversrc)
12. [Every file under client/src](#12-every-file-under-clientsrc)
13. [Scripts outside src](#13-scripts-outside-src)

---

## 1. Repository layout

| Path | Role |
|------|------|
| `package.json` (root) | Runs **client** and **server** together (`npm run dev`), build, test, migrate. |
| `client/` | React + Vite SPA (public site, admin, business portal). |
| `server/` | Express API: Postgres (Supabase-compatible), JWT, uploads, Stripe, optional MongoDB. |
| `docs/` | Documentation (this file). |

**Data flow:** Browser → Vite dev proxy `/api` → Express → Postgres/Mongo/services → JSON to React.

---

## 2. Root `package.json` — line by line

| Line | Meaning |
|------|---------|
| 1 | `"name": "tripoli-explorer-web"` — npm package name for the repo root. |
| 2 | `"private": true` — not published to npm. |
| 4 | `"scripts": {` — commands from the **repo root**. |
| 5 | `"dev"` — `concurrently` runs API (`server`) and web (`client`) in one terminal. |
| 7 | `"build"` — production **client** build → `client/dist`. |
| 8 | `"build:client"` — alias of `build`. |
| 9 | `"start:server"` — run **server** only (`npm run start --prefix server`). |
| 10 | `"quality"` — ensures **client** builds. |
| 11 | `"test"` — Jest in `server/`. |
| 12 | `"db:migrate"` — forwards to server migrations. |
| 14–16 | `devDependencies`: `concurrently`, `supabase` CLI. |

---

## 3. Client `package.json` — line by line

| Line | Meaning |
|------|---------|
| 1–4 | Package `client`, **`"type": "module"`** → ESM imports in `.js`. |
| 5–13 | Scripts: `dev` (Vite), `prebuild` favicons, `build`, `lint`, `preview`, asset scripts. |
| 15–21 | Deps: Leaflet, React 19, react-router-dom, web-vitals. |
| 23–35 | DevDeps: ESLint, Vite, `@vitejs/plugin-react`, types, favicon tooling. |

---

## 4. Server `package.json` — line by line

| Line | Meaning |
|------|---------|
| 1–5 | **`main`: `src/index.js`** — process entry. |
| 6–14 | `start` / `dev` (watch), `test`, DB/export/mongo/recompress scripts. |
| 16–37 | Express, `pg`, JWT, bcrypt, CORS, helmet, rate limit, multer, sharp, Stripe, Sentry, MongoDB, etc. |
| 39–41 | Jest + Supertest. |

---

## 5. Client `vite.config.js` — blocks

| Lines (approx.) | What it does |
|-----------------|--------------|
| 1–10 | Imports Vite, React plugin, city hero preload, default SEO from `config/siteSeo.js`. |
| 12–19 | `escAttr` — escape strings for HTML attributes. |
| 21–61 | `buildStaticSeoHead` — meta/OG/Twitter tags + optional JSON-LD when `VITE_PUBLIC_SITE_URL` is set. |
| 64–68 | `DEV_API_PROXY_TARGET` default `http://127.0.0.1:3095` (matches API; avoids Windows localhost IPv6 issues). |
| 70–74 | Optional Supabase `preconnect` if origin looks like `*.supabase.co`. |
| 77–114 | Custom plugin: `transformIndexHtml` injects SEO, preconnect, hero `imagesrcset`, Google client id meta, font preloads. |
| 115–117 | `resolve.dedupe` for React. |
| 118–134 | Build: chunk size warning; `manualChunks` for i18n and React packages. |
| 135–140 | Dev **`server.proxy`**: `/api` and `/uploads` → Node API. |

---

## 6. Server `src/index.js` — line by line

| Line | Meaning |
|------|---------|
| 1–2 | `fs`, `path` for optional root `.env`. |
| 3–8 | Load **`server/.env`** first (override), then repo-root **`.env`** if present. |
| 10 | `isProd` from `NODE_ENV`. |
| 13–28 | Production: exit if required env vars missing (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`). |
| 29–31 | Dev: warn if `JWT_SECRET` unset. |
| 33–34 | Initialize Sentry. |
| 36 | Load Express **`app`** (no listen). |
| 38–43 | Mongo connection helpers. |
| 45–46 | `PORT` (default **3095**), `HOST` (default `0.0.0.0`). |
| 48–67 | **`listen`** — log URLs, AI config, Mongo/Sentry status; optional Mongo verify. |
| 69–76 | Long **`HTTP_SERVER_TIMEOUT_MS`** for uploads/ffmpeg. |
| 78–86 | Handle **port in use** (EADDRINUSE). |
| 88–101 | **Graceful shutdown**: close server + Mongo on SIGTERM/SIGINT. |
| 103–104 | Register signal handlers. |

---

## 7. Server `src/app.js` — line ranges

| Lines (approx.) | Purpose |
|-----------------|--------|
| 1–8 | Requires: express, security, helmet, cors, etc. |
| 10–56 | Require all route modules + SEO + DB error helpers. |
| 58 | `const app = express()`. |
| 61–67 | **`trust proxy`** for reverse proxies (Render/nginx). |
| 69–76 | `envInt()` helper. |
| 78–86 | Rate limits and `JSON_BODY_LIMIT`. |
| 88–91 | Production flag and CORS origin list. |
| 93 | `app.disable("x-powered-by")`. |
| 95–100 | Request UUID `req.id` + `X-Request-Id`. |
| 102–151 | **Helmet** CSP and related headers (Maps, GTM, Google Sign-In, etc.). |
| 153 | `compression()`. |
| 155–158 | **Stripe webhook** with `express.raw` before JSON parser. |
| 160–162 | `express.json`, `sanitizeBody`. |
| 169–201 | **CORS** middleware. |
| 203–211 | Optional `X-Session-Code` → `req.sessionCode`. |
| 213–215 | Health + metrics routes. |
| 217–290 | Rate limits per route prefix (`/api`, auth, admin, business, coupons, AI). |
| 270 | Static `/uploads`. |
| 272–314 | Mount **all** API routers (public + user + admin + business). |
| 316–341 | Optional **`SERVE_CLIENT_DIST`**: SEO routes + static `client/dist` + SPA fallback. |
| 343–375 | Multer/upload errors → clear JSON errors. |
| 377–404 | Global error handler (DB 503 vs generic 500, Sentry). |
| 406 | `module.exports = app`. |

---

## 8. Client `src/main.jsx` — line by line

| Line | Meaning |
|------|---------|
| 1 | `StrictMode` for dev checks. |
| 2 | `createRoot` from `react-dom/client`. |
| 3 | `ErrorBoundary` wraps the tree. |
| 4 | `SiteSettingsProvider` loads global settings. |
| 5–6 | Import **`theme.css`** and **`index.css`**. |
| 7 | Root **`App`**. |
| 8 | `reportWebVitals`. |
| 9–10 | Set HTML **`data-theme`** and **`color-scheme`** to light for first paint. |
| 11 | Run web vitals. |
| 13–20 | Mount: StrictMode → ErrorBoundary → SiteSettingsProvider → App. |

---

## 9. Client `src/App.jsx` — structure and routes

- **Imports:** Router, contexts (`Auth`, `Favourites`, `Language`, `Toast`), `api`/`getToken`/`getStoredUser`, `Layout`, `ScrollToTop`, eager **Explore** + **BusinessGateLoader**, many **`lazy()`** page chunks.
- **`LazyBoundary`:** `Suspense` + loading gate.
- **`ProtectedRoute`:** requires login; saves return URL in `state.from`.
- **`AdminRoute`:** requires `user.isAdmin`; uses cached admin flag to reduce flicker.
- **`BusinessRoute`:** calls **`api.business.me()`** to confirm owner access; **`BusinessRouteWithKey`** remounts on user id change.
- **Legacy redirects:** `/discover/place/:id` → `/community/place/:id`; `/ways` → `/discover`.
- **`AppRoutes`:** defines `/business/*`, `/admin/*`, auth routes, then **`Layout`** with all public/protected nested routes (community, discover, dining, hotels, map, plan, AI planner, SEO landings, trips, favourites, messages, profile, `*` → home).
- **Default `App`:** `BrowserRouter` → `ScrollToTop` → providers → `AppRoutes`.

---

## 10. Client `src/api/client.js` — how to read it

Read in layers: (1) **URL/image helpers** and `getApiOrigin`; (2) **session** storage keys; (3) **fetch** with retries, GET dedupe, abort support; (4) **`request`** / JSON parsing / errors; (5) exported **`api`** namespaces matching **`/api/...`** on the server.

---

## 11. Every file under `server/src`

### Root
- **`app.js`** — Express app, middleware, routes, optional SPA, errors.
- **`index.js`** — Env, listen, shutdown.
- **`instrumentSentry.js`** — Sentry.

### `middleware/`
- **`admin.js`** — Admin-only.
- **`auth.js`** — JWT → `req.user`.
- **`placeOwner.js`** — Owns place checks.
- **`publicCache.js`** — Cache headers.
- **`security.js`** — `sanitizeBody`.

### `mongo/index.js`
- Optional MongoDB client lifecycle.

### `repositories/publicContent.js`
- Public content queries.

### `routes/` (top level)
- **`health.js`** — `/health`, `/ready`.
- **`metrics.js`** — Metrics.
- **`auth.js`** — Auth endpoints.
- **`places.js`**, **`tours.js`**, **`events.js`**, **`categories.js`**, **`interests.js`** — Public catalogs.
- **`feed.js`**, **`userFeed.js`** — Community feed.
- **`promotionsPublic.js`**, **`coupons.js`**, **`siteSettingsPublic.js`**, **`sponsoredPlacesPublic.js`**, **`weatherPublic.js`** — Public APIs.
- **`profile.js`**, **`trips.js`** — User profile and trips.
- **`ai.js`** — AI planner backend.
- **`stripeWebhook.js`** — Stripe webhooks.

### `routes/admin/*`
- CRUD and moderation: places, categories, tours, events, content, upload, stats, users, all-trips, feed, interests, place-owners, site-settings, place-promotions, sponsored-places, sponsorship-purchases, coupons, email-broadcast.

### `routes/business/*`
- **`index.js`** — Mounts business routers.
- **`places.js`**, **`feed.js`**, **`upload.js`**, **`promotions.js`**, **`sponsorship.js`**, **`insights.js`**, **`messagingBlocks.js`**, **`proposals.js`** — Owner flows.

### `seo/`
- **`seoRoutes.js`**, **`seoUtils.js`** — SEO HTML when serving `client/dist`.

### `services/`
- **`emailService.js`**, **`sponsorshipStripe.js`** — Email and Stripe helpers.

### `utils/` (server)
- Validation (`validate*`, username/password validators), **`dbHttpError`**, **`logger`**, **`requestLang`**, **`normalizeDbText`**, **`sqlIdentifiers`**, **`uploadLimits`**, image/feed/video helpers (`imageUpload`, `imagekit`, `feedPost*`, `reelVideoTranscode`), **`businessPlaceValidation`**, **`authAbuseTracking`**, **`publicOffers`**, **`activeOfferFilters`**, **`geo`**, **`messagingBlocks`**, **`inquiryFollowups`**, **`siteSettingsLoad`**.

---

## 12. Every file under `client/src`

### Root
- **`main.jsx`**, **`App.jsx`**, **`ErrorBoundary.jsx`**, **`reportWebVitals.js`** — Boot and errors.

### `api/client.js`
- All HTTP to backend.

### `components/`
- **`Layout`**, **`ScrollToTop`**, **`GlobalSearchBar`**, **`Icon`**, feed/cards/maps/onboarding/HCI — UI building blocks.

### `config/`
- SEO defaults, icons, Google Sign-In, home visuals, plan areas, tagline resolver.

### `constants/cityHero.js`
- Hero responsive image attributes for Vite preload.

### `context/`
- **`AuthContext`**, **`LanguageContext`**, **`SiteSettingsContext`**, **`FavouritesContext`**, **`ToastContext`**.

### `data/aiPlannerTrainingData.js`
- Static AI planner examples.

### `i18n/translations.js`
- Translation strings.

### `pages/` (public)
- Explore, Discover, places (detail/dining/hotels/discover), Map, Plan, AiPlanner, activities/events/experiences, trips, favourites, messages, profile, auth pages, **`SeoLanding`**, BacklinkKit, FindYourWay, etc.

### `pages/admin/`
- **`AdminApp`**, **`AdminLayout`**, dashboards and CRUD screens for places, users, settings, feed, translations, email, etc.

### `pages/business/`
- **`BusinessApp`**, dashboard, place edit, feed, sponsorship flows.

### `services/aiPlannerService.js`
- Client-side AI planner orchestration.

### `utils/` (client)
- **`apiOrigin`**, analytics, debounce, async pool, safe URLs, images, search/ranking, trip helpers, AI planner memory/prefs, feed/map/geo helpers, password/username rules, admin helpers, etc.

---

## 13. Scripts outside `src`

- **`server/scripts/`** — migrations, DB tools, media pipelines.
- **`client/scripts/`** — favicons and asset optimization.

---

## Suggested reading order

1. Root `package.json` → `server/src/index.js` → `server/src/app.js`.
2. `client/vite.config.js` → `client/src/main.jsx` → `client/src/App.jsx`.
3. Pick one feature (e.g. places): `server/src/routes/places.js` + matching methods in `client/src/api/client.js` + `client/src/pages/PlaceDetail.jsx`.


---

## 14. Complete per-file index (one line each)

### `server/src` — files A–Z

| File | Purpose |
|------|---------|
| `app.js` | Express application: security middleware, rate limits, mount all `/api` routes, optional SPA static hosting, global error handling. |
| `index.js` | Process bootstrap: load `.env`, validate production env, Sentry, `app.listen`, graceful shutdown, Mongo. |
| `instrumentSentry.js` | Initialize `@sentry/node` and export helpers (`captureException`, enabled check). |
| `middleware/admin.js` | Require admin role / allow-list for `/api/admin/*`. |
| `middleware/auth.js` | Parse JWT, attach `req.user`, reject unauthorized. |
| `middleware/placeOwner.js` | Ensure the authenticated user owns the place referenced in the request. |
| `middleware/publicCache.js` | Set HTTP caching headers for safe public GET responses. |
| `middleware/security.js` | `sanitizeBody` and related request hardening. |
| `mongo/index.js` | MongoDB client singleton: connect, health check, close on shutdown. |
| `repositories/publicContent.js` | SQL/data access helpers for aggregated public content. |
| `routes/admin/allTrips.js` | Admin API: inspect or manage all users trips. |
| `routes/admin/categories.js` | Admin API: create/update/delete categories and translations. |
| `routes/admin/content.js` | Admin API: editable site content blocks. |
| `routes/admin/couponsMgmt.js` | Admin API: coupon campaigns management. |
| `routes/admin/emailBroadcast.js` | Admin API: send or schedule broadcast emails. |
| `routes/admin/events.js` | Admin API: events CRUD. |
| `routes/admin/feed.js` | Admin API: moderate or edit community feed posts. |
| `routes/admin/interests.js` | Admin API: manage interest tags. |
| `routes/admin/placeOwners.js` | Admin API: assign users as owners of places. |
| `routes/admin/placePromotions.js` | Admin API: per-place promotion scheduling. |
| `routes/admin/places.js` | Admin API: full places CRUD and related fields. |
| `routes/admin/siteSettings.js` | Admin API: key/value site settings. |
| `routes/admin/sponsoredPlaces.js` | Admin API: sponsored discovery slots. |
| `routes/admin/sponsorshipPurchases.js` | Admin API: view sponsorship purchase records. |
| `routes/admin/stats.js` | Admin API: dashboard statistics queries. |
| `routes/admin/tours.js` | Admin API: tours CRUD. |
| `routes/admin/upload.js` | Admin API: image/file uploads (disk or cloud pipeline). |
| `routes/admin/users.js` | Admin API: list/edit users (roles, flags). |
| `routes/ai.js` | Public/user AI planner endpoints (LLM or webhook bridge). |
| `routes/auth.js` | Register, login, refresh, Google OAuth token verify, password reset, email verification. |
| `routes/business/feed.js` | Business API: create/edit feed posts for owned places. |
| `routes/business/index.js` | Mounts all `./routes/business/*` routers under `/api/business`. |
| `routes/business/insights.js` | Business API: owner analytics / metrics. |
| `routes/business/messagingBlocks.js` | Business API: configure inquiry/messaging blocks. |
| `routes/business/places.js` | Business API: update owned place fields (non-admin). |
| `routes/business/promotions.js` | Business API: owner-managed promotions. |
| `routes/business/proposals.js` | Business API: proposals or partnerships workflow. |
| `routes/business/sponsorship.js` | Business API: start sponsorship checkout, status. |
| `routes/business/upload.js` | Business API: uploads for owner content. |
| `routes/categories.js` | Public API: list categories for browsing filters. |
| `routes/coupons.js` | Public API: validate or redeem coupons per rules. |
| `routes/events.js` | Public API: list/filter events, single event payload. |
| `routes/feed.js` | Public API: read community feed (paging, filters). |
| `routes/health.js` | `GET /health` liveness; `GET /ready` DB connectivity. |
| `routes/interests.js` | Public API: list interests for onboarding/profile. |
| `routes/metrics.js` | Internal/ops metrics (request counts, etc.). |
| `routes/places.js` | Public API: places discovery and detail by id/slug. |
| `routes/profile.js` | Authenticated API: profile fields, favourites sync hooks, related user endpoints. |
| `routes/promotionsPublic.js` | Public API: active promotions for map/cards. |
| `routes/siteSettingsPublic.js` | Public API: non-secret site settings for SPA boot. |
| `routes/sponsoredPlacesPublic.js` | Public API: sponsored placements for home/discover. |
| `routes/stripeWebhook.js` | `POST` Stripe webhook: verify signature, update orders/subscriptions. |
| `routes/tours.js` | Public API: tours listing and detail. |
| `routes/trips.js` | Authenticated API: user trips CRUD. |
| `routes/userFeed.js` | Authenticated API: personalized feed / follows. |
| `routes/weatherPublic.js` | Public API: weather proxy or computed hints for UI. |
| `seo/seoRoutes.js` | Special routes when serving `client/dist` (bot-friendly responses). |
| `seo/seoUtils.js` | HTML helpers: canonical base URL, inject favicon links in `index.html`. |
| `services/emailService.js` | Nodemailer transport: send transactional emails. |
| `services/sponsorshipStripe.js` | Stripe Checkout/Customer helpers for sponsorship products. |
| `utils/activeOfferFilters.js` | SQL WHERE fragments or filters for time-valid offers. |
| `utils/authAbuseTracking.js` | Track login/forgot-password abuse in DB or memory. |
| `utils/businessPlaceValidation.js` | Shared validation for business-submitted place payloads. |
| `utils/dbHttpError.js` | Detect DB connectivity errors → 503 + safe client message. |
| `utils/feedImageUrls.js` | Normalize or sign image URLs in feed JSON. |
| `utils/feedPostAccess.js` | Authorization rules for who can read/write a feed post. |
| `utils/feedPostPayload.js` | Validate/normalize feed post JSON shape. |
| `utils/feedVideoUploadPrepare.js` | Prepare reel upload (temp paths, limits). |
| `utils/geo.js` | Haversine/bounds helpers for geo queries. |
| `utils/imagekit.js` | ImageKit SDK wrapper (upload, URL transformation). |
| `utils/imageUpload.js` | Multer pipeline: images to disk or ImageKit. |
| `utils/inquiryFollowups.js` | Logic for follow-up messages after inquiries. |
| `utils/logger.js` | Structured JSON logs vs plain console. |
| `utils/messagingBlocks.js` | Compose or validate messaging block documents. |
| `utils/normalizeDbText.js` | Trim/unicode normalize text before INSERT/UPDATE. |
| `utils/passwordValidator.js` | Password policy aligned with auth routes. |
| `utils/publicOffers.js` | Compute offers visible on public endpoints. |
| `utils/reelVideoTranscode.js` | ffmpeg-based reel transcoding helpers. |
| `utils/requestLang.js` | Resolve language from headers/query for localized rows. |
| `utils/siteSettingsLoad.js` | Load merged defaults + DB overrides for site settings. |
| `utils/sqlIdentifiers.js` | Whitelist/escape dynamic SQL identifiers safely. |
| `utils/uploadLimits.js` | Central numeric limits for multer and error messages. |
| `utils/usernameValidator.js` | Username format/uniqueness checks. |
| `utils/validate.js` | Small shared validators (email, uuid, pagination). |
| `utils/validateAdminCategory.js` | Stricter validation for admin category writes. |
| `utils/validateAdminPlace.js` | Stricter validation for admin place writes. |

### `client/src` — files A–Z

| File | Purpose |
|------|---------|
| `api/client.js` | Fetch wrapper + typed API methods for every `/api/*` endpoint; image URL helpers; auth token storage. |
| `App.jsx` | React Router tree, lazy-loaded pages, auth/admin/business route guards. |
| `components/AiPlannerOnboarding.jsx` | First-run UX for AI planner (dismissible panels). |
| `components/Calendar.jsx` | Reusable calendar/date UI. |
| `components/CommunityFeed.jsx` | Renders a list of feed posts with loading states. |
| `components/DeliveryImg.jsx` | Image component tuned for progressive loading / placeholders. |
| `components/FeedPostCard.jsx` | Single community post: author, media carousel, actions. |
| `components/FindYourWayMap.jsx` | Leaflet map for wayfinding / grouped markers. |
| `components/GlobalSearchBar.jsx` | Site-wide search input + results dropdown. |
| `components/HciSettingsPanel.jsx` | Accessibility / HCI toggles (reduced motion, contrast hints). |
| `components/Icon.jsx` | Renders icons via registry or Feather map. |
| `components/Layout.jsx` | App shell: header, nav, `<Outlet />` for child routes. |
| `components/MapPicker.jsx` | Draggable marker / click map to set lat/lng (forms). |
| `components/OfferCard.jsx` | Card UI for promotional offers. |
| `components/ScrollToTop.jsx` | On `location` change, `window.scrollTo(0,0)`. |
| `components/SponsoredPlaceCard.jsx` | Card for sponsored place placements. |
| `config/featherIconMap.js` | Maps icon keys to Feather SVG paths. |
| `config/googleSignIn.js` | Loads Google Identity Services script; exposes sign-in helpers. |
| `config/homeBentoVisuals.js` | Data for home bento tiles (images, links). |
| `config/iconRegistry.js` | Central list of icons used across the UI. |
| `config/planTripAreas.js` | Named areas for trip planning steps. |
| `config/resolveSiteTagline.js` | Computes tagline string from settings + language. |
| `config/siteSeo.js` | Default title/description/theme color for HTML injection. |
| `config/siteSettingsDefaults.js` | Fallback `siteSettings` object before API load. |
| `constants/cityHero.js` | Srcset/sizes for hero image preload in `vite.config.js`. |
| `context/AuthContext.jsx` | Holds `user`, `loading`, `login`, `logout`, persists JWT. |
| `context/FavouritesContext.jsx` | Loads and mutates user favourites with optimistic UI. |
| `context/LanguageContext.jsx` | Current locale + `t()` accessor backed by `i18n/translations.js`. |
| `context/SiteSettingsContext.jsx` | Fetches `/api/site-settings` and exposes to children. |
| `context/ToastContext.jsx` | Imperative toast API (`showToast`). |
| `data/aiPlannerTrainingData.js` | Static examples / few-shot text for planner UI demos. |
| `ErrorBoundary.jsx` | React error boundary with fallback UI + reset. |
| `i18n/translations.js` | Large dictionaries: keys → strings per language. |
| `main.jsx` | `createRoot`, global CSS, provider nesting, mount `App`. |
| `pages/ActivitiesHub.jsx` | Hub for activities + shortcut into events tab. |
| `pages/admin/AdminApp.jsx` | Nested `<Routes>` for `/admin/*` sub-pages. |
| `pages/admin/AdminCategories.jsx` | Admin UI for categories. |
| `pages/admin/AdminDashboard.jsx` | Admin landing metrics / shortcuts. |
| `pages/admin/AdminDiningGuide.jsx` | Edit dining guide content. |
| `pages/admin/AdminEmailBroadcast.jsx` | UI for broadcast email campaign. |
| `pages/admin/AdminEvents.jsx` | Admin UI for events. |
| `pages/admin/AdminExperiences.jsx` | Admin UI for experiences listings. |
| `pages/admin/AdminFeed.jsx` | Moderation UI for feed posts. |
| `pages/admin/AdminFormPickers.jsx` | Shared autocomplete/select components for admin forms. |
| `pages/admin/AdminHotelsGuide.jsx` | Edit hotels guide content. |
| `pages/admin/AdminInterests.jsx` | Admin UI for interests taxonomy. |
| `pages/admin/AdminLayout.jsx` | Admin chrome: sidebar, `<Outlet />`. |
| `pages/admin/AdminMinimal.jsx` | Lightweight admin layout for embed-style pages. |
| `pages/admin/AdminOffers.jsx` | Admin UI for offers. |
| `pages/admin/AdminPlaceOwners.jsx` | Manage which users own which places. |
| `pages/admin/AdminPlaces.jsx` | Full admin CRUD table + editor for places. |
| `pages/admin/AdminSettings.jsx` | Form for global site settings keys. |
| `pages/admin/AdminSponsoredPlaces.jsx` | Configure sponsored placements. |
| `pages/admin/AdminTranslationsPanel.jsx` | Edit translation strings (or keys) in admin. |
| `pages/admin/AdminUsers.jsx` | User list, roles, admin toggles. |
| `pages/admin/AdminUserTrips.jsx` | Inspect trips for support. |
| `pages/AiPlanner.jsx` | AI trip planner chat / wizard (calls `services/aiPlannerService.js`). |
| `pages/BacklinkKit.jsx` | Static partner page with embeddable links/assets. |
| `pages/business/BusinessApp.jsx` | Nested routes for `/business/*`. |
| `pages/business/BusinessDashboard.jsx` | Owner overview: stats, shortcuts. |
| `pages/business/BusinessGateLoader.jsx` | Full-screen loader used during lazy suspense and gates. |
| `pages/business/BusinessLayout.jsx` | Business portal shell: nav for owner tools. |
| `pages/business/BusinessPlaceEdit.jsx` | Large form editing owned place fields + media. |
| `pages/business/BusinessPlaceFeed.jsx` | Owner view to create/edit feed posts. |
| `pages/business/BusinessSponsorship.jsx` | Purchase or manage sponsorship (Stripe UI). |
| `pages/business/BusinessSponsorshipSuccess.jsx` | Thank-you / confirmation page after checkout. |
| `pages/CommunityCreate.jsx` | Form for users to create a community feed post. |
| `pages/Discover.jsx` | Community discover experience (map/list hybrid). |
| `pages/EventDetail.jsx` | Single event page: description, date, location, share. |
| `pages/Events.jsx` | Events listing (may filter by date/category). |
| `pages/Experiences.jsx` | Experiences listing or redirect wrapper. |
| `pages/Explore.jsx` | Home/explore: hero, categories, featured content. |
| `pages/Favourites.jsx` | Lists saved places with remove actions. |
| `pages/FindYourWay.jsx` | Wayfinding UX using `FindYourWayMap` + lists. |
| `pages/ForgotPassword.jsx` | Request password reset email. |
| `pages/Login.jsx` | Email/password + Google login form. |
| `pages/Map.jsx` | Full-screen map experience (protected). |
| `pages/Messages.jsx` | Thread list + conversation with places (route param variants). |
| `pages/PlaceDetail.jsx` | Rich place page: gallery, hours, offers, feed preview. |
| `pages/PlaceDining.jsx` | Dining vertical browse page. |
| `pages/PlaceDiscover.jsx` | Category-first place discovery (filters, sort). |
| `pages/PlaceHotels.jsx` | Hotels vertical browse page. |
| `pages/Plan.jsx` | Manual trip planner (drag/drop or timeline). |
| `pages/Profile.jsx` | Edit profile, interests, language, security. |
| `pages/Register.jsx` | Sign-up + email verification prompts. |
| `pages/SeoLanding.jsx` | Exports several static SEO article pages (guides). |
| `pages/Spots.jsx` | Legacy spots view or thin wrapper (check redirects in `App.jsx`). |
| `pages/TourDetail.jsx` | Single tour itinerary page. |
| `pages/TripDetail.jsx` | Single saved trip with map/steps. |
| `pages/Trips.jsx` | List of user trips. |
| `pages/VerifyEmail.jsx` | Handles email verification token from URL query. |
| `reportWebVitals.js` | Optional hook to send CLS/LCP/FID to analytics. |
| `services/aiPlannerService.js` | Builds planner requests, parses responses, handles errors/retries. |
| `utils/adminContentHelpers.js` | Formatting helpers for admin content editors. |
| `utils/aiPlannerOnboardingStorage.js` | `localStorage` flags for AI onboarding completion. |
| `utils/aiPlannerPlaceRanker.js` | Client-side ranking/heuristics for suggested places. |
| `utils/aiPlannerPrefs.js` | Persist user planner preferences locally. |
| `utils/aiPlannerUserMemory.js` | Stores lightweight “memory” snippets for planner context. |
| `utils/analytics.js` | Wraps GTM/GA event pushes. |
| `utils/apiOrigin.js` | Returns API base URL from `import.meta.env.VITE_API_URL` rules. |
| `utils/asyncPool.js` | Run async tasks with max concurrency (batch fetches). |
| `utils/bentoHeroImage.js` | Pick hero image variant by breakpoint. |
| `utils/debounce.js` | Debounce function for search inputs. |
| `utils/discoverPaths.js` | Route helpers for discover sub-views. |
| `utils/feedPostImages.js` | Normalize feed image arrays for `FeedPostCard`. |
| `utils/feedTime.js` | Relative time labels (“2h ago”) for posts. |
| `utils/feedVideoPlayback.js` | IntersectionObserver / play-pause for reel videos. |
| `utils/findYourWayGrouping.js` | Cluster markers or group venues for wayfinding lists. |
| `utils/googleWebClientId.js` | Read GIS client id from meta tag set by Vite. |
| `utils/homeCategoryBrowse.js` | Logic for home category chips navigation. |
| `utils/imageUploadAccept.js` | Central `accept` string for file inputs. |
| `utils/manualTripOnboardingStorage.js` | localStorage for manual trip onboarding. |
| `utils/mapGoogleLoader.js` | Dynamically inject Google Maps JS once. |
| `utils/orderPlacesByIds.js` | Reorder place arrays to match a saved id list. |
| `utils/passwordRequirements.js` | Live validation messages matching server rules. |
| `utils/placeDiscoverRank.js` | Sort/boost places in discover lists. |
| `utils/placeGuideExclusions.js` | Filter out internal/test places from guides. |
| `utils/prayerTimesApi.js` | Fetch prayer times for hints (third-party API). |
| `utils/responsiveImages.js` | Build `srcset`/`sizes` for content images. |
| `utils/safeUrl.js` | Block `javascript:` URLs in user-provided links. |
| `utils/searchFilter.js` | Client-side text filters for lists. |
| `utils/siteSeo.js` | Helpers to set `document.title` / meta per page. |
| `utils/smartVisitTiming.js` | Heuristics for “best time to visit” copy. |
| `utils/supabaseImage.js` | Transform Supabase storage URLs (size/format). |
| `utils/tripoliAreaBounds.js` | Lat/lng bounds clamping for Tripoli maps. |
| `utils/tripPlannerHelpers.js` | Pure functions for trip steps, durations, ordering. |
| `utils/usernameRequirements.js` | Live username validation vs server rules. |
| `utils/visitWeatherHint.js` | Short weather copy for place visit suggestions. |

