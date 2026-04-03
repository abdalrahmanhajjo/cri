## MongoDB Phase 1

This project is still PostgreSQL-first.

Phase 1 adds MongoDB as a parallel data store for low-risk content sync:

- `categories`
- `interests`
- `places`

Files:

- `server/src/mongo/index.js`: MongoDB connection layer
- `server/scripts/sync-core-content-to-mongo.js`: PostgreSQL -> MongoDB sync script

Environment:

- `MONGODB_URI`
- `MONGODB_DB_NAME` (optional)

Run:

```bash
npm run db:mongo:sync:core --prefix server
```

Current status:

- App runtime still reads from PostgreSQL
- MongoDB is ready for phased collection migration
- No auth/feed/trips/business write paths have been cut over yet

Recommended next phases:

1. Move read-only public taxonomy/content reads behind a repository layer
2. Add dual-read validation for `categories`, `interests`, and `places`
3. Migrate `events` and `tours`
4. Only after that, plan user/feed/trips migration
