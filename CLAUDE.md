# Tomat — учёт продаж помидоров

Web app tracking tomato sales from a market truck stall. Replaces paper notebooks for seller Rustam.
Box sizes are graded by how many fit across the box width (5 = large, 6 = medium, etc.). Mobile-first, Russian UI, English code.

## Tech Stack

- **Framework:** Next.js 16.x (App Router) + TypeScript
- **Database:** Supabase (PostgreSQL) with RLS
- **Auth:** iron-session, single shared password (`APP_PASSWORD`) — no per-user accounts
- **Styling:** Tailwind CSS v4
- **Export:** ExcelJS (Excel), @react-pdf/renderer (PDF)
- **Validation:** Zod

> **Next.js version note:** This project uses Next.js 16, which has breaking changes vs older versions.
> Read `node_modules/next/dist/docs/` before writing any Next.js-specific code.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run test     # run tests (Vitest)
npm run lint     # ESLint
```

## Critical Rules

**IMPORTANT: Preserve the original code and logic as much as possible. Only change what is necessary.**

**State your assumptions explicitly before writing code. If ambiguous, propose interpretations and ask.**

- **Testing:** `npm run test` must pass before commit
- **Git:** main must be deployable; run build + test before committing
- **Database:** agent creates migrations in `supabase/migrations/`, human executes them manually
- **Debt balance:** never stored — always computed at query time via SQL SUM
- **Price snapshot:** `price_per_kg` is copied into `order_items` at order creation
- **Client types:** `clients.is_regular` splits постоянных (`true`) from разовых/walk-in (`false`). Anonymous cash sale = no client row (`order.client_id` null). Both types get a real `client_id`, so debts are tracked/paid identically; promotion to regular just flips the flag (history preserved).

## Key Files

- `src/lib/dal.ts` — data access layer (all DB queries)
- `src/lib/session.ts` — iron-session auth helpers
- `src/app/actions/` — Server Actions (prices, orders, debts, clients, auth)
- `src/types/database.ts` — Supabase-generated DB types
- `src/components/ui/` — UI components (forms, nav)
- `supabase/migrations/` — SQL migrations (apply manually)
- `.env.local` — environment variables (see `.env.example`)
