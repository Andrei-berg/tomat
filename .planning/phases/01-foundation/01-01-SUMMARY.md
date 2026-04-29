---
phase: 01-foundation
plan: "01"
subsystem: infra
tags: [nextjs, supabase, postgres, tailwind, iron-session, typescript, rls]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.4 project scaffolded with TypeScript, Tailwind CSS, App Router
  - All runtime dependencies installed (iron-session, @supabase/supabase-js, @supabase/ssr, zod, server-only)
  - Supabase migration: 6 tables (products, prices, clients, orders, order_items, debt_payments) with RLS on all
  - Supabase seed: 6 tomato products in sort order
  - .env.local template with 5 required env vars (user must fill in)
affects: [02-session-layer, 03-orders, 04-debt, 05-reports]

# Tech tracking
tech-stack:
  added:
    - next@16.2.4 (exceeds security requirement >=15.2.3 / CVE-2025-29927)
    - iron-session@8.0.4
    - "@supabase/supabase-js@2.105.1"
    - "@supabase/ssr@0.10.2"
    - zod@4.3.6
    - server-only@0.0.1
    - supabase CLI (dev dep)
    - tailwindcss + @tailwindcss/postcss
  patterns:
    - RLS enabled on every table at schema creation time (retrofitting is high-cost)
    - Supabase migrations in supabase/migrations/ with timestamp prefix
    - seed.sql separate from migration for independent application

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - eslint.config.mjs
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/globals.css
    - supabase/migrations/20260429000000_initial_schema.sql
    - supabase/seed.sql
  modified: []

key-decisions:
  - "Next.js 16.2.4 installed (not 15) — create-next-app resolved to latest, exceeds security minimum"
  - "RLS enabled on all 6 tables at creation — decision from STATE.md: retrofitting is high-cost"
  - "line_total in order_items uses GENERATED ALWAYS AS (weight_kg * price_per_kg) STORED — price snapshot at order time"
  - "No local Supabase Docker setup — SQL files applied manually in Supabase Dashboard SQL Editor"

patterns-established:
  - "Pattern 1: All DB tables have RLS enabled at creation, never added later"
  - "Pattern 2: price_per_kg is stored in order_items, never re-derived from prices table"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 1 Plan 01: Foundation Scaffolding Summary

**Next.js 16 project scaffolded with iron-session + Supabase dependencies, 6-table PostgreSQL schema with RLS on all tables, and 6 tomato product seed data**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T05:35:59Z
- **Completed:** 2026-04-29T05:38:29Z
- **Tasks:** 2 of 3 auto-completed (Task 3 is human-action checkpoint)
- **Files modified:** 12

## Accomplishments

- Next.js 16.2.4 scaffolded with TypeScript, Tailwind CSS, App Router, src/ dir
- All dependencies installed: iron-session, @supabase/supabase-js, @supabase/ssr, zod, server-only
- Full 6-table Supabase schema written with RLS enabled on every table
- 6 tomato product seed file ready for Supabase SQL Editor

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project with all dependencies** - `354e392` (feat)
2. **Task 2: Write Supabase migration and seed files** - `fcecfd7` (feat)
3. **Task 3: Apply Supabase migration and create .env.local** - PENDING (human-action checkpoint)

## Files Created/Modified

- `package.json` - Next.js 16 + all runtime and dev dependencies
- `tsconfig.json` - TypeScript config with @/* alias
- `next.config.ts` - Next.js app config
- `postcss.config.mjs` - PostCSS with @tailwindcss/postcss
- `eslint.config.mjs` - ESLint config
- `src/app/layout.tsx` - Root layout
- `src/app/page.tsx` - Minimal placeholder page (Tomat)
- `src/app/globals.css` - Tailwind import only
- `supabase/migrations/20260429000000_initial_schema.sql` - 6 tables, all with RLS
- `supabase/seed.sql` - 6 products: Пятерка through Хара-Хура

## Decisions Made

- Used Next.js 16.2.4 (create-next-app resolved to latest) — exceeds 15.2.3 security minimum, safe
- No local Supabase Docker — SQL files are written for manual application in Dashboard SQL Editor
- line_total in order_items is a GENERATED ALWAYS AS stored column (price snapshot at order creation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Temporarily moved .planning/ and TOMATO_SALES_SNAPSHOT.md during scaffold**
- **Found during:** Task 1 (scaffold)
- **Issue:** create-next-app refuses to scaffold into a directory with existing files
- **Fix:** Moved files to /tmp/tomat_backup/, ran scaffold, restored files
- **Files modified:** None (files were moved and returned)
- **Verification:** Files restored correctly, git status shows all files intact
- **Committed in:** 354e392 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial workaround for create-next-app's directory check. No scope creep.

## Issues Encountered

- create-next-app refuses to scaffold into a directory with existing files — resolved by temporarily moving .planning/ and TOMATO_SALES_SNAPSHOT.md (see deviation above)

## User Setup Required

**External services require manual configuration before proceeding to Plan 02.**

### Steps to complete Plan 01:

**Step 1:** Create a Supabase project at https://supabase.com/dashboard → New project

**Step 2:** In Supabase Dashboard → SQL Editor → New query, copy and run:
`supabase/migrations/20260429000000_initial_schema.sql`
Expected: "Success. No rows returned"

**Step 3:** In Supabase Dashboard → SQL Editor → New query, copy and run:
`supabase/seed.sql`
Expected: "Success. 6 rows affected"

**Step 4:** Verify RLS — run in SQL Editor:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```
Expected: 6 rows, all with rowsecurity = true

**Step 5:** Create `/home/user/Projects/tomat/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
IRON_SESSION_SECRET=<run: openssl rand -base64 32>
APP_PASSWORD=<your chosen shared password>
```

**Step 6:** Verify app starts: `npm run dev` → http://localhost:3000

## Next Phase Readiness

- Code scaffold: READY — Next.js 16 with all dependencies
- DB schema files: READY — written, awaiting user application in Supabase
- .env.local: BLOCKED — user must create after Supabase setup
- Plan 02 (session layer): BLOCKED until Task 3 human-action complete

---
*Phase: 01-foundation*
*Completed: 2026-04-29 (partial — Task 3 pending user action)*
