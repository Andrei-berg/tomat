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
  - .env.local with all 5 required env vars configured
  - Supabase migration applied, 6 products seeded, npm run dev running on localhost:3000
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
    - .env.local (gitignored — contains Supabase keys + iron-session secret + app password)
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
duration: ~30min (including human setup steps)
completed: 2026-04-29
---

# Phase 1 Plan 01: Foundation Scaffolding Summary

**Next.js 16 project with iron-session + Supabase dependencies, 6-table PostgreSQL schema with RLS on all tables, 6-product seed data applied, and .env.local configured — dev server running on localhost:3000**

## Performance

- **Duration:** ~30 min (including human Supabase setup steps)
- **Started:** 2026-04-29T05:35:59Z
- **Completed:** 2026-04-29
- **Tasks:** 3 of 3 complete
- **Files modified:** 13 (including .env.local — gitignored)

## Accomplishments

- Next.js 16.2.4 scaffolded with TypeScript, Tailwind CSS, App Router, src/ dir
- All dependencies installed: iron-session, @supabase/supabase-js, @supabase/ssr, zod, server-only
- Full 6-table Supabase schema applied with RLS enabled on every table
- 6 tomato product seed data applied (Пятерка, Шестерка, Семерка, Восьмерка, НС, Хара-Хура)
- .env.local configured with all 5 env vars (Supabase keys + iron-session secret + app password)
- npm run dev starts successfully on localhost:3000 (HTTP 200)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project with all dependencies** - `354e392` (feat)
2. **Task 2: Write Supabase migration and seed files** - `fcecfd7` (feat)
3. **Task 3: Apply Supabase migration and create .env.local** - human-action (completed by user — .env.local gitignored, no code commit needed)

**Plan metadata:** see final docs commit

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
- `.env.local` - All 5 env vars configured (gitignored — not committed)

## Decisions Made

- Used Next.js 16.2.4 (create-next-app resolved to latest) — exceeds 15.2.3 security minimum, safe
- No local Supabase Docker — SQL files written for manual application in Dashboard SQL Editor
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

All steps completed by user:
- Supabase project created
- Migration applied (6 tables with RLS)
- Seed applied (6 products)
- .env.local created with all 5 env vars
- npm run dev verified running on localhost:3000

## Next Phase Readiness

- Code scaffold: READY — Next.js 16 with all dependencies
- DB schema: READY — 6 tables with RLS applied in Supabase
- .env.local: READY — all 5 env vars configured
- Plan 02 (session layer): READY to execute — all prerequisites met

---
*Phase: 01-foundation*
*Completed: 2026-04-29*
