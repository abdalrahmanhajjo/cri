# Tripoli Explorer — one container: Vite build + Node API (same origin: leave VITE_API_URL empty).
# Build: docker build -t tripoli-explorer .
# Run:   docker run -p 3095:3095 --env-file server/.env -e SERVE_CLIENT_DIST=true tripoli-explorer
# Platforms: Railway, Fly.io, Render, Google Cloud Run (set PORT from platform).
# Build attempt: 2026-04-03-v3 (Switching to debian-slim to fix corrupted alpine cache)
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
# Vite inlines VITE_* at image build — add the same keys in Render Environment (build-time / Docker).
# Same-origin: leave VITE_API_URL empty so the browser uses /api on this host.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
# Canonical site URL (no trailing slash) for SEO: canonical, og:url, og:image, JSON-LD in index.html.
ARG VITE_PUBLIC_SITE_URL=
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
# Optional: https://YOUR_PROJECT.supabase.co — injects preconnect in index.html at build time.
ARG VITE_SUPABASE_ORIGIN=
ENV VITE_SUPABASE_ORIGIN=$VITE_SUPABASE_ORIGIN
ARG VITE_SUPABASE_IMAGE_TRANSFORM=
ENV VITE_SUPABASE_IMAGE_TRANSFORM=$VITE_SUPABASE_IMAGE_TRANSFORM
RUN npm run build

FROM node:22-bookworm-slim AS server-prod
# Reel transcoding: ffmpeg is needed for reels.
RUN apt-get update && apt-get install -y ffmpeg --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SERVE_CLIENT_DIST=true
# Prefer distro ffmpeg (full codecs). Override only if you use a custom binary.
ENV FFMPEG_PATH=/usr/bin/ffmpeg
# Feed videos: uploads are stored as received. ffmpeg is for optional ops (e.g. scripts/recompress-feed-reel-videos.js).

EXPOSE 3095
CMD ["node", "src/index.js"]
