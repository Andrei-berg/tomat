# Stack Research

**Domain:** Mobile-first produce sales tracking / POS web app
**Researched:** 2026-04-28
**Confidence:** HIGH (core stack verified via official docs and Context7; library versions verified via npm/GitHub)

---

## Core Technologies (pre-decided, not negotiable)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Next.js | 15.x (15.2.3+ required) | Full-stack React framework, App Router | CVE-2025-29927 middleware bypass — must be on 15.2.3+; earlier versions have a critical auth bypass via `x-middleware-subrequest` header manipulation |
| TypeScript | 5.x | Type safety | Standard Next.js 15 ships with TS 5 |
| Supabase | latest supabase-js v2 | PostgreSQL + Realtime + storage | Use service role key server-side only; never expose via `NEXT_PUBLIC_` prefix |
| Tailwind CSS | v4.x | Utility-first styling | v4 ships Jan 2025; no `tailwind.config.ts` needed, single `@import "tailwindcss"` in globals.css, uses Lightning CSS under the hood |

---

## Recommended Supporting Libraries

### Authentication (simple shared-password, no Supabase Auth)

**Use: `iron-session` v8**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| iron-session | 8.0.1 | Encrypted httpOnly session cookie | Stateless, no DB required, signed+encrypted cookies, official Next.js docs recommend it, full App Router + Server Actions support via `cookies()` API, password must be 32+ chars |

**Pattern:** Single Server Action `login(password)` checks `password === process.env.APP_PASSWORD`, creates iron-session cookie. Middleware at `middleware.ts` reads session and redirects to `/login` if missing. Logout clears the cookie. No user table, no Supabase Auth, no NextAuth.

**Do NOT use:** NextAuth / Auth.js — massive overkill for one shared password. Basic HTTP Auth (`WWW-Authenticate` header) — no UI control, credentials sent plaintext, terrible on mobile.

**Security requirement:** Next.js 15.2.3+ mandatory due to CVE-2025-29927. Session cookie: `httpOnly: true`, `secure: true` (prod), `sameSite: "lax"`.

---

### Forms and Numeric Input (mobile-first)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-hook-form | 7.x (latest) | Form state management | 1.2M+ developers, zero dependencies, minimal re-renders, works with Server Actions via `useActionState`, standard choice for Next.js 15 |
| react-number-format | 5.4.5 | Formatted numeric input for weight/price fields | Formats decimals while typing, `inputMode="decimal"` triggers numeric keyboard on mobile without losing decimal support, integrates with RHF via `Controller` |
| zod | 3.x | Schema validation (client + server) | Share one schema between client-side RHF validation and server-side Server Action validation, `safeParse()` for server error handling |

**Mobile numeric keyboard pattern:**
```tsx
// Triggers decimal-capable numeric keyboard on iOS/Android
<input
  inputMode="decimal"
  pattern="[0-9]*[.,]?[0-9]*"
  type="text"          // NOT type="number" — avoids browser spinner arrows
/>
```

Using `type="number"` on mobile causes UX issues (no comma support on some locales). Use `type="text"` + `inputMode="decimal"` for weight fields and `inputMode="numeric"` for box counts.

---

### Money / Decimal Arithmetic

**Use: `currency.js` v2**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| currency.js | 2.0.4 | Safe monetary arithmetic | ~1kb, works with integers internally (avoids float rounding), handles `weight_kg × price_per_kg` without floating-point errors like `0.1 + 0.2 = 0.30000000000004`, no config needed, TypeScript types included |

**Avoid:** Raw JavaScript float arithmetic (`45.00 * 215.3` → precision errors). Dinero.js is overkill — multi-currency and OOP overhead not needed here. Decimal.js is for scientific precision (significant digits), not money.

**Usage pattern:**
```ts
import currency from "currency.js";

const lineTotal = currency(weight_kg).multiply(price_per_kg);
const afterDiscount = currency(calculated_total).multiply(1 - discount_percent / 100);
// All operations return currency objects; .value for DB, .format() for display
```

