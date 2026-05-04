---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-05-04T07:28:50.625Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** Продавец оформляет продажу за ≤30 секунд с телефона — быстрее, чем тетрадь
**Current focus:** Phase 3 — Orders

## Current Position

Phase: 3.1 of 3.1 (Navigation & Auth UX gap closure)
Plan: 2 of 2 complete (03.1-01 done; 03.1-02 done — browser verify approved)
Status: Phase 3.1 complete — all tasks done, browser verify passed
Last activity: 2026-05-04 — Plan 03.1-02 Task 2 complete: browser verify approved — NavBar, logout, «Создать заказ» button all confirmed working

Progress: [████████░░] 80%

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
| Phase 03.1-navigation-auth-ux P01 | 15 | 2 tasks | 5 files |
| Phase 03.1-navigation-auth-ux P02 | 5 | 1 task | 1 file |

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
- 03-02: manual_total has absolute priority over discount_percent in effectiveTotal — user-explicit total overrides percentage discount
- 03-02: formKey state increment used to reset form + useActionState after successful order — remounts form subtree cleanly
- [Phase 03-orders]: searchParams and params are Promise in Next.js 16 — must await before reading
- [Phase 03-orders]: 03-03: line_total used directly from order_items (GENERATED ALWAYS AS stored column) — no recalculation in UI
- [Phase 03.1-01]: NavBar replaces paddingTop: 48px header spacing — component itself provides top padding via paddingTop: 20px
- [Phase 03.1-01]: form action={logout} pattern for logout — works without JS (progressive enhancement)
- [Phase 03.1-02]: showSuccess resets only on next saveState change (not via setTimeout) — user has unlimited time to click «Создать заказ»

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 (Orders): Most complex UI — useFieldArray + live currency.js arithmetic + mobile keyboard behavior. Research flags this as needing a focused implementation spike before planning.
- Phase 5 (Reports): ExcelJS + @react-pdf/renderer binary Route Handler patterns need verification before planning.
- Phase 1: Decide on rate limiting for login endpoint (Upstash Redis vs. accept low risk for internal-only deployment).

## Session Continuity

Last session: 2026-05-04
Stopped at: Completed 03.1-02-PLAN.md — PricesForm auto-hide removed, «Создать заказ» button added, browser verify approved. Phase 3.1 complete.
Resume file: None
