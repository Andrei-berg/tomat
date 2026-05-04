---
phase: 04-debt-management
plan: "03"
subsystem: ui
tags: [next.js, server-components, debt, payments, navigation]

# Dependency graph
requires:
  - phase: 04-01
    provides: getClientDebtOrders, getDebtPayments, DebtOrderEntry, DebtPaymentRow types
  - phase: 04-02
    provides: PaymentForm component, recordPayment Server Action
provides:
  - /debts/[clientId] debt detail page with per-order breakdown and inline payment form
  - Clickable debtor rows in /debtors navigating to /debts/[clientId]
affects: [phase-05-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.all for parallel per-order payment history fetch in Server Component"
    - "Outer card as Link wrapper — nested links removed to avoid invalid HTML"
    - "notFound() after parallel client + orders fetch for non-existent clientId"

key-files:
  created:
    - src/app/debts/[clientId]/page.tsx
  modified:
    - src/app/debtors/page.tsx

key-decisions:
  - "Anonymous debtors (clientId=null) remain plain divs — cannot navigate to detail without clientId"
  - "Nested Link tags inside card link removed — inner name link and +заказ link both dropped"
  - "Payment histories fetched in parallel via Promise.all after orders resolve"

patterns-established:
  - "Debt detail page: await params (Next.js 16), then parallel getClientWithStats + getClientDebtOrders, then Promise.all payment histories"

requirements-completed: [DEBT-01, DEBT-03]

# Metrics
duration: ~20min
completed: 2026-05-04
---

# Phase 04 Plan 03: Debt Detail Page Summary

**Debt detail page (/debts/[clientId]) with per-order breakdown, inline PaymentForm, payment history, and clickable debtor list rows**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-04
- **Completed:** 2026-05-04
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments
- Created /debts/[clientId] Server Component showing per-order debt breakdown with remaining amounts (amber), status badges, and payment history per order
- Embedded PaymentForm inline per order with maxAmount=remaining for overpayment prevention
- Made /debtors debtor cards clickable Links to /debts/[clientId] while keeping anonymous debtors as plain divs
- Browser verification approved end-to-end: list → detail → payment recording → balance update

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /debts/[clientId]/page.tsx** - `2d9a4b9` (feat)
2. **Task 2: Make debtor rows clickable in /debtors/page.tsx** - `0592105` (feat)
3. **Task 3: Browser verify** - approved by user (checkpoint)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `src/app/debts/[clientId]/page.tsx` - Debt detail page: client header, total remaining banner, per-order cards with history + PaymentForm
- `src/app/debtors/page.tsx` - Debtor rows now Link wrappers to /debts/[clientId]; nested links removed

## Decisions Made
- Anonymous debtors (clientId=null) stay as plain `<div>` — no detail page possible without clientId
- Removed nested `<Link>` tags inside card links (name link + +заказ link) to avoid invalid HTML nesting
- Payment histories fetched in parallel with `Promise.all(orders.map(o => getDebtPayments(o.orderId)))` after orders resolve (sequential dependency — need order IDs first)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete debt management flow is live: /debtors → /debts/[clientId] → record payment → balance updates → paid debtors disappear from list
- Phase 05 (Reports) can now read debt data from the same dal.ts functions

---
*Phase: 04-debt-management*
*Completed: 2026-05-04*
