---
phase: 03-orders
plan: "01"
subsystem: api
tags: [supabase, server-actions, dal, typescript, orders]

requires:
  - phase: 01-foundation
    provides: verifySession, createClient (Supabase server), database.ts types
  - phase: 02-daily-prices
    provides: prices table pattern, dal.ts structure

provides:
  - getOrdersByDate, getOrderById, getOrderWithItems in src/lib/dal.ts
  - createOrder, searchClients, createClient Server Actions in src/app/actions/orders.ts
  - OrderRow, OrderItemRow, ClientRow, OrderWithItems TypeScript types

affects: [03-02, 03-03, 03-04, any orders UI or reporting phase]

tech-stack:
  added: []
  patterns:
    - "DAL functions: createClient() + typed query + null fallback"
    - "Server Action: verifySession() guard + FormData parsing + revalidatePath"
    - "Compensating delete: insert order → insert items → delete order on items failure"
    - "price_per_kg snapshot from FormData — never re-derived from prices table"

key-files:
  created:
    - src/app/actions/orders.ts
  modified:
    - src/lib/dal.ts

key-decisions:
  - "OrderWithItems uses unknown cast for Supabase join result — Relationships:[] means join types aren't inferred, explicit cast is necessary"
  - "createClient renamed to createSupabaseClient in orders.ts to avoid name collision with exported createClient for clients table"

patterns-established:
  - "DAL join pattern: select('*, relation(*, nested(field))') + cast to RawRow + transform"
  - "Server Action compensating delete: Supabase free tier has no JS-client transactions"

requirements-completed: [CLIENT-01, CLIENT-02, CLIENT-03, ORDER-01, ORDER-04, ORDER-09, ORDER-11]

duration: 8min
completed: 2026-04-30
---

# Phase 3 Plan 01: Orders DAL and Server Actions Summary

**Typed server layer for orders: DAL join functions and createOrder/searchClients/createClient Server Actions with compensating delete**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T16:30:32Z
- **Completed:** 2026-04-30T16:38:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended dal.ts with three typed functions: getOrdersByDate (date-range query), getOrderById (single row), getOrderWithItems (join with products name transform)
- Created orders.ts with three Server Actions: searchClients (ilike, limit 8), createClient (trim + insert), createOrder (full FormData parse + compensating delete)
- price_per_kg snapshot correctly read from FormData — not recalculated from prices table

## Task Commits

1. **Task 1: Добавить DAL-функции для заказов в dal.ts** - `587813a` (feat)
2. **Task 2: Создать src/app/actions/orders.ts** - `692bddb` (feat)

## Files Created/Modified

- `src/lib/dal.ts` - Added OrderRow/OrderItemRow/ClientRow/OrderWithItems types + getOrdersByDate, getOrderById, getOrderWithItems functions
- `src/app/actions/orders.ts` - New file: CreateOrderState, ClientResult types; searchClients, createClient, createOrder Server Actions

## Decisions Made

- `OrderWithItems` requires `as unknown as RawRow` cast because `Relationships: []` in database.ts means Supabase PostgREST types don't infer join shapes — explicit cast is the correct approach per the existing pattern
- `createClient` (Supabase factory) renamed to `createSupabaseClient` locally in orders.ts to avoid shadowing the exported `createClient` action for the clients table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error on getOrderWithItems join result**
- **Found during:** Task 1 (DAL functions)
- **Issue:** `data.order_items` was `never` because Supabase join not typed when `Relationships: []`; initial approach with `data as unknown` at spread caused TS2698
- **Fix:** Cast `data` to explicit `RawRow` type alias before accessing fields, then spread
- **Files modified:** src/lib/dal.ts
- **Verification:** `npx tsc --noEmit` — zero errors
- **Committed in:** 587813a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (TypeScript type narrowing for Supabase join)
**Impact on plan:** Necessary for type correctness. No scope creep.

## Issues Encountered

None beyond the TypeScript join type narrowing fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DAL and Server Actions layer complete — ready for 03-02 (order form UI), 03-03 (orders list page), 03-04 (debt management)
- All three Server Actions fully typed and export-ready for Client Components
- No blockers

---
*Phase: 03-orders*
*Completed: 2026-04-30*
