# Project Research Summary

**Project:** Tomat — Mobile Produce Sales Tracking (Учёт продаж помидоров с фуры)
**Domain:** Mobile-first internal POS + debt ledger web app
**Researched:** 2026-04-28
**Confidence:** HIGH (stack and architecture verified against official docs; features MEDIUM due to niche domain)

## Executive Summary

This is a purpose-built internal tool for two Russian-speaking non-technical users — Rustam (seller) and an owner — who currently track tomato truck sales and customer debt in a paper notebook. The app must replace that notebook, not generalize beyond it. Expert patterns from analogous mobile POS apps and debt-ledger tools (Khatabook, Square) confirm the domain is well-understood: a fast order-entry form with a fixed product list, daily price management, debt tracking per client, and reporting with export. The recommended approach is a mobile-first Next.js 15 App Router app with Supabase as the backend, using Server Components for data fetching and Server Actions for mutations — this avoids client-side data exposure and keeps the phone UI fast with server-rendered initial pages.

The single most important business rule is the price snapshot: `order_items.price_per_kg` must be written at order creation time and never re-derived from the `prices` table. Every financial calculation in reports must use this snapshot. The second most important rule is that debt balances must always be computed live from `SUM(debt_payments.amount)` — never stored as a cached column. These two rules, if violated, produce silently wrong financial data that is expensive to recover from.

The key risks are data integrity (floating-point money arithmetic, price snapshot corruption, debt balance drift) and security (missing RLS on Supabase tables, middleware-only auth bypassed by CVE-2025-29927). Both risk categories are fully mitigable with well-documented patterns: use `currency.js` for client arithmetic, PostgreSQL NUMERIC for stored values, enable RLS on every table at schema creation, pin Next.js to 15.2.3+, and call `verifySession()` inside every Server Action as a second auth layer. None of these mitigations are speculative — they come from official docs and a confirmed CVE disclosure.

## Key Findings

### Recommended Stack

The pre-decided core (Next.js 15, TypeScript, Supabase, Tailwind v4) is the right choice and well-supported. The supporting library choices are unambiguous given the constraints: `iron-session` v8 for shared-password auth (NextAuth is overkill for a single password), `currency.js` v2 for safe money arithmetic (raw JS floats are dangerous for monetary values), `react-hook-form` + `useFieldArray` for the multi-item order form, `react-number-format` with `inputMode="decimal"` for mobile numeric input, `ExcelJS` v4 for styled Excel export (SheetJS Community lacks cell styling), and `@react-pdf/renderer` v4 for PDF generation in a Route Handler.

**Core technologies:**
- Next.js 15.2.3+: Full-stack framework — pin to this version or higher due to CVE-2025-29927 middleware bypass
- Supabase (supabase-js v2): PostgreSQL + storage — service role key server-side only, never NEXT_PUBLIC_
- iron-session v8: Shared-password auth — stateless encrypted httpOnly cookie, no user table needed
- react-hook-form v7 + useFieldArray: Multi-item order form — uncontrolled inputs, per-row validation
- currency.js v2: Client-side money arithmetic — avoids IEEE 754 float errors on weight x price
- ExcelJS v4: Styled .xlsx export — 6.7M weekly downloads, supports cell formatting
- @react-pdf/renderer v4: Server-side PDF generation — JSX-based, works in Route Handlers via renderToBuffer()
- Tailwind CSS v4: Styling — no config file needed, single CSS import

### Expected Features

The full v1 feature set replaces the paper notebook exactly. Every item in the must-have list maps to a current paper workflow; nothing in v1 is speculative.

**Must have (table stakes):**
- Daily price setting for all products — prices change every morning; without this, zero orders can be entered
- Fast order creation: client + line items (product/weight/boxes) + payment type + manual total override
- Order list (day view) with chronological review
- Debt screen: per-client balance computed live + partial payment recording
- Period report: revenue by payment type + per-product summary (kg, boxes, revenue)
- Excel and PDF export — explicitly required by owner
- Russian UI throughout — English labels are a blocker for the actual users
- Shared password auth — gates all screens
- Redirect to /prices if no prices set today — prevents mid-flow blocking

