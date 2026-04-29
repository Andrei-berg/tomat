# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** Продавец оформляет продажу за ≤30 секунд с телефона — быстрее, чем тетрадь
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 1 of 3 in current phase (01-01 complete, awaiting user action for .env.local + Supabase setup)
Status: Checkpoint — human action required
Last activity: 2026-04-29 — Plan 01-01 executed: Next.js scaffold + Supabase schema written

Progress: [█░░░░░░░░░] 7%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 (Orders): Most complex UI — useFieldArray + live currency.js arithmetic + mobile keyboard behavior. Research flags this as needing a focused implementation spike before planning.
- Phase 5 (Reports): ExcelJS + @react-pdf/renderer binary Route Handler patterns need verification before planning.
- Phase 1: Decide on rate limiting for login endpoint (Upstash Redis vs. accept low risk for internal-only deployment).

## Session Continuity

Last session: 2026-04-29
Stopped at: Plan 01-01 — Task 3 checkpoint (human-action: apply Supabase migration + create .env.local)
Resume file: None