**Note:** currency.js last stable release was May 2021 (v2.0.4) — the library is considered feature-complete and stable, not abandoned. 1M+ weekly downloads confirms active use. If this is a concern, `big.js` (actively maintained, ~6kb) is an equivalent safe alternative for decimal arithmetic.

---

### Excel Export

**Use: `ExcelJS` v4**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| exceljs | 4.4.0 | Generate styled .xlsx files | 6.7M weekly downloads, supports cell colors/bold/borders (SheetJS Community Edition lacks cell styling), works in Node.js Next.js Route Handler, streaming support for large files |

**Pattern:** Next.js Route Handler (`/api/export/excel`) generates the workbook server-side, responds with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Client-side button fetches and triggers download.

**Do NOT use:**
- `xlsx` (SheetJS Community Edition) — no cell styling in the free version, commercial features require paid Pro tier
- `react-xlsx-wrapper` / `use-export-excel` — thin wrappers, less control, fewer downloads
- Client-side generation — sends all data to browser, slower, exposes service key if data is fetched client-side

**ExcelJS caveats:** Last published 3 years ago (v4.4.0), but 6.7M weekly downloads and widely used in production. No critical security advisories. If maintenance becomes a concern, `xlsx-js-style` (fork of SheetJS with styling) is the fallback.

---

### PDF Export

**Use: `@react-pdf/renderer` v4**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @react-pdf/renderer | 4.5.1 | Generate report PDFs with JSX syntax | ~500K weekly downloads, JSX-based (feels like React), supports custom fonts/tables/styling, works in Next.js API Route Handler via `renderToBuffer()`, React 19 support since v4.1.0, requires Next.js 14.1.1+ (bug pre-14.1.1 crashed server — we're on 15 so fine) |

**Pattern:** Next.js Route Handler (`/api/export/pdf`) renders the PDF component server-side with `renderToBuffer()`, responds with `Content-Type: application/pdf`. Add to `next.config` if needed:
```js
// next.config.ts — only needed in older setups, verify with current version
serverExternalPackages: ['@react-pdf/renderer']
```

**Do NOT use:**
- Puppeteer — requires full Chromium (~300MB), does not run in Vercel serverless functions without a paid browser service, massive overkill for a simple table report
- jsPDF — client-side imperative API, not React-idiomatic, harder to style complex tables

---

### Supabase Patterns

| Pattern | Details |
|---------|---------|
| TypeScript type generation | `npx supabase gen types typescript --project-id "$PROJECT_REF" > src/types/database.types.ts` — run after schema changes, commit generated file |
| Client creation | One server-side client using service role key (`SUPABASE_SERVICE_ROLE_KEY`), never `NEXT_PUBLIC_SUPABASE_ANON_KEY` from server actions or route handlers |
| RLS | Keep enabled (default since 2025 dashboard default). Since all DB access goes through server-side code only (service role bypasses RLS), RLS provides defense-in-depth. No need to write RLS policies for v1 — service role bypasses them |
| `server-only` guard | Add `import 'server-only'` to any file that creates the Supabase service client, preventing accidental client-side import |
| Price snapshot | Write `price_per_kg` into `order_items` at order creation time (already in schema), never re-derive from `prices` table |

**Two-client pattern:**
```ts
// lib/supabase/server.ts — server actions, route handlers only
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // bypasses RLS
)
```

No need for a public anon client since the app has its own session auth (iron-session) and all data access is server-side.

---

## Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Supabase CLI | latest | Type generation, local dev, migrations | `npx supabase gen types` after schema changes |
| ESLint | 9.x | Linting | Next.js 15 ships with ESLint 9 config |
| Prettier | 3.x | Code formatting | Add `prettier-plugin-tailwindcss` for class sorting |

---

## Installation

```bash
# Core (already decided)
npm install next@latest react@latest react-dom@latest typescript

# Tailwind v4
npm install tailwindcss @tailwindcss/postcss postcss

# Supabase
npm install @supabase/supabase-js

# Auth
npm install iron-session

# Forms + Validation
npm install react-hook-form react-number-format zod

# Money
npm install currency.js

# Excel Export
npm install exceljs

# PDF Export
npm install @react-pdf/renderer

# Dev
npm install -D supabase @types/node
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| iron-session | NextAuth / Auth.js | Overkill for a single shared password; adds 300+ KB, OAuth providers, session DB — none of which we need |
| iron-session | Basic HTTP Auth | Browser's native dialog is unusable on mobile; no styling; credentials sent in Authorization header on every request |
| currency.js | Dinero.js | Multi-currency OOP overhead unnecessary; Dinero v2 requires Intl APIs that add complexity for a single-currency app |
| currency.js | Raw floats | `0.1 * 0.2` in JS yields `0.020000000000000004` — never use floats for money |
| ExcelJS | SheetJS (xlsx free) | No cell styling in Community Edition; Pro version is paid; ExcelJS has better DX for styled reports |
| @react-pdf/renderer | Puppeteer | ~300MB Chromium binary, incompatible with serverless, overkill for simple tables |
| @react-pdf/renderer | jsPDF | Imperative API, not React-idiomatic; harder to build styled table reports |
| react-number-format | type="number" input | Browser spinners (ugly on mobile), no locale-aware comma support, inconsistent behavior across devices |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Supabase Auth / GoTrue | Adds auth complexity, JWT refresh logic, user tables — not needed for shared-password model | iron-session with hardcoded env password |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Service key exposed to client = full DB access for anyone | `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix), server-side only |
| `type="number"` HTML input | Mobile numeric keyboard doesn't show decimal on iOS; browser arrows interfere; `valueAsNumber` returns NaN on empty | `type="text"` + `inputMode="decimal"` + `react-number-format` |
| Supabase Realtime subscriptions | Not needed for this app — users don't need live updates from each other | Standard `fetch` + router.refresh() after mutations |
| Prisma / Drizzle ORM | Extra layer over Supabase's already type-safe JS client; supabase-js with generated types is sufficient | supabase-js with `Database` generic |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| @react-pdf/renderer ^4.5.1 | Next.js 15.x, React 19 | Requires Next.js >= 14.1.1; add to `serverExternalPackages` in next.config if SSR issues appear |
| exceljs ^4.4.0 | Node.js 18+, Next.js Route Handlers | Server-side only; do not import in Client Components |
| iron-session ^8.0.1 | Next.js 15 App Router, React Server Components | Uses `cookies()` from `next/headers` |
| react-number-format ^5.4.5 | React 18/19, react-hook-form v7 | Use `<Controller>` wrapper from RHF for integration |
| zod ^3.x | react-hook-form v7 via `@hookform/resolvers` | Install `@hookform/resolvers` for RHF+Zod bridge |
| tailwindcss ^4.x | Next.js 15 | No `tailwind.config.ts` needed; configure via CSS variables in `globals.css` |

