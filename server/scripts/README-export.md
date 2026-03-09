# Database: use only this (supabase-export.sql)

**This project uses a single source of truth for the database:**  
`server/scripts/supabase-export.sql`

That file contains the full **public** schema (all tables) and **all data**. Your app should use only the tables and structure defined there.

---

## Restore database to match the file

To make your Supabase (or any Postgres) database **exactly** match the export file (drops and recreates tables, then inserts data):

From the **server** folder:

```bash
npm run db:restore
```

- Requires **DATABASE_URL** in `server/.env` (or project root `.env`).
- **Warning:** This replaces the current `public` schema with the contents of the file. All existing data in those tables is lost.

---

## Export current database to the file

To update the canonical file from your current database (e.g. after schema or data changes):

From the **server** folder:

```bash
npm run export-sql
```

- **Output:** `server/scripts/supabase-export.sql` (overwritten).
- Use this when you want the file to reflect the live DB again.

---

## Requirements

- **DATABASE_URL** in `server/.env` (or project root `.env`), e.g.  
  `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## Optional: full dump with pg_dump

For a dump that includes indexes, foreign keys, and triggers, use `pg_dump` if you have PostgreSQL client tools installed:

```bash
pg_dump "YOUR_DATABASE_URL" --schema=public --no-owner --no-acl --inserts -f supabase-full.sql
```

Replace `YOUR_DATABASE_URL` with your connection string (Supabase: Project Settings → Database → URI).
