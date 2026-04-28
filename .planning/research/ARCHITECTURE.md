# Architecture Research

**Domain:** Mobile-first internal sales tracking web app (Next.js 15 + Supabase)
**Researched:** 2026-04-28
**Confidence:** HIGH (official Next.js docs + official Supabase docs verified)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (mobile-first)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ /login page │  │  App pages   │  │  /orders/new (form)    │  │
│  │ (SC)        │  │  (SC+CC mix) │  │  Client Component      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬─────────────┘  │
│         │                │                      │                │
├─────────┴────────────────┴──────────────────────┴────────────────┤
│                   middleware.ts (Edge Runtime)                    │
│           Checks session cookie → redirect to /login             │
├─────────────────────────────────────────────────────────────────┤
│                     Server Actions (lib/actions/)                 │
│   createOrder · savePrice · submitPayment · generateReport        │
├──────────────────────────┬──────────────────────────────────────┤
│    lib/supabase/          │         lib/session.ts               │
│    server.ts (SC/SA)      │   (Jose JWT encrypt/decrypt)         │
│    client.ts (CC)         │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│                    Supabase (PostgreSQL)                          │
│  products · prices · clients · orders · order_items · payments   │
└─────────────────────────────────────────────────────────────────┘

SC = Server Component   CC = Client Component   SA = Server Action
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| middleware.ts | Session cookie check on every request, redirect to /login if missing | Edge Runtime, reads JWT cookie, no DB call |
| app/(auth)/login | Password form, sets session cookie on success | Client Component form + Server Action |
| app/layout.tsx | Shell, nav, auth wrapper | Server Component |
| Page components (SC) | Fetch data from Supabase, pass to CCs as props | async Server Components |
| OrderForm (CC) | Complex multi-item form with live calculations | `'use client'`, React Hook Form + useFieldArray |
| lib/supabase/server.ts | Supabase client for Server Components and Server Actions | createServerClient from @supabase/ssr |
| lib/supabase/client.ts | Supabase client for Client Components | createBrowserClient from @supabase/ssr |
| lib/session.ts | JWT encrypt/decrypt, cookie get/set/delete | server-only, Jose library |
| lib/actions/ | All data mutations as Server Actions | `'use server'`, validates session then calls Supabase |

## Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout, Server Component
│   ├── middleware.ts                 # Session guard (at src root or project root)
│   ├── (auth)/
│   │   └── login/
│   │       ├── page.tsx              # Login page (Server Component shell)
│   │       └── LoginForm.tsx         # 'use client' — password input + submit
│   ├── page.tsx                      # Home dashboard, Server Component
│   ├── prices/
│   │   └── page.tsx                  # Set daily prices, Server Component + PriceForm CC
│   ├── orders/
│   │   ├── page.tsx                  # Order list, Server Component
│   │   └── new/
│   │       └── page.tsx              # New order, thin SC that renders OrderForm CC
│   ├── debts/
│   │   └── page.tsx                  # Debt list + payment form
│   └── report/
│       └── page.tsx                  # Report with date range, export buttons
├── components/
│   ├── orders/
│   │   ├── OrderForm.tsx             # 'use client' — main complex form
│   │   ├── OrderItemRow.tsx          # 'use client' — single item row (field array item)
│   │   └── OrderSummary.tsx          # 'use client' — live total display
│   ├── prices/
│   │   └── PriceForm.tsx             # 'use client' — daily price entry grid
│   ├── debts/
│   │   └── DebtPaymentForm.tsx       # 'use client' — record partial payment
│   └── ui/                           # Shared primitives (Button, Input, etc.)
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # createServerClient() — for SC, SA, RH
│   │   └── client.ts                 # createBrowserClient() — for CC
│   ├── session.ts                    # server-only: encrypt/decrypt, createSession, deleteSession
│   ├── dal.ts                        # server-only: verifySession() with React.cache
│   └── actions/
│       ├── auth.ts                   # login(), logout() Server Actions
│       ├── orders.ts                 # createOrder(), deleteOrder()
│       ├── prices.ts                 # upsertDailyPrices()
│       ├── debts.ts                  # recordDebtPayment()
│       └── report.ts                 # generateReport() — aggregation query
├── types/
│   └── database.ts                   # Generated Supabase types (supabase gen types)
└── middleware.ts                     # Route guard (at project root, outside src/)
```

### Structure Rationale

- **app/**: Route segments only — thin pages that compose server data-fetching with client components
- **components/**: All Client Components here; co-located with domain (orders/, prices/)
- **lib/supabase/**: Two files because the browser client and server client are different packages (`@supabase/ssr` provides both)
- **lib/actions/**: All `'use server'` functions in one place — easy to audit, always verify session before mutating
- **lib/session.ts**: Marked `server-only` — prevents accidental import into client bundles
- **lib/dal.ts**: Data Access Layer with `verifySession()` using `React.cache` — called at the top of every server data fetch to prevent redundant cookie reads

## Architectural Patterns

### Pattern 1: Server Component as Data Loader, Client Component as Interaction Layer

**What:** Page (Server Component) fetches all data needed for the screen, passes it as props to Client Component(s) that handle user interaction.

**When to use:** Every page in this app. The page is async and awaits Supabase queries; the interactive form or list receives data as initial state.

**Trade-offs:** Keeps bundle small (data fetching code never ships to client). Requires serializable props (no functions, no class instances — primitives, arrays, plain objects only).

**Example:**
```typescript
// app/orders/new/page.tsx — Server Component
import { createServerClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import OrderForm from '@/components/orders/OrderForm'

export default async function NewOrderPage() {
  await verifySession() // redirects to /login if no session
  const supabase = createServerClient()

  const [{ data: products }, { data: todayPrices }, { data: clients }] =
    await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('prices').select('*').eq('date', new Date().toISOString().slice(0, 10)),
      supabase.from('clients').select('id, name').order('name'),
    ])

  return <OrderForm products={products} prices={todayPrices} clients={clients} />
}