**Should have (competitive):**
- "Copy prices from yesterday" button — eliminates repetitive morning data entry
- Live debt balance shown during order creation — prevents accidentally creating orders for over-indebted clients
- Warning on anomalous manual total (< 80% of calculated) — catches typos before they corrupt data
- Discount > 50% warning — non-blocking warning only, business rule confirmed

**Defer (v2+):**
- Offline mode — triples complexity, always-online is confirmed acceptable
- Multi-location support — schema ready (location_id planned) but not surfaced in v1 UI
- Client order history view — useful but not blocking the notebook replacement
- SMS/WhatsApp debt reminders — over-engineered for two users
- Advanced analytics / charts — premature until 3+ months of data exists

### Architecture Approach

The architecture is a standard Next.js 15 App Router pattern: async Server Components fetch data from Supabase and pass it as props to Client Components that handle interaction. All writes go through Server Actions (`'use server'`); binary file generation (Excel, PDF) goes through Route Handlers because they support streaming binary responses. Middleware provides UX-level auth redirect (fast, no DB call); `verifySession()` inside every Server Action and Route Handler is the authoritative security boundary. There is no public-facing API and no real-time subscriptions — standard page-load fetching is sufficient.

**Major components:**
1. `middleware.ts` (Edge Runtime) — session cookie check, redirects to /login; UX layer only, not security boundary
2. Server Components (pages) — async Supabase data fetching, pass serializable props to Client Components
3. Client Components (OrderForm, PriceForm, DebtPaymentForm) — react-hook-form forms with live calculations
4. `lib/actions/` (Server Actions) — all mutations; each calls `verifySession()` before touching Supabase
5. `app/api/report/` (Route Handlers) — Excel and PDF generation; returns binary buffers
6. `lib/supabase/server.ts` — service role Supabase client, `server-only` import guard
7. `lib/dal.ts` — `verifySession()` with `React.cache` (single cookie read per render pass)

### Critical Pitfalls

1. **Floating-point money arithmetic** — Use `currency.js` for all client-side arithmetic; store as `NUMERIC(10,2)` in Postgres; let the DB `GENERATED` column be authoritative for `line_total`. Never use raw `+`, `*` on monetary values in JS.

2. **Price snapshot corruption** — Write `price_per_kg` into `order_items` at order creation time. Never JOIN back to the `prices` table for financial calculations. Reports must use `order_items.price_per_kg` exclusively.

3. **Debt balance drift** — Never store `debt_balance` as a column. Always compute `manual_total - SUM(debt_payments.amount)` at query time via a view or RPC. Cached columns drift silently.

4. **Missing RLS = public database** — Enable RLS on every table immediately at schema creation. Verify with `pg_tables` query before launch. 170+ apps were publicly exposed in January 2025 due to this omission.

5. **Middleware-only auth (CVE-2025-29927)** — Pin Next.js to `>=15.2.3`. Treat middleware as UI redirect only. Call `verifySession()` inside every Server Action and Route Handler as the real security gate.

## Implications for Roadmap

Based on research, the architecture's build order dependencies map cleanly to 5 phases:

### Phase 1: Foundation (DB Schema + Auth + Project Scaffold)
**Rationale:** Nothing in this app works without a correct schema and auth. RLS must be enabled table-by-table at creation — retrofitting it is high-cost. CVE-2025-29927 mitigation (Next.js version pin + `verifySession()` utility) must exist before any Server Action is written.
**Delivers:** Next.js 15 project wired to Supabase; all DB tables with RLS enabled; `middleware.ts` + `lib/session.ts` + `lib/dal.ts`; login page; generated TypeScript types.
**Addresses:** Password auth, RLS security, CVE mitigation, `server-only` guards on Supabase client.
**Avoids:** Pitfalls 4 (RLS), 5 (middleware-only auth), service role key exposure.

