---
phase: 04-debt-management
plan: 01
subsystem: database
tags: [supabase, typescript, dal, debt, payments]

# Dependency graph
requires:
  - phase: 03-orders
    provides: orders table schema, OrderRow type, calcEffective pattern
  - phase: 01-foundation
    provides: debt_payments table DDL, createClient Supabase helper, database.ts types
provides:
  - calcEffective exported from dal.ts for Server Action reuse
  - DebtOrderEntry type with per-order debt breakdown (effectiveTotal, paidTotal, remaining)
  - getClientDebtOrders(clientId) returning debt/partial orders with computed remaining per order
  - DebtPaymentRow type matching debt_payments table Row shape
  - getDebtPayments(orderId) returning payment history ordered by paid_at asc
affects:
  - 04-02-server-action (imports calcEffective from dal.ts)
  - 04-03-detail-page (imports getClientDebtOrders, getDebtPayments from dal.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase query: fetch orders first, then fetch payments only for those order IDs (avoids wrong cross-client join)"
    - "calcEffective exported as pure utility — reusable in Server Actions without duplication"

key-files:
  created: []
  modified:
    - src/lib/dal.ts

key-decisions:
  - "getClientDebtOrders uses two sequential queries (not Promise.all) to avoid the wrong pattern of joining payments by clientId — must join by orderIds from first query"
  - "calcEffective exported from dal.ts rather than duplicated in Server Action — single source of truth for effective total computation"

patterns-established:
  - "Two-phase DAL query: fetch parent rows, extract IDs, then fetch children .in('id', parentIds)"

requirements-completed: [DEBT-01, DEBT-02, DEBT-03]

# Metrics
duration: 1min
completed: 2026-05-04
---

# Phase 04 Plan 01: Debt DAL Functions Summary

**calcEffective exported and two new DAL functions added to dal.ts: getClientDebtOrders (per-order debt breakdown) and getDebtPayments (payment history), unblocking Server Action and detail page plans**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-04T12:30:33Z
- **Completed:** 2026-05-04T12:31:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Exported `calcEffective` from dal.ts (was private), making it available for import in the upcoming Server Action without code duplication
- Added `getClientDebtOrders(clientId)` with correct two-phase query pattern: fetches debt/partial orders first, then fetches payments filtered by those orderIds (avoiding the wrong clientId-based join from research template)
- Added `getDebtPayments(orderId)` returning payment history rows ordered ascending by paid_at

## Task Commits

Each task was committed atomically:

1. **Task 1: Export calcEffective and add getClientDebtOrders + getDebtPayments to dal.ts** - `8275964` (feat)

**Plan metadata:** (created after this commit)

## Files Created/Modified
- `src/lib/dal.ts` - Added export to calcEffective, DebtOrderEntry type, getClientDebtOrders function, DebtPaymentRow type, getDebtPayments function (64 lines added)

## Decisions Made
- Used two sequential queries in `getClientDebtOrders` instead of `Promise.all` — the payments query depends on the orderIds returned by the first query, making parallelization impossible without fetching all payments globally
- The PLAN itself noted the wrong pattern (joining payments by clientId) and provided the correct subquery approach — followed the corrected version

## Deviations from Plan

None - plan executed exactly as written (used the corrected implementation the plan explicitly specified, not the wrong template variant).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04-02 (Server Action `recordPayment`) can now `import { calcEffective } from '@/lib/dal'` without duplication
- Plan 04-03 (detail page `/debts/[clientId]`) can `import { getClientDebtOrders, getDebtPayments }` from dal.ts
- All three exported functions verified TypeScript-clean (zero `tsc --noEmit` errors)

---
*Phase: 04-debt-management*
*Completed: 2026-05-04*
