---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-04-30T16:36:29.058Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** Продавец оформляет продажу за ≤30 секунд с телефона — быстрее, чем тетрадь
**Current focus:** Phase 3 — Orders

## Current Position

Phase: 3 of 5 (Orders)
Plan: 4 of 4 in current phase (03-01, 03-02, 03-03 complete; 03-04 next)
Status: Phase 3 In Progress — DAL + Server Actions + OrderForm + /orders + /orders/[id] done; next: 03-04
Last activity: 2026-04-30 — Plan 03-03 complete: /orders and /orders/[id] Server Component pages

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~30 min
- Total execution time: ~30 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 of 3 | ~48 min | ~16 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~30 min), 01-02 (~3 min)
- Trend: —

*Updated after each plan completion*
| Phase 02-daily-prices P01 | 13 | 2 tasks | 7 files |
| Phase 02-daily-prices P02 | 20 | 3 tasks | 2 files |
| Phase 03-orders P01 | 8 | 2 tasks | 2 files |
| Phase 03-orders P02 | 2 | 1 task | 1 file |
| Phase 03-orders P03 | 2 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: RLS must be enabled on every table at schema creation — retrofitting is high-cost
- Phase 1: Pin Next.js to >=15.2.3 due to CVE-2025-29927 middleware bypass; verifySession() in every Server Action
- Phase 3: price_per_kg snapshot written at order creation time — never re-derive from prices table
- Phase 4: Debt balance always computed via SQL (never a stored column) to prevent silent drift
- 01-01: Next.js 16.2.4 installed (create-next-app resolved to latest) — exceeds 15.2.3 security minimum
- 01-01: line_total in order_items is GENERATED ALWAYS AS stored column — price snapshot at order creation time
- 01-01: No local Supabase Docker — SQL files applied manually in Supabase Dashboard SQL Editor
- 01-02: Used hand-typed database.ts placeholder — supabase CLI requires login; can regenerate anytime with npx supabase gen types typescript --project-id sbwgulwjnsitkevtotjp
- 01-02: line_total omitted from order_items Insert type — GENERATED ALWAYS AS stored column, Postgres computes it
- 01-02: verifySession() with React cache() is the single auth check entry point for all Server Components and Actions
- 01-03: Next.js 16 uses src/proxy.ts as middleware entry point (Proxy (Middleware) in build output) — middleware changes go in proxy.ts
- 01-03: Password compared directly with process.env.APP_PASSWORD — no hashing for single-user internal tool where secret is in env, never in DB
- [Phase 02-daily-prices]: database.ts requires Relationships:[] on each table + Views/Functions fields to satisfy @supabase/postgrest-js v2.105.1 GenericTable/GenericSchema constraints
- [Phase 02-daily-prices]: copyYesterdayPrices returns data only — UI populates form, then calls savePrices separately (no single-action copy-and-save)
- 02-02: Parallel Promise.all in Server Component for products + prices — minimal TTFB on page load
- 02-02: Copy button type=button with direct async call — lets user edit copied prices before saving
- [Phase 03-orders]: OrderWithItems uses unknown cast for Supabase join — Relationships:[] means join types aren't inferred
- [Phase 03-orders]: createClient renamed to createSupabaseClient in orders.ts to avoid name collision with exported createClient for clients
- [Phase 03-orders]: searchParams and params are Promise in Next.js 16 — must await before reading
- [Phase 03-orders]: 03-03: line_total used directly from order_items (GENERATED ALWAYS AS stored column) — no recalculation in UI

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 (Orders): Most complex UI — useFieldArray + live currency.js arithmetic + mobile keyboard behavior. Research flags this as needing a focused implementation spike before planning.
- Phase 5 (Reports): ExcelJS + @react-pdf/renderer binary Route Handler patterns need verification before planning.
- Phase 1: Decide on rate limiting for login endpoint (Upstash Redis vs. accept low risk for internal-only deployment).

## Session Continuity

Last session: 2026-04-30
Stopped at: Completed 03-03-PLAN.md — /orders and /orders/[id] Server Component pages (ORDER-11). Phase 3 plan 03 done.
Resume file: None
