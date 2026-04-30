---
phase: 02-daily-prices
plan: "01"
subsystem: database
tags: [supabase, server-actions, dal, typescript, jest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: verifySession(), createClient(), Database types, session infrastructure

provides:
  - getTodayPrices(): returns product_id/price_per_kg array for today's UTC date
  - hasTodayPrices(): returns true when at least one price row exists for today
  - savePrices(): upserts price form data for today, calls revalidatePath('/prices')
  - copyYesterdayPrices(): reads yesterday prices as Record<string, number>, no DB write
  - TodayPrice, SavePricesState, CopyPricesState TypeScript types
  - Jest test infrastructure with supabase mocks (14 tests)

affects:
  - 02-02 (prices UI page will consume these actions)
  - 03-orders (savePrices pattern is reference for order actions)

# Tech tracking
tech-stack:
  added: [jest, @types/jest, ts-jest]
  patterns:
    - TDD red-green cycle for DAL and Server Actions
    - Server Actions always call verifySession() as first line
    - FormData filter: skip keys starting with '$' (Next.js internals)
    - upsert with onConflict for idempotent price saves
    - copyYesterdayPrices returns data only — UI populates form, save is separate

key-files:
  created:
    - src/app/actions/prices.ts
    - src/__tests__/dal.test.ts
    - src/__tests__/prices-actions.test.ts
    - src/__mocks__/server-only.ts
    - jest.config.js
  modified:
    - src/lib/dal.ts
    - src/types/database.ts

key-decisions:
  - "database.ts requires Relationships:[] on each table + Views/Functions fields to satisfy @supabase/postgrest-js v2.105.1 GenericTable/GenericSchema constraints"
  - "copyYesterdayPrices does NOT write to DB — returns Record<string,number> for form population, UI calls savePrices separately"
  - "savePrices skips FormData entries with keys starting with '$' to exclude Next.js $ACTION_ID internal fields"

patterns-established:
  - "Server Actions: verifySession() always first — no exceptions"
  - "FormData iteration: filter '$' prefix before processing"
  - "DAL: service-role createClient() for server-side data queries"
  - "Test mocks: jest.mock('@/lib/supabase/server') with chained builder mocks"

requirements-completed: [PRICE-01, PRICE-02]

# Metrics
duration: 13min
completed: 2026-04-30
---

# Phase 02 Plan 01: Daily Prices Data Layer Summary

**DAL functions (getTodayPrices, hasTodayPrices) and Server Actions (savePrices, copyYesterdayPrices) with 14 Jest tests and TypeScript clean compile**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-30T05:30:59Z
- **Completed:** 2026-04-30T05:43:59Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Extended dal.ts with getTodayPrices and hasTodayPrices using service-role Supabase client
- Created prices Server Actions with savePrices (upsert with onConflict) and copyYesterdayPrices (read-only)
- Set up Jest test infrastructure (first in project) with 14 passing tests covering all behaviors
- Fixed database.ts to satisfy Supabase postgrest-js v2.105.1 GenericSchema requirements

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1 RED: failing DAL tests** - `fb8f314` (test)
2. **Task 1 GREEN: DAL implementation** - `3da5e38` (feat)
3. **Task 2 RED: failing prices actions tests** - `09577c7` (test)
4. **Task 2 GREEN: prices actions + DB type fix** - `5e64057` (feat)

## Files Created/Modified

- `src/lib/dal.ts` — Added getTodayPrices, hasTodayPrices, TodayPrice type
- `src/app/actions/prices.ts` — New file: savePrices and copyYesterdayPrices Server Actions
- `src/types/database.ts` — Added Relationships:[] to all tables, Views/Functions fields
- `jest.config.js` — Jest configuration with ts-jest and @/* path mapping
- `src/__mocks__/server-only.ts` — No-op mock for server-only package in test env
- `src/__tests__/dal.test.ts` — 5 tests for getTodayPrices and hasTodayPrices
- `src/__tests__/prices-actions.test.ts` — 9 tests for savePrices and copyYesterdayPrices

## Decisions Made

- Used `Relationships: []` on all database.ts table entries — the newer @supabase/postgrest-js (v2.105.1) requires `GenericTable` shape with Relationships field; without it, `upsert()` arguments resolve to `never`
- Added `Views: Record<string, never>` and `Functions: Record<string, never>` to satisfy `GenericSchema` shape
- No `getYesterdayPrices()` in DAL — yesterday query is inside `copyYesterdayPrices` only (single caller, no reuse needed per plan spec)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed database.ts GenericSchema incompatibility with supabase-js v2.105.1**

- **Found during:** Task 2 (TypeScript verification after creating prices.ts)
- **Issue:** `upsert()` parameter type resolved to `never` because `Database` tables lacked `Relationships: []` field required by `GenericTable` type in @supabase/postgrest-js v2.105.1. Also `GenericSchema` requires `Views` and `Functions` fields.
- **Fix:** Added `Relationships: []` to all 6 table definitions; added `Views: Record<string, never>` and `Functions: Record<string, never>` to the `public` schema object
- **Files modified:** `src/types/database.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly; all 14 Jest tests pass
- **Committed in:** `5e64057` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in existing database types)
**Impact on plan:** Required fix — without it TypeScript wouldn't compile the upsert call. No scope creep.

## Issues Encountered

None beyond the database.ts type fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Server Action contracts defined — prices UI (02-02) can be built against these APIs
- savePrices signature: `(prevState, FormData) => Promise<SavePricesState>`
- copyYesterdayPrices signature: `(prevState) => Promise<CopyPricesState>`
- Both use useActionState() pattern (prevState first arg)
- Jest infrastructure now available for future TDD tasks

---
*Phase: 02-daily-prices*
*Completed: 2026-04-30*
