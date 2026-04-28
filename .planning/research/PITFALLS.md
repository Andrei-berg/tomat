# Pitfalls Research

**Domain:** Mobile-first POS / sales tracking with debt management (Next.js 15 + Supabase)
**Researched:** 2026-04-28
**Confidence:** HIGH (critical pitfalls verified against official docs, CVE disclosures, and multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Floating-Point Money Arithmetic in JavaScript

**What goes wrong:**
JavaScript's `Number` type is IEEE 754 double-precision float. Simple arithmetic like `0.1 + 0.2` produces `0.30000000000000004`. In this app: `weight_kg * price_per_kg` where weight is `215.3` and price is `45.00` can produce a line_total that is off by fractions of a kopek. Across many line items, rounding errors accumulate. Totals displayed to the user will mismatch what is stored. Worse: the `calculated_total` computed in JavaScript before saving may differ from the PostgreSQL `GENERATED` column computed on the server, creating an audit inconsistency.

**Why it happens:**
Developers treat monetary values as regular numbers. `price_per_kg decimal(10,2)` in the DB is exact, but the moment JavaScript reads it via Supabase client it becomes a float. Every multiplication or addition from that point is subject to IEEE 754 error.

**How to avoid:**
- Use the `decimal.js` library (or `currency.js`) for ALL arithmetic on the client side — never use raw `+`, `*`, `/` on monetary values.
- Store intermediate calculations (line totals, sums) in the DB as `NUMERIC(10,2)` — Postgres NUMERIC is arbitrary-precision exact arithmetic.
- Let the DB do final summation via SQL (`SUM(line_total)`) rather than summing in JavaScript and sending the result.
- The existing schema's `line_total GENERATED ALWAYS AS (weight_kg * price_per_kg) STORED` is correct — trust this server-side value; do NOT recompute it client-side for storage.
- For display-only calculations (live preview while user types), use `decimal.js` and format with `toFixed(2)`. Accept that the display is a preview; the DB is authoritative.

**Warning signs:**
- Totals differ by ±0.01 between what the order-creation form shows and what the saved order shows.
- `SUM(debt_payments.amount) - manual_total` produces values like `-0.000000000000001` instead of `0`.
- `calculated_total` in the orders table differs from the sum of `order_items.line_total` rows.

**Phase to address:**
Database setup phase (schema creation) + Order creation phase (form arithmetic). Add a unit test for `215.3 * 45.00` using `decimal.js` vs native JS to demonstrate the issue is handled.

---

### Pitfall 2: Price Snapshot Corruption — Updating Prices Retroactively

**What goes wrong:**
The `prices` table has one row per `(product_id, date)`. If anyone edits today's price after orders have already been created for today, the `price_per_kg` in `order_items` will be correct (it is a snapshot), but `prices` now has a different value. New orders created after the edit use the new price. A report that re-queries `prices` instead of `order_items.price_per_kg` will produce wrong revenue figures. Additionally, if a developer naively JOINs `prices` for reporting instead of using `order_items.price_per_kg`, historical accuracy is completely broken.

**Why it happens:**
It is tempting during reporting to write `JOIN prices p ON p.product_id = oi.product_id AND p.date = DATE(o.created_at)` to "reconstruct" the price. This looks correct but silently uses the current day's price, not the price at time of sale.

**How to avoid:**
- ALL revenue calculations must reference `order_items.price_per_kg` exclusively — never join back to the `prices` table for financial figures.
- Make this a hard rule in code review: if a query touches both `order_items` and `prices` for amount calculation, it is wrong.
- `line_total` in `order_items` is the canonical per-line amount. `calculated_total` in `orders` is the canonical order amount. Use these, not re-derived figures.
- In the prices UI, warn the user if they try to update a price for a date that already has orders ("Для этой даты уже есть заказы. Цена сохранена только для новых заказов.").

**Warning signs:**
- A report query has `JOIN prices` anywhere in its FROM clause.
- Re-running yesterday's report produces different totals than it did yesterday.
- `order_items.price_per_kg` differs from `prices.price_per_kg` for the same product/date combo.

**Phase to address:**
Database setup phase (seed data + constraints) and Report phase (SQL query review before implementation).

---

### Pitfall 3: Debt Balance Becomes Inconsistent — No Single Source of Truth

**What goes wrong:**
`debt_balance = manual_total - SUM(debt_payments.amount)`. If `manual_total` can be edited after the order is saved (e.g., someone corrects a typo), or if `debt_payments` rows can be deleted, the balance can drift to a value no one agreed to. Worse: if the balance is stored as a cached column and the cache is updated outside a transaction, a network failure mid-update leaves the cached total wrong forever.

**Why it happens:**
Developers add a `current_balance` column to the `orders` table as a convenience for the debt list screen. Updating it requires a separate write that can fail independently of the payment insert. Over time the cache drifts.

**How to avoid:**
- Never store `debt_balance` as a persisted column. Always compute it as `manual_total - SUM(debt_payments.amount)` at query time.
- For the debts screen, use a database view or a Supabase RPC function that returns the live balance. This is the one place a view pays off.
- Make `manual_total` immutable after order save (or at minimum require a separate "void and reissue" flow rather than direct edit). This prevents retroactive confusion about what was owed.
- Use PostgreSQL transactions when inserting a `debt_payment`: the insert and any derived updates happen atomically or not at all.
- For the "total outstanding debt" figure on the dashboard, compute via `SUM(manual_total) - SUM(all debt_payments)` in a single SQL query, never by summing per-order cached values.

**Warning signs:**
- A client shows "balance: 0" but there are unpaid `debt_payments` rows for less than `manual_total`.
- `SUM(debt_payments.amount) > manual_total` for a single order (overpayment not flagged).
- The debt list screen queries `orders.debt_balance` (a stored column) rather than computing it.

**Phase to address:**
Database setup phase (schema — do not add a cached balance column) and Debt screen phase (query design).

---

### Pitfall 4: Supabase Anon Key + Missing RLS = Public Database

**What goes wrong:**
Supabase auto-generates REST APIs from your PostgreSQL schema. The anon key is designed to be public and is used client-side. If Row Level Security (RLS) is not enabled on every table, any person who opens browser DevTools and reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the page source can read, write, or delete all data using a `curl` command. This is not theoretical: in January 2025, 170+ applications built on Supabase were found to have completely exposed databases due to missing RLS.

**Why it happens:**
RLS is opt-in, not default. New tables created in the Supabase dashboard are unprotected until RLS is explicitly enabled. Developers focus on features and add RLS "later." Later never comes.

**How to avoid:**
- Enable RLS on every table immediately at creation time — `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`.
- For this app's simple auth model (shared password, no per-user rows), the RLS policy is: authenticated session = full access, anon = no access. This is enforced by verifying the shared-password cookie server-side (in Next.js middleware or Server Components) before making any Supabase calls.
- Use the Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix) only in Next.js Server Actions and Route Handlers — never in client components.
- Verify RLS is active: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';` — every row must show `rowsecurity = true`.
- Run the Supabase "Security Advisor" in the dashboard before launch; it flags tables without RLS.

