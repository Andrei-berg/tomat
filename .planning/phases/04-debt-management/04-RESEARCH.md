# Phase 4: Debt Management - Research

**Researched:** 2026-05-04
**Domain:** Next.js 16 Server Actions + Supabase debt payment recording + inline Client Component forms
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | Пользователь видит список всех клиентов с остатком долга > 0 | `getDebtors()` in dal.ts already implemented and wired to `/debtors` page; balance computed in JS from orders + debt_payments — no schema work needed |
| DEBT-02 | Пользователь может зафиксировать полное или частичное погашение долга | New Server Action `recordPayment(orderId, amount, paymentType)` → inserts into `debt_payments` + updates `orders.status` to 'partial'/'paid'; requires inline Client Component form on debtors page |
| DEBT-03 | Пользователь может просмотреть историю погашений по каждому долгу | New DAL function `getDebtPayments(orderId)` + new page `/debts/[clientId]` (or reuse client profile pattern) showing per-client debt breakdown with payment history |
</phase_requirements>

## Summary

Phase 4 is substantially pre-built. The `debt_payments` table exists in the schema (with RLS enabled), `getDebtors()` is fully implemented in `dal.ts`, and `/debtors` page renders the debtor list. What's missing is exactly the write path (recording payments) and the history drill-down view.

The core data model decision is already locked in STATE.md: "Debt balance always computed via SQL (never a stored column) to prevent silent drift." In practice the project computes balance in JavaScript (not a SQL VIEW), which is consistent with the no-stored-column principle and matches the existing pattern in `getDebtors()` and `getClientsWithStats()`.

The write path for DEBT-02 requires a new Server Action `recordPayment` that inserts a row into `debt_payments` and updates `orders.status` from 'debt' → 'partial' or 'paid'. The payment form is inline on the `/debtors` page (tap a debtor → expand inline form or navigate to detail page). DEBT-03 needs either a new `/debts/[clientId]` page or an extension of `/clients/[id]` that shows per-order remaining amounts plus payment history rows.

**Primary recommendation:** Add `recordPayment` Server Action + `getDebtPayments` DAL function, then build a `/debts/[clientId]` detail page following the exact pattern of `/clients/[id]/page.tsx` and `/orders/[id]/page.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | Server Components + Server Actions | Already installed; `'use server'` actions pattern established |
| @supabase/ssr | ^0.10.2 | DB access from Server Actions | Already installed; `createClient()` from `/lib/supabase/server` |
| React | 19.2.4 | useActionState for form feedback | Already installed; used in order-form.tsx |
| zod | ^4.3.6 | Input validation in Server Actions | Already installed; project dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| iron-session | ^8.0.4 | Auth verification in every action | `verifySession()` called at top of every Server Action |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side balance computation (JS) | Supabase SQL VIEW | VIEW would need Relationships[] type entry and may complicate free-tier queries; JS computation already proven working |
| Separate /debts/[clientId] page | Extend /clients/[id] page | Separate page keeps concerns clean; client profile already has order history, debt history is different enough |

**Installation:**
No new packages needed. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── actions/
│   │   └── debts.ts          # new: recordPayment Server Action
│   ├── debts/
│   │   └── [clientId]/
│   │       └── page.tsx      # new: per-client debt + payment history
│   └── debtors/
│       └── page.tsx          # EXISTS — add "Погасить" link/button
├── lib/
│   └── dal.ts                # add getDebtPayments(), getClientDebtOrders()
└── types/
    └── database.ts           # EXISTS — debt_payments type already defined
```

