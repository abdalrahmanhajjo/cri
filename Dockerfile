# Tripoli Explorer — one container: Vite build + Node API (same origin: leave VITE_API_URL empty).
# Build: docker build -t tripoli-explorer .
# Run:   docker run -p 3095:3095 --env-file server/.env -e SERVE_CLIENT_DIST=true tripoli-explorer
# Platforms: Railway, Fly.io, Render, Google Cloud Run (set PORT from platform).

FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
# Same-origin API: browser uses /api on this host. Override at build time if UI is on another domain.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:22-alpine AS server-prod
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SERVE_CLIENT_DIST=true

EXPOSE 3095
CMD ["node", "src/index.js"]