**Warning signs:**
- Any table in the Supabase dashboard shows "RLS disabled" badge.
- Client components import `SUPABASE_SERVICE_ROLE_KEY`.
- A `curl` request with the anon key and no auth header returns data.

**Phase to address:**
Database setup phase. This must be the first thing addressed, before any data is inserted. Cannot be retrofitted easily once data exists and queries are written.

---

### Pitfall 5: Next.js Middleware-Only Auth — CVE-2025-29927 Pattern

**What goes wrong:**
If the entire auth model relies on Next.js middleware checking a cookie and redirecting unauthenticated requests, an attacker can bypass it entirely by adding the `x-middleware-subrequest` header to their HTTP request (CVE-2025-29927, CVSS 9.1, March 2025). All protected routes become accessible without a password. The fix is patched in Next.js 15.2.3+, but the architectural lesson remains: middleware alone is not sufficient auth.

**Why it happens:**
Middleware feels like the "one place" to add auth. It is clean and DRY. But it only runs on the edge and can be bypassed or skipped in certain deployment configurations.

**How to avoid:**
- Pin Next.js to `>=15.2.3` in `package.json` to ensure the CVE is patched.
- Treat middleware as UX-only (fast redirect to login page). Do not treat it as the security boundary.
- Re-verify the password cookie in every Server Action and Route Handler that reads or writes data. This is defense in depth: even if middleware is bypassed, the data layer rejects the request.
- Implementation: create a `requireAuth()` utility function that reads and validates the HttpOnly cookie, then call it at the top of every Server Action. One line, consistent.
- Set cookie with `HttpOnly: true`, `Secure: true`, `SameSite: strict`, reasonable `Max-Age`.