// components/orders/OrderForm.tsx — Client Component
'use client'
import { useForm, useFieldArray } from 'react-hook-form'
```

### Pattern 2: Server Actions for All Mutations

**What:** Every write operation is a `'use server'` function called directly from Client Components. No route handlers for internal mutations.

**When to use:** All form submissions — creating an order, saving prices, recording a debt payment.

**Trade-offs:** Simpler than API routes (no fetch, no JSON serialize/deserialize, built-in pending state with `useActionState`). Not callable from external services, but this app has none.

**Example:**
```typescript
// lib/actions/orders.ts
'use server'
import { verifySession } from '@/lib/dal'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOrder(formData: OrderFormData) {
  await verifySession() // security: always check even in server actions

  const supabase = createServerClient()

  // Insert order
  const { data: order } = await supabase
    .from('orders')
    .insert({ client_id: formData.clientId, payment_type: formData.paymentType, ... })
    .select('id')
    .single()

  // Insert order_items — price_per_kg snapshot happens HERE
  await supabase.from('order_items').insert(
    formData.items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      boxes_count: item.boxesCount,
      weight_kg: item.weightKg,
      price_per_kg: item.pricePerKg, // snapshot from today's prices
      // line_total is GENERATED by DB — do not send it
    }))
  )

  revalidatePath('/orders')
}
```

### Pattern 3: Middleware-Only Session Guard (Stateless JWT Cookie)

**What:** `middleware.ts` at project root intercepts every non-public request, reads an encrypted JWT cookie, and redirects to `/login` if absent or expired.

**When to use:** This is the auth layer for the entire app.

**Trade-offs:** Edge-compatible (no DB call in middleware = fast). The JWT contains only `isAuthenticated: true` and an expiry — no user ID needed since all users share the same access level. Must also call `verifySession()` in Server Actions and data fetches as secondary defense (middleware alone is not sufficient per Next.js security guidance after CVE-2025-29927).

**Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_ROUTES = ['/login']

export async function middleware(req: NextRequest) {
  const isPublic = PUBLIC_ROUTES.includes(req.nextUrl.pathname)
  const sessionCookie = req.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)

  if (!isPublic && !session?.isAuthenticated) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isPublic && session?.isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Pattern 4: useFieldArray for Order Items

**What:** The order form manages a dynamic list of order items (0..N products). `useFieldArray` from React Hook Form manages append/remove/update on the items array with a stable `id` per row.

**When to use:** The `/orders/new` form — this is the most complex UI in the app.

**Trade-offs:** useFieldArray keeps the item list in RHF's internal store (uncontrolled) — very performant even with 6 rows. Live `line_total` calculation is done in a `watch()` subscription or `useWatch()` per-row to avoid full re-render of the form. The DB's `GENERATED` column for `line_total` means the server calculation is authoritative; the client calculation is display-only.

**Example:**
```typescript
'use client'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'

type OrderFormValues = {
  clientId: string | null
  clientNameRaw: string
  paymentType: 'cash' | 'card' | 'debt'
  discountPercent: number
  manualTotal: number
  items: Array<{
    productId: string
    boxesCount: number
    weightKg: number
    pricePerKg: number  // pre-filled from today's price, read-only
  }>
}