### Phase 2: Daily Prices
**Rationale:** Order creation depends on today's prices being available. The "no prices -> redirect to /prices" guard must exist before the order form is built. Architecture requires prices before orders.
**Delivers:** `/prices` page with PriceForm; `upsertDailyPrices()` Server Action with upsert logic `ON CONFLICT (product_id, date) DO UPDATE`; price-not-set redirect guard; "copy from yesterday" button (low-cost differentiator, build it here).
**Uses:** PriceForm (Client Component), react-hook-form, react-number-format for mobile input.
**Implements:** Server Component -> Client Component data-loader pattern for the first time.

### Phase 3: Order Creation + Order List
**Rationale:** Core value of the app. This is the most complex UI (useFieldArray, live totals, mobile numeric input). Must be built after prices. All subsequent features (debt, reports) depend on orders existing.
**Delivers:** `/orders/new` with OrderForm (multi-item, live calculated total, manual override, payment type, discount); `createOrder()` Server Action with price snapshot; `/orders` list page with date filtering.
**Uses:** useFieldArray, react-number-format, currency.js, Zod validation.
**Implements:** Price snapshot pattern, generated column handling (omit line_total from INSERT), debt payment type requiring client name.
**Avoids:** Pitfalls 1 (float arithmetic), 2 (price snapshot), mobile input type="number" UX failure, double-submit.

### Phase 4: Debt Management
**Rationale:** Depends on orders (debt_payments references order_id; debt screen reads orders with payment_type='debt'). Build after order creation is working with real data.
**Delivers:** `/debts` page with per-client balance computed live (not cached column); `recordDebtPayment()` Server Action; partial payment history; live debt balance shown during order creation.
**Implements:** Computed balance via SQL/view pattern (no cached column), transaction safety for payment inserts.
**Avoids:** Pitfall 3 (debt balance drift), N+1 query for debt_payments.

### Phase 5: Reports + Export
**Rationale:** Last in the dependency chain — aggregates all order data. Export is a sub-task of reporting. Binary file generation must be in Route Handlers, not Server Actions.
**Delivers:** `/report` page with date range selector; revenue by payment type; per-product totals; Excel export via ExcelJS Route Handler; PDF export via @react-pdf/renderer Route Handler.
**Uses:** ExcelJS v4 (`/api/report/excel`), @react-pdf/renderer v4 (`/api/report/pdf`).
**Implements:** Aggregation query using `order_items.price_per_kg` exclusively (not prices table JOIN); numeric cell type in Excel output.
**Avoids:** Pitfall 2 (retroactive price JOIN), performance trap (always use date-range filter, add index on orders.created_at).

### Phase Ordering Rationale

- Foundation -> Prices -> Orders is a hard dependency chain from the architecture: the price-not-set guard requires /prices to exist before /orders/new is reachable.
- Debt after Orders is required because debt_payments has a FK to orders.id; the debt screen only makes sense when orders with payment_type='debt' exist.
- Reports last because they aggregate from orders and debt_payments — nothing to aggregate until both exist.
- Security (RLS, verifySession) is established in Phase 1 and cannot be added retroactively without auditing every action and route handler.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Order Creation):** The most complex UI in the app — useFieldArray with live currency calculations, mobile keyboard behavior, and the price snapshot Server Action pattern. Worth a focused implementation spike on the OrderForm component before committing to the phase plan.
- **Phase 5 (Reports + Export):** ExcelJS and @react-pdf/renderer integration in App Router Route Handlers has specific patterns (buffer vs stream, Content-Disposition headers, binary response in App Router). Verify working example before the phase begins.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Next.js 15 + Supabase + iron-session auth is extremely well-documented; official docs + ARCHITECTURE.md cover it completely.
- **Phase 2 (Prices):** Simple upsert form — standard Server Component + Server Action pattern with no unusual complexity.
- **Phase 4 (Debt):** Computed SQL balance is a known pattern; no external integrations; PITFALLS.md covers the anti-pattern to avoid.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library choices verified against official docs, npm, and GitHub; version pinning confirmed by CVE disclosure |
| Features | MEDIUM | Core features confirmed from workflow analysis and project brief; differentiators inferred from analogous apps (Khatabook, mobile POS literature) — no direct competitor public docs exist for produce truck POS |
| Architecture | HIGH | Official Next.js docs + official Supabase docs; patterns confirmed by Next.js authentication guide and App Router documentation |
| Pitfalls | HIGH | Critical pitfalls sourced from official CVE disclosures (CVE-2025-29927), official Supabase security docs, confirmed 2025 RLS exposure incident, and official PostgreSQL NUMERIC docs |

