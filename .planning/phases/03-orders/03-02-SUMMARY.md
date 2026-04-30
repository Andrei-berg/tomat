---
phase: 03-orders
plan: "02"
subsystem: ui
tags: [react, next.js, useActionState, useTransition, client-component, forms, inline-styles]

# Dependency graph
requires:
  - phase: 03-01
    provides: createOrder, searchClients, createClient Server Actions and CreateOrderState/ClientResult types

provides:
  - src/components/ui/order-form.tsx — 'use client' OrderForm component accepting products and priceMap props

affects:
  - 03-03 (orders/new page that renders OrderForm)
  - 03-04 (orders list and detail pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local state for fixed product list: Record<productId, {boxes, weight}> instead of useFieldArray"
    - "Pure derived values in render body — calcTotal / effectiveTotal never stored in state"
    - "Debounced async search via useEffect + setTimeout cleanup"
    - "Dropdown blur/click race prevented with onMouseDown={e => e.preventDefault()}"
    - "FormData assembled manually in handleSubmit with flat key names weight_<pid>, boxes_<pid>, price_<pid>"
    - "price_per_kg snapshot passed via FormData — not re-queried in Server Action"

key-files:
  created:
    - src/components/ui/order-form.tsx
  modified: []

key-decisions:
  - "manual_total has absolute priority over discount_percent when both are filled (effectiveTotal priority rule)"
  - "useTransition wraps orderAction call so saving state is available separately from isPending"
  - "formKey state used to reset form after success — re-initialises useState from products prop"
  - "Client section always visible (not conditional on debt) but asterisk marks it required for debt payments"

patterns-established:
  - "OrderForm: useActionState<CreateOrderState, FormData>(createOrder, undefined) — typed generic form"
  - "resetForm: increment formKey state to remount form subtree and reset all useActionState"

requirements-completed:
  - CLIENT-01
  - CLIENT-02
  - CLIENT-03
  - ORDER-01
  - ORDER-02
  - ORDER-03
  - ORDER-04
  - ORDER-05
  - ORDER-06
  - ORDER-07
  - ORDER-08
  - ORDER-10

# Metrics
duration: 2min
completed: 2026-04-30
---

# Phase 3 Plan 02: OrderForm Summary

**React 'use client' order form with live total, discount/manual-total priority logic, debounced client search with inline creation, and canSave validation across all three payment types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-30T16:34:02Z
- **Completed:** 2026-04-30T16:35:53Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Full OrderForm component implementing all 12 requirements (CLIENT-01..03, ORDER-01..08, ORDER-10)
- Live total recalculation on every weight change via pure calcTotal/effectiveTotal functions outside state
- Debounced client search (300ms) with inline Add button in dropdown; blur/click race resolved via onMouseDown
- window.confirm guard when manual_total < 80% of calculated_total; yellow warning strip at discount > 50%
- Post-success screen with 'Новый заказ' reset button and Link to /orders

## Task Commits

Each task was committed atomically:

1. **Task 1: OrderForm — локальный state, derived values, блок товаров** - `ec6ad50` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified
- `src/components/ui/order-form.tsx` — 'use client' component: state management, derived values, client search combobox, payment type tabs, product cards with disabled state, total display, save button

## Decisions Made
- `manual_total` has absolute priority over `discount_percent` when both fields are filled — user explicitly overriding the total is stronger signal than a percentage reduction
- `useTransition` wraps `orderAction` call to expose `isPending` separately from `saving` returned by `useActionState` — both checked in `canSave` for accurate disabled state during transition
- `formKey` state incremented in `resetForm` to remount the form subtree — cleanest way to reset `useActionState` state since it cannot be reset programmatically
- Client section shown always (not gated behind debt payment type) but asterisk marks it as required for debt — reduces UX cognitive load when switching payment types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `OrderForm` is ready to be imported in `src/app/orders/new/page.tsx` (Plan 03-03)
- Props interface: `products: Product[], priceMap: Record<string, number>` — Server Component builds priceMap from getTodayPrices()
- Component handles all ORDER-09 redirect logic externally in the Server Component; ORDER-09 is not in this plan's scope

---
*Phase: 03-orders*
*Completed: 2026-04-30*