export function OrderForm({ products, prices, clients }) {
  const { control, handleSubmit, watch } = useForm<OrderFormValues>({
    defaultValues: { items: [], discountPercent: 0, paymentType: 'cash' }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Live total calculation — client-side display only
  const items = watch('items')
  const discountPercent = watch('discountPercent')
  const calculatedTotal = items.reduce(
    (sum, item) => sum + (item.weightKg * item.pricePerKg), 0
  )
  const afterDiscount = calculatedTotal * (1 - discountPercent / 100)
  // ...
}
```

### Pattern 5: Generated Column Handling

**What:** `order_items.line_total` is a PostgreSQL GENERATED ALWAYS column (`weight_kg * price_per_kg`). The application must never try to INSERT or UPDATE this column.

**When to use:** Every insert into `order_items`.

**Trade-offs:** The DB enforces the calculation — server-side totals are always correct regardless of client arithmetic. The TypeScript type from `supabase gen types` will mark `line_total` as non-insertable (it appears in the `Row` type but not `Insert` type). Trust the generated types — if Supabase's type generator doesn't exclude it from `Insert`, manually omit it.

**Example:**
```typescript
// Correct — omit line_total entirely
await supabase.from('order_items').insert({
  order_id: orderId,
  product_id: item.productId,
  boxes_count: item.boxesCount,
  weight_kg: item.weightKg,
  price_per_kg: item.pricePerKg,
  // line_total: DO NOT include — Supabase will reject it
})
```

## Data Flow

### Order Creation Flow

```
User fills OrderForm (CC)
    ↓ handleSubmit → createOrder(formData) [Server Action]
    ↓ verifySession() → session valid?
    ↓ Insert into orders (without line_total)
    ↓ Insert into order_items (price_per_kg snapshot, no line_total)
    ↓ DB GENERATED column computes line_total automatically
    ↓ revalidatePath('/orders')
    ↓ redirect to /orders
Server Component re-fetches fresh data from Supabase
    ↓
Updated order list rendered from server
```

### Authentication Flow

```
Request arrives at any route
    ↓ middleware.ts reads 'session' cookie
    ↓ decrypt(cookie) → { isAuthenticated: true, exp: ... }
    ↓ if no session → redirect /login
    ↓ if session valid → NextResponse.next()
    ↓
Page Server Component calls verifySession() [second layer]
    ↓ React.cache ensures single cookie-read per render pass
    ↓ if invalid → redirect('/login')
    ↓
Data fetched, rendered, streamed to client
```

### Daily Price Setup Flow

```
Seller opens /prices
    ↓ Server Component fetches today's prices (or empty)
    ↓ Passes to PriceForm CC as initialValues
PriceForm shows 6 rows (one per product)
    ↓ User enters prices, submits
    ↓ upsertDailyPrices() Server Action
    ↓ INSERT ... ON CONFLICT (product_id, date) DO UPDATE
    ↓ revalidatePath('/prices'), revalidatePath('/orders/new')
```

### Report + Export Flow

```
User selects date range in report form (CC)
    ↓ generateReport(from, to) Server Action
    ↓ Aggregation query: JOIN orders + order_items + payments
    ↓ Returns structured data (totals by payment type, totals by product)
    ↓ ExcelJS builds .xlsx buffer → Response with blob
    ↓ jsPDF builds .pdf buffer → Response with blob
```

Note: Excel/PDF generation should happen in a Route Handler (`app/api/report/route.ts`), not a Server Action, because they return binary files — Route Handlers give full control over Content-Type and streaming response headers.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 2 users (v1) | Current architecture is perfect. Single Supabase project, no connection pooling needed. |
| 10-50 users (multi-point) | Add `location_id` FK to orders/prices tables. RLS policies in Supabase per location. Session JWT carries `locationId`. |
| 100+ users | Enable Supabase connection pooling (PgBouncer via Supabase dashboard). Add index on `orders.created_at` and `prices.date`. |

### Scaling Priorities

1. **First bottleneck:** `orders` table scan for report generation. Fix: index on `(created_at, status)`, use date-range query.
2. **Second bottleneck:** If multi-tenant, missing `location_id` indexes. Fix: composite index `(location_id, created_at)`.

## Anti-Patterns

### Anti-Pattern 1: Putting Auth Logic Only in Middleware

**What people do:** Check session in `middleware.ts` and assume all routes are protected.

**Why it's wrong:** CVE-2025-29927 (CVSS 9.1) demonstrated that middleware-only auth can be bypassed by manipulating the `x-middleware-subrequest` header on self-hosted Next.js. Server Actions and Route Handlers are separately callable entry points — middleware does not guard them.

**Do this instead:** Middleware provides UX-level redirect (fast, stateless). Call `verifySession()` inside every Server Action and every Route Handler as the authoritative security check. This is the official Next.js recommendation.

### Anti-Pattern 2: Inserting line_total into order_items

**What people do:** Calculate `line_total` client-side and include it in the INSERT payload.

**Why it's wrong:** The column is `GENERATED ALWAYS` — Postgres will reject the insert with an error. Even if it accepted it, the server calculation is the authoritative source; sending a client value risks subtle divergence.

**Do this instead:** Never include `line_total` in INSERT/UPDATE. Read it back in SELECT queries.

### Anti-Pattern 3: Client-Side Supabase for Data Fetching on Initial Load

**What people do:** Mark pages `'use client'` and fetch from Supabase in `useEffect`.

**Why it's wrong:** Forces a loading spinner on every page load, exposes the Supabase anon key unnecessarily from client bundles, and misses Next.js server-side rendering benefits. For this always-online internal tool, SSR means the seller's phone sees content immediately.

**Do this instead:** Pages are Server Components that await Supabase queries directly. Only the interactive form parts (`OrderForm`, `PriceForm`) are Client Components.

### Anti-Pattern 4: Using useState for Order Items Array

**What people do:** Manage the order items list with `useState` directly in the form component.

**Why it's wrong:** Manual tracking of field state, validation, and dirty state becomes unmanageable for 6 products with 3 fields each. No built-in schema validation integration.

**Do this instead:** Use React Hook Form's `useFieldArray`. It handles append/remove, stable keys, validation per row, and integrates with Zod for schema-level validation of the entire order.

### Anti-Pattern 5: Calculating Financial Totals Only on the Client

**What people do:** Rely on JavaScript floating-point arithmetic for money calculations throughout.

**Why it's wrong:** `0.1 + 0.2 !== 0.3` in JavaScript. For financial data (even informal), subtle rounding errors compound across a report.

**Do this instead:** The DB uses `decimal(10,2)` — let the GENERATED column do the authoritative multiplication. For report aggregation sums, let PostgreSQL do the `SUM()`. For client-side display calculations in the form, round to 2 decimal places explicitly: `Math.round(val * 100) / 100`. Do not use floating-point for the final stored value.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase PostgreSQL | `@supabase/ssr` server/client split | Use server client in all SC/SA/RH; browser client only in CC if needed |
| Supabase Realtime | Not used in v1 | Always-online but no live-update requirement |
| ExcelJS | Server-side in Route Handler | Returns binary buffer as application/octet-stream |
| jsPDF | Server-side in Route Handler | Returns binary buffer as application/pdf |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Page (SC) ↔ Form (CC) | Props (serializable only) | Products/prices/clients passed as plain arrays |
| CC ↔ Server Action | Direct function call (`import` + call in submit handler) | No fetch needed; Next.js handles serialization |
| Server Action ↔ Supabase | createServerClient() in every action | Do not share a single client instance across requests |
| Middleware ↔ Session | Reads cookie only, no DB | Decrypt JWT; never call Supabase from middleware |
| Report page ↔ Export | Fetch call to `/api/report/excel` and `/api/report/pdf` | Route Handlers return binary; triggered from button click |

## Build Order Implications

The architecture has these phase dependencies:

1. **Foundation first:** `lib/session.ts`, `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/dal.ts` — nothing works without these. Build in Phase 1 alongside DB schema.

2. **Prices before Orders:** `OrderForm` pre-fills `price_per_kg` from today's prices. If `/prices` is not built first, the order form has no data to work with. The "first order of the day without prices → redirect to /prices" rule requires this route to exist.

3. **Orders before Debts:** `debt_payments` references `order_id`. The debts screen reads orders with `status = 'debt'`. Build orders → then debts.

4. **Orders before Report:** The report aggregates order data. Report page is last.

5. **Export is a Route Handler, not a Server Action:** Schedule it as a sub-task of the Report phase. ExcelJS and jsPDF are installed only when this phase is reached.

## Sources

- [Next.js Docs: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — HIGH confidence (official, April 2026)
- [Next.js Docs: Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — HIGH confidence (official, April 2026)
- [Supabase Docs: Creating a Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence (official)
- [Supabase Docs: Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) — HIGH confidence (official)
- [React Hook Form: useFieldArray](https://react-hook-form.com/docs/usefieldarray) — HIGH confidence (official)
- [Alex Chantastic: Password protecting Next.js with iron-session](https://www.alexchantastic.com/revisiting-password-protecting-next) — MEDIUM confidence (community, verified against official docs pattern)
- [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — MEDIUM confidence (community, consistent with official guidance)
- CVE-2025-29927: Next.js middleware bypass (CVSS 9.1) — affects self-hosted, fixed in Next.js 15.2.3+

---
*Architecture research for: Tomato Sales Tracking App (учёт продаж помидоров)*
*Researched: 2026-04-28*