### Pattern 1: Server Action for Payment Recording
**What:** `recordPayment` inserts into `debt_payments`, then recomputes remaining per order to update `orders.status`.
**When to use:** DEBT-02 — user submits amount + payment_type for a specific order.
**Example:**
```typescript
// src/app/actions/debts.ts
'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export type RecordPaymentState = { error?: string; success?: boolean } | undefined

export async function recordPayment(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  await verifySession()

  const orderId = formData.get('order_id') as string
  const amountRaw = parseFloat(formData.get('amount') as string)
  const paymentType = formData.get('payment_type') as 'cash' | 'card'

  if (!orderId || isNaN(amountRaw) || amountRaw <= 0) {
    return { error: 'Некорректная сумма' }
  }

  const supabase = createClient()

  // Insert payment
  const { error: payErr } = await supabase.from('debt_payments').insert({
    order_id: orderId,
    amount: amountRaw,
    payment_type: paymentType,
  })
  if (payErr) return { error: payErr.message }

  // Recompute status — fetch order + all payments for it
  const [{ data: order }, { data: payments }] = await Promise.all([
    supabase.from('orders').select('calculated_total, discount_percent, manual_total').eq('id', orderId).single(),
    supabase.from('debt_payments').select('amount').eq('order_id', orderId),
  ])

  if (order) {
    const effective = order.manual_total != null
      ? order.manual_total
      : order.discount_percent
        ? Math.round((order.calculated_total ?? 0) * (1 - order.discount_percent / 100) * 100) / 100
        : (order.calculated_total ?? 0)
    const totalPaid = (payments ?? []).reduce((s, p) => s + p.amount, 0)
    const newStatus = totalPaid >= effective ? 'paid' : 'partial'
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
  }

  revalidatePath('/debtors')
  revalidatePath('/debts')
  return { success: true }
}
```

### Pattern 2: DAL Functions for Debt History
**What:** `getClientDebtOrders` returns debt/partial orders with remaining amount per order; `getDebtPayments` returns payment rows for one order.
**When to use:** DEBT-03 — `/debts/[clientId]` page needs per-order breakdown.
**Example:**
```typescript
// In dal.ts

export type DebtOrderEntry = {
  orderId: string
  createdAt: string
  effectiveTotal: number
  paidTotal: number
  remaining: number
  status: 'debt' | 'partial'
}

export async function getClientDebtOrders(clientId: string): Promise<DebtOrderEntry[]> {
  const supabase = createClient()
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase.from('orders').select('id, created_at, calculated_total, discount_percent, manual_total, status')
      .eq('client_id', clientId)
      .in('status', ['debt', 'partial'])
      .order('created_at', { ascending: false }),
    supabase.from('debt_payments').select('order_id, amount'),
  ])

  const paidByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  return (orders ?? []).map(o => {
    const eff = calcEffective(o)
    const paid = paidByOrder.get(o.id) ?? 0
    return {
      orderId: o.id,
      createdAt: o.created_at,
      effectiveTotal: eff,
      paidTotal: paid,
      remaining: Math.max(0, eff - paid),
      status: o.status as 'debt' | 'partial',
    }
  })
}

export type DebtPaymentRow = {
  id: string
  amount: number
  paid_at: string
  payment_type: 'cash' | 'card'
  notes: string | null
}

export async function getDebtPayments(orderId: string): Promise<DebtPaymentRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('debt_payments')
    .select('id, amount, paid_at, payment_type, notes')
    .eq('order_id', orderId)
    .order('paid_at', { ascending: true })
  return (data ?? []) as DebtPaymentRow[]
}
```

### Pattern 3: Inline Payment Form (Client Component)
**What:** Payment form is a Client Component using `useActionState` — same pattern as used throughout the project.
**When to use:** DEBT-02 — the "Погасить" form on the debtor detail page.
**Example:**
```typescript
// src/components/ui/payment-form.tsx
'use client'
import { useActionState } from 'react'
import { recordPayment } from '@/app/actions/debts'

export default function PaymentForm({ orderId, maxAmount }: { orderId: string; maxAmount: number }) {
  const [state, action, pending] = useActionState(recordPayment, undefined)
  return (
    <form action={action}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="number" name="amount" max={maxAmount} step="0.01" />
      <select name="payment_type">
        <option value="cash">Наличные</option>
        <option value="card">Карта</option>
      </select>
      <button type="submit" disabled={pending}>Погасить</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  )
}
```

### Pattern 4: Server Component Page Skeleton
**What:** `/debts/[clientId]/page.tsx` follows the exact shape of `/clients/[id]/page.tsx` — `await params`, `verifySession()`, parallel data fetching, `notFound()` guard, inline style tokens.
**When to use:** DEBT-03 — debt history page.

