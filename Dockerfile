# Tripoli Explorer — one container: Vite build + Node API (same origin: leave VITE_API_URL empty).
# Build: docker build -t tripoli-explorer .
# Run:   docker run -p 3095:3095 --env-file server/.env -e SERVE_CLIENT_DIST=true tripoli-explorer
# Platforms: Railway, Fly.io, Render, Google Cloud Run (set PORT from platform).

FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
# Vite inlines VITE_* at image build — add the same keys in Render Environment (build-time / Docker).
# Same-origin: leave VITE_API_URL empty so the browser uses /api on this host.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
# Optional: https://YOUR_PROJECT.supabase.co — injects preconnect in index.html at build time.
ARG VITE_SUPABASE_ORIGIN=
ENV VITE_SUPABASE_ORIGIN=$VITE_SUPABASE_ORIGIN
ARG VITE_SUPABASE_IMAGE_TRANSFORM=
ENV VITE_SUPABASE_IMAGE_TRANSFORM=$VITE_SUPABASE_IMAGE_TRANSFORM
RUN npm run build

FROM node:22-alpine AS server-prod
# Reel transcoding: @ffmpeg-installer/ffmpeg often ships a glibc-linked binary that won't run on Alpine (musl).
RUN apk add --no-cache ffmpeg
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

EXPOSE 3095
CMD ["node", "src/index.js"]