---

## Sources

- [Supabase TypeScript type generation — official docs](https://supabase.com/docs/guides/api/rest/generating-types) — HIGH confidence
- [iron-session GitHub — version + App Router support](https://github.com/vvo/iron-session) — HIGH confidence
- [Next.js middleware CVE-2025-29927 — security advisory](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) — MEDIUM confidence (verified by multiple sources)
- [react-number-format npm](https://www.npmjs.com/package/react-number-format) — v5.4.5 current — HIGH confidence
- [react-pdf compatibility — official](https://react-pdf.org/compatibility) — HIGH confidence
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.5.1 current — HIGH confidence
- [ExcelJS npm](https://www.npmjs.com/package/exceljs) — v4.4.0, 6.7M weekly downloads — HIGH confidence
- [currency.js GitHub](https://github.com/scurker/currency.js) — v2.0.4 stable — MEDIUM confidence (last release 2021 but widely used)
- [Tailwind CSS v4 install with Next.js — official docs](https://tailwindcss.com/docs/guides/nextjs) — HIGH confidence
- [SheetJS Community Edition lacks styling — multiple sources](https://mfyz.com/nodejs-excel-library-comparison) — MEDIUM confidence
- [Supabase service role key security — official docs](https://supabase.com/docs/guides/api/api-keys) — HIGH confidence

---

*Stack research for: Tomato Sales Tracking (Учёт продаж помидоров с фуры)*
*Researched: 2026-04-28*