**Warning signs:**
- Server Actions do not call `requireAuth()` before accessing Supabase.
- The password check only exists in `middleware.ts`.
- `package.json` shows Next.js version below `15.2.3`.

**Phase to address:**
Auth phase (first feature built). The `requireAuth()` utility must exist before any Server Action is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `debt_balance` as a column | Faster debt list query | Cache drift, wrong balances, trust issues | Never — compute from payments always |
| Use `float` / `DOUBLE PRECISION` for prices in DB | Simpler schema | Inexact arithmetic, penny errors | Never for money columns |
| Skip RLS and use service role key everywhere | No policy writing | Any leaked key = full DB exposure | Never |
| Compute `calculated_total` in JS and send to DB | Simpler server action | Diverges from DB GENERATED column value | Never — let DB generate it |
| Rely solely on middleware for auth | DRY code | Bypassable, CVE pattern | Never for data access; fine for UI redirects only |
| Use `type="number"` for weight/boxes inputs | Simplest HTML | iOS returns empty string for invalid input; `.value` is unreliable | Avoid — use `type="text" inputmode="decimal"` |
| `npm install xlsx` (SheetJS public registry) | Easy install | 2+ year old version with high-severity CVEs | Never — use ExcelJS or SheetJS from their own registry |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase client (browser) | Use service role key with `NEXT_PUBLIC_` prefix | `NEXT_PUBLIC_SUPABASE_ANON_KEY` in browser, `SUPABASE_SERVICE_ROLE_KEY` only in Server Actions |
| Supabase GENERATED column (`line_total`) | Try to INSERT a value into a generated column | Omit `line_total` from INSERT; Postgres computes it automatically. Supabase types will show it as read-only |
| Supabase TypeScript types for generated columns | TypeScript type includes column but SELECT * returns it only if explicitly named | Always `SELECT line_total` explicitly; do not rely on `*` |
| ExcelJS in Next.js Route Handler | Stream a file using `res.write()` (Pages Router pattern) | Use `new Response(buffer, { headers })` in App Router Route Handler; generate buffer with `workbook.xlsx.writeBuffer()` |
| PDF export (jsPDF / react-pdf) | Generate PDF client-side (exposes all data to browser memory) | Generate PDF in a Route Handler on the server; stream to browser |
| Supabase `decimal(10,2)` → JS | Supabase JS client returns NUMERIC columns as `string`, not `number` | Always `parseFloat()` or use `decimal.js` constructor on values coming from Supabase; never assume they are JS numbers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all orders for a report without date filter | Report screen is slow / times out | Always pass date range to query; add index on `orders.created_at` | ~1,000+ orders |
| N+1: fetching debt_payments for each order separately | Debt screen is slow, many DB round trips | Single query with `LEFT JOIN debt_payments` or Supabase `.select('*, debt_payments(*)')` | ~50+ debts |
| Recomputing report totals on every render | Report screen flickers, slow on mobile | Compute once on server in a Server Component or Route Handler; pass result as prop | Every render |
| Generating Excel in memory for very large date ranges | Server OOM / slow download | For MVP scale (hundreds of orders), in-memory is fine. Add streaming if reports grow to 10K+ rows | >10,000 orders |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on any table | Any visitor with the anon key can read/write all business data | Enable RLS on every table at schema creation; verify with `pg_tables` query |
| Service role key in client code | Complete DB bypass — attacker can delete everything | Never use `NEXT_PUBLIC_` prefix for service role key |
| Password stored in plain text (e.g., in `.env` as `PASSWORD=qwerty`) | Trivial to read if env leaks | Store as bcrypt hash; compare with `bcryptjs.compare()` in Server Action |
| Password sent over HTTP (not HTTPS) | Network sniff exposes password | Enforce HTTPS in production; Vercel does this automatically |
| Cookie without `HttpOnly` flag | JavaScript on the page can read the session cookie (XSS risk) | Always set `HttpOnly: true` on auth cookie |
| No rate limiting on login endpoint | Brute-force the shared password in seconds | Add simple rate limiting (e.g., `upstash/ratelimit`) on the login Server Action |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `type="number"` for weight/boxes inputs | iOS shows full keyboard instead of number pad; `.value` returns empty string for values like "215." mid-typing | Use `type="text" inputmode="decimal"` for weight, `inputmode="numeric"` for boxes (integers) |
| Validate on every keystroke | "215." triggers "invalid number" error while user is still typing the decimal | Validate on blur only; suppress errors while field is focused and dirty |
| Small tap targets for product row add/remove | Seller mis-taps while standing, creates wrong order | Minimum 44×44px tap targets; use full-width row tappable area |
| No confirmation before "Завершить" for debt | Seller accidentally creates debt order; customer later disputes | Debt orders specifically need a one-sentence confirmation: "Будет записан долг на X ₽ — подтвердить?" |
| Manual total input (`Финал`) accepts zero | Seller accidentally clears the field, submits a 0 ₽ order | Validate: `manual_total` must be > 0; cannot save if blank |
| Discount > 50% silently allowed | Seller fat-fingers 95% discount, owner sees wrong revenue | Show inline warning "Скидка больше 50%" but do not block — business rule says warn only |
| No "prices not set" guard at order creation | Seller starts entering an order, gets blocked mid-flow | Check prices exist before rendering the order form; redirect to `/prices` if not, with message "Сначала установите цены на сегодня" |
| Numeric keyboard covers input fields on mobile | User cannot see what they are typing | Use `scroll-padding-bottom` and `visualViewport` resize handler to scroll focused input above keyboard |