**Overall confidence:** HIGH

### Gaps to Address

- **"Copy prices from yesterday" UX flow:** Research confirmed this is a low-cost differentiator and the right pattern, but the exact UX (button placement, behavior when partial prices exist for yesterday) should be validated with the actual users on first launch rather than over-designed upfront.
- **Mobile keyboard obscuring inputs:** The `visualViewport` resize handler pattern is confirmed as the right approach, but the exact implementation varies between iOS/Android browser versions. Test on real devices during Phase 3, not just desktop DevTools.
- **Rate limiting on login:** PITFALLS.md flags brute-force risk on the shared-password login. `@upstash/ratelimit` is the recommended solution but requires an Upstash Redis instance. Decide during Phase 1 whether to use it or accept the low risk given the internal-only deployment context.
- **ExcelJS numeric cell type:** Research flags that Excel cells must be numeric type (not text) for column sums to work. This is implementation-level detail to verify during Phase 5 — ExcelJS API for setting cell type is straightforward but easy to miss.

## Sources

### Primary (HIGH confidence)
- [Next.js Docs: Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — iron-session pattern, verifySession, DAL
- [Next.js Docs: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — component boundary patterns
- [Supabase Docs: TypeScript type generation](https://supabase.com/docs/guides/api/rest/generating-types) — generated types workflow
- [Supabase Docs: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS patterns
- [Supabase Docs: API keys](https://supabase.com/docs/guides/api/api-keys) — service role key security
- [CVE-2025-29927 — Vercel postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) — middleware-only auth bypass
- [PostgreSQL NUMERIC docs](https://www.postgresql.org/docs/current/datatype-numeric.html) — exact decimal arithmetic
- [React Hook Form: useFieldArray](https://react-hook-form.com/docs/usefieldarray) — dynamic field array
- [Tailwind CSS v4 + Next.js install](https://tailwindcss.com/docs/guides/nextjs) — v4 setup
- [iron-session GitHub](https://github.com/vvo/iron-session) — App Router support, cookie config
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.5.1, React 19 compat
- [ExcelJS npm](https://www.npmjs.com/package/exceljs) — v4.4.0, download count
- [react-number-format npm](https://www.npmjs.com/package/react-number-format) — v5.4.5

### Secondary (MEDIUM confidence)
- [Efficient UX Design for Modern POS Systems](https://snabble.io/en/latest/efficient-ux-design-for-modern-pos-systems) — mobile POS UX principles
- [Mobile Checkout Optimization](https://www.convertcart.com/blog/mobile-checkout-optimization) — numeric keyboard pattern
- [Khatabook / OkCredit app patterns](https://apps.apple.com/us/app/okcredit-udhar-bahi-khata/id1488748286) — debt ledger feature patterns
- [Supabase RLS exposure — 170 apps](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — RLS omission real-world impact
- [JavaScript floating point money](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) — IEEE 754 in monetary context
- [currency.js GitHub](https://github.com/scurker/currency.js) — v2.0.4 stable, 1M+ weekly downloads
- [inputmode="decimal" vs type="number" on iOS](https://css-tricks.com/finger-friendly-numerical-inputs-with-inputmode/) — confirmed browser behavior
- [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — binary response pattern

### Tertiary (LOW confidence)
- [Best Apps for Farmers Market Vendors](https://findhomegrown.com/blog/best-apps-farmers-market-vendors) — indirect feature analogy only
- [Daily Sales Record App](https://www.dailysalesrecordapp.com/) — single source for reporting patterns

---
*Research completed: 2026-04-28*
*Ready for roadmap: yes*