### Anti-Patterns to Avoid
- **Storing computed balance in DB:** The decision is locked — balance is always derived from orders + debt_payments. Never add a `balance` column.
- **Skipping status update after payment insert:** Inserting into `debt_payments` without updating `orders.status` means the row stays in debt queries forever even when fully paid.
- **Using `.single()` without null guard:** Pattern in the project is `if (!data) return null` — always guard.
- **Forgetting `revalidatePath`:** After recordPayment, must revalidate `/debtors` (list) and `/debts` (detail) so cached Server Component data refreshes.
- **Async params without await:** In Next.js 16, `params` is a Promise — must `await params` before destructuring (see existing pages).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic UI for payment | Custom state machine | `useActionState` pending state | pending=true during action flight — disable button, show spinner |
| Balance stored column | Custom trigger/function | JS computation at read time | Already proven; stored column risks silent drift per locked decision |
| Custom number formatting | Own format function | `n.toLocaleString('ru-RU', { style:'currency', currency:'RUB' })` | Already used everywhere — `rub()` helper pattern |
| Form reset after success | Complex ref logic | `formKey` state increment (remounts) | See 03-02 decision: `formKey` increment resets form cleanly |

**Key insight:** The balance computation pattern is already battle-tested in `getDebtors()` and `getClientsWithStats()` — copy `calcEffective()` (it's already defined in dal.ts) rather than re-deriving.

## Common Pitfalls

### Pitfall 1: Status Not Updated After Payment
**What goes wrong:** User records payment, row inserted in `debt_payments`, but `orders.status` stays 'debt'. Debtor still appears in `/debtors` even after full payment.
**Why it happens:** Two separate writes (insert payment + update status) are easy to forget the second step.
**How to avoid:** `recordPayment` must always fetch total paid after insert and update status in the same action. See Pattern 1 above.
**Warning signs:** `/debtors` list shows fully-paid debtors with 0 remaining.

### Pitfall 2: RLS Not Configured for debt_payments
**What goes wrong:** Supabase returns empty arrays silently — no error, just no data.
**Why it happens:** `debt_payments` table has RLS enabled (per schema) but no policies may exist yet.
**How to avoid:** Check the Supabase dashboard for existing RLS policies on `debt_payments`. The pattern for this project is anonymous-access policies (same as all other tables). Need to apply: `CREATE POLICY "allow_all" ON public.debt_payments FOR ALL USING (true) WITH CHECK (true);` — same as other tables.
**Warning signs:** `debt_payments` inserts succeed (no JS error) but queries return empty.

### Pitfall 3: Race Condition in Status Update
**What goes wrong:** Two rapid payments for the same order — first updates status to 'partial', second reads stale paid total and also sets 'partial' instead of 'paid'.
**Why it happens:** No transaction isolation in Supabase JS client (free tier).
**How to avoid:** This is an acknowledged limitation (see createOrder comment: "Supabase free tier has no transactions via JS client"). For this internal tool with 1-2 users, the risk is negligible. Document it, don't try to solve it.
**Warning signs:** Rare; only manifests under concurrent use.

### Pitfall 4: Payment Exceeds Remaining Debt
**What goes wrong:** User enters amount larger than the remaining debt. `debt_payments.amount` is stored as-entered. Balance goes negative (overpayment).
**Why it happens:** No server-side validation of amount vs remaining debt.
**How to avoid:** In `recordPayment` action, validate `amountRaw <= remaining`. Fetch order effective total and existing payments before insert. Return error if `amountRaw > remaining`.
**Warning signs:** Negative remaining values in UI, status stuck at 'partial' when it should be 'paid'.

### Pitfall 5: getDebtors Showing Paid Orders
**What goes wrong:** `getDebtors()` queries `.in('status', ['debt', 'partial'])` — but if status update fails after payment insert, fully-paid order stays visible.
**Why it happens:** See Pitfall 1.
**How to avoid:** Ensure status is reliably updated. The `Math.max(0, effective - paid)` guard in the aggregation provides an extra safety net (paid orders show 0 remaining and are filtered out by `if (remaining <= 0) continue`).

## Code Examples

### calcEffective — Already in dal.ts, re-use in Server Action
```typescript
// Source: /home/user/Projects/tomat/src/lib/dal.ts (lines 92-101)
function calcEffective(o: {
  calculated_total: number | null
  discount_percent: number | null
  manual_total: number | null
}): number {
  if (o.manual_total != null) return o.manual_total
  const base = o.calculated_total ?? 0
  if (o.discount_percent) return Math.round(base * (1 - o.discount_percent / 100) * 100) / 100
  return base
}
```
This function is NOT exported — the Server Action must either duplicate it locally or the planner can export it from dal.ts.

### useActionState — established pattern
```typescript
// Source: /home/user/Projects/tomat/src/components/ui/order-form.tsx (established pattern)
const [state, action, pending] = useActionState(serverAction, undefined)
// <form action={action}> ... <button disabled={pending}>
```

### params awaiting — Next.js 16 pattern
```typescript
// Source: /home/user/Projects/tomat/src/app/orders/[id]/page.tsx (line 54)
const { id } = await params
// params is Promise<{id: string}> in Next.js 16
```

### revalidatePath — after mutations
```typescript
// Source: /home/user/Projects/tomat/src/app/actions/orders.ts (line 107)
revalidatePath('/orders')
// For debts: revalidatePath('/debtors') + revalidatePath(`/debts/${clientId}`)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stored balance column | Computed balance from data | Phase 1 decision | Balance always accurate — no sync bugs |
| Next.js params as object | params as Promise | Next.js 15+ | Must `await params` before destructuring |
| `createClient` name | `createSupabaseClient` alias in orders.ts | Phase 3 | Avoid collision with exported client factory |

**Deprecated/outdated:**
- Stored `balance` column pattern: locked out by Phase 1 decision — do not add.

## Open Questions

1. **RLS policies for debt_payments table**
   - What we know: Table has RLS enabled per schema. Project pattern is permissive policies (all other tables).
   - What's unclear: Whether policies were created for `debt_payments` in the initial migration or Supabase dashboard.
   - Recommendation: Wave 0 task must verify/create RLS policy for `debt_payments`. Check Supabase dashboard SQL: `SELECT * FROM pg_policies WHERE tablename = 'debt_payments';`

2. **Where to surface the "Погасить" (Record Payment) UI**
   - What we know: `/debtors` lists debtors; `/clients/[id]` shows client profile. DEBT-02 says "user records partial payment".
   - What's unclear: Should the form be on a dedicated `/debts/[clientId]` page (separate from `/clients/[id]`) or integrated there?
   - Recommendation: Create `/debts/[clientId]/page.tsx` — dedicated debt detail page with per-order breakdown and payment form per order. Link from `/debtors` list items (currently not clickable — they're plain `<div>`, not `<Link>`). This keeps `/clients/[id]` clean and makes the flow obvious.

3. **calcEffective export from dal.ts**
   - What we know: `calcEffective` is a local function in `dal.ts`, not exported.
   - What's unclear: Should it be exported for reuse in the Server Action, or duplicated?
   - Recommendation: Export it from `dal.ts`. It's a pure utility needed in multiple places.

4. **Payment validation: max amount**
   - What we know: Schema has no CHECK constraint limiting payment to remaining debt.
   - What's unclear: Should the Server Action enforce `amount <= remaining`?
   - Recommendation: Yes — fetch effective total and sum of prior payments in the action before inserting. Return `{ error: 'Сумма превышает остаток долга' }` if exceeded.

## Sources

### Primary (HIGH confidence)
- `/home/user/Projects/tomat/src/types/database.ts` — confirmed `debt_payments` table schema (Row/Insert/Update types)
- `/home/user/Projects/tomat/src/lib/dal.ts` — confirmed `getDebtors()`, `getClientsWithStats()`, `calcEffective()` implementations; `DebtorEntry` type
- `/home/user/Projects/tomat/supabase/migrations/20260429000000_initial_schema.sql` — confirmed `debt_payments` table DDL with RLS enabled
- `/home/user/Projects/tomat/src/app/debtors/page.tsx` — confirmed DEBT-01 already implemented (list + totals)
- `/home/user/Projects/tomat/.planning/STATE.md` — confirmed locked decision: "Debt balance always computed via SQL (never a stored column)"
- `/home/user/Projects/tomat/src/app/actions/orders.ts` — established Server Action patterns (`verifySession`, `revalidatePath`, `createSupabaseClient`)
- `/home/user/Projects/tomat/src/app/orders/[id]/page.tsx` — established detail page pattern (`await params`, `notFound()`, inline styles)

### Secondary (MEDIUM confidence)
- Project-wide code audit: `useActionState` pattern confirmed in order-form.tsx; `formKey` reset pattern confirmed in STATE.md decisions

### Tertiary (LOW confidence)
- None — all claims verified from source files directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already installed and in use
- Architecture: HIGH — patterns established in phases 1-3.1; debt_payments schema pre-exists
- Pitfalls: HIGH — derived from existing code patterns and locked decisions; RLS pitfall is MEDIUM (cannot verify without Supabase dashboard access)

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable stack, 30-day validity)