---

## "Looks Done But Isn't" Checklist

- [ ] **Price snapshot:** `order_items.price_per_kg` is written at insert time from the prices table, NOT read from prices at query time — verify by changing today's price and confirming old orders show the original price.
- [ ] **Debt balance:** The debt screen shows `manual_total - SUM(debt_payments.amount)`, computed in SQL — verify there is no `debt_balance` column being updated on order save.
- [ ] **Partial payment:** Adding a payment updates the debt list immediately and the "outstanding" total is recalculated — verify two rapid payments don't both succeed when the first would bring balance to zero.
- [ ] **RLS active:** Every table has RLS enabled AND a policy — a table with RLS enabled but no policy defaults to DENY ALL, which also breaks the app. Verify queries work after enabling RLS.
- [ ] **Report arithmetic:** Report totals match the sum of individual order amounts — specifically, the "received" total (cash + card) excludes orders with payment_type = debt that haven't been paid yet.
- [ ] **Excel export:** Numbers in Excel cells are numeric type, not text — verify by summing a column in Excel. Text-type numbers don't sum.
- [ ] **Auth cookie expiry:** Session cookie has a `Max-Age` or `Expires` — verify the seller doesn't get logged out mid-shift but also that the session expires eventually.
- [ ] **Empty order guard:** "Завершить" button is disabled when no items have been added — verify in mobile browser, not just desktop.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Floating-point errors already in production data | MEDIUM | Write a one-time migration that recomputes all `line_total` and `calculated_total` values using PostgreSQL NUMERIC arithmetic; amounts that were stored wrong by < 0.01 can be corrected silently |
| RLS not enabled, data was public for some period | HIGH | Enable RLS immediately; rotate Supabase anon key; audit access logs in Supabase dashboard; notify data owner |
| Debt balance cached column drifted | HIGH | Drop the cached column; replace with a computed view; run a reconciliation query to find orders where cached ≠ computed |
| Price snapshot not taken (prices joined at query time) | HIGH | Backfill `price_per_kg` into `order_items` from `prices` table using `(product_id, DATE(created_at))` — only works if prices were never edited after the order date |
| Double-submitted order (two identical orders created) | LOW | Add a `UNIQUE` constraint on a client-generated idempotency key column in `orders`; delete duplicates manually; implement `useFormStatus` going forward |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point arithmetic | Phase: Database + Order creation | Unit test: `decimal.js` vs native JS for `215.3 * 45.00`; integration test: save order and confirm `line_total` matches DB generated column |
| Price snapshot corruption | Phase: Database schema | Query old order after changing price for same date — `order_items.price_per_kg` must not change |
| Debt balance drift | Phase: Database schema (no cached column) + Debt screen | Verify debt screen SQL uses `SUM(debt_payments.amount)` not a column; add payment and confirm balance updates instantly |
| RLS missing | Phase: Database setup (first phase) | `curl` with anon key and no auth header must return 401/empty; Supabase Security Advisor shows green |
| Middleware-only auth | Phase: Auth implementation | Call a Server Action directly (bypass middleware via Postman) — must be rejected without valid cookie |
| CVE-2025-29927 middleware bypass | Phase: Auth implementation | Verify `package.json` has `next >= 15.2.3` |
| Mobile input type="number" | Phase: Order creation form | Test on real iOS device — number pad must appear immediately on field focus |
| Double submit | Phase: Order creation form | Disable submit button with `useFormStatus`; test on slow 3G throttling in Chrome DevTools |
| ExcelJS/SheetJS version with CVEs | Phase: Report + export | `npm audit` shows no high-severity issues for export library |

---

## Sources

- [JavaScript floating point money — Honeybadger](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) — MEDIUM confidence (verified against known IEEE 754 behavior)
- [PostgreSQL NUMERIC vs float for money — Crunchy Data](https://www.crunchydata.com/blog/working-with-money-in-postgres) — HIGH confidence (official PostgreSQL docs confirmed NUMERIC is exact)
- [PostgreSQL NUMERIC official docs](https://www.postgresql.org/docs/current/datatype-numeric.html) — HIGH confidence
- [Supabase RLS — 170 apps exposed, CVE-2025](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — HIGH confidence (corroborated by official Supabase security docs)
- [Supabase Row Level Security official docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [CVE-2025-29927 Next.js Middleware Bypass — Vercel postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) — HIGH confidence (official Vercel source)
- [CVE-2025-29927 NVD detail](https://nvd.nist.gov/vuln/detail/CVE-2025-29927) — HIGH confidence
- [Next.js 15 Server Actions double submit race conditions — Medium](https://medium.com/@mehran.khanjan/3-race-conditions-hiding-in-your-next-js-server-actions-i-shipped-all-3-07a8daf7f515) — MEDIUM confidence
- [inputmode="decimal" vs type="number" on iOS — CSS-Tricks](https://css-tricks.com/finger-friendly-numerical-inputs-with-inputmode/) — HIGH confidence (well-established browser behavior)
- [SheetJS public npm registry CVE warning — SheetJS docs](https://docs.sheetjs.com/docs/demos/static/nextjs/) — HIGH confidence (official SheetJS documentation)
- [Concurrent transaction race conditions — Modern Treasury](https://www.moderntreasury.com/journal/how-to-handle-concurrent-transactions) — MEDIUM confidence

---
*Pitfalls research for: Mobile-first POS / sales tracking (Tomato Sales — Учёт продаж)*
*Researched: 2026-04-28*
