# Feature Research

**Domain:** Mobile produce sales tracking / street market POS
**Researched:** 2026-04-28
**Confidence:** MEDIUM — core patterns from POS UX research and analogous apps (Khatabook/OkCredit for debt, mobile POS literature for order entry); direct produce-truck POS apps are niche and not well-documented publicly.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features Rustam and the owner will consider baseline. Missing any of these means the app does not replace the notebook.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Daily price setting for all products | Prices change every morning; without this, the whole system is unusable | LOW | One screen, 6 rows with numeric inputs. Must persist per date. |
| Fast order creation on phone | Core value: 30-second sale. Anything slower loses to paper | MEDIUM | Large tap targets, numeric keyboard auto-shown for weight/boxes inputs, no unnecessary confirmation steps |
| Client selection or free-text name | Debt requires a name; anonymous sales still happen | LOW | Dropdown from known clients + "Анонимный" option + raw text input. Debt without a name must be blocked. |
| Line items: product + weight + boxes | Exact shape of how produce is sold — no shortcuts exist | MEDIUM | Auto-populate price from today's prices; show line total instantly; allow multiple product rows |
| Calculated total shown in real time | Seller needs to quote the price before confirming | LOW | Live sum as weight/boxes are entered. No surprises at the end. |
| Manual total override | Seller regularly rounds down or negotiates on the spot | LOW | Editable final field. Must warn if total < 80% of calculated (per business rule). |
| Discount field (%) | Occasional bulk/loyalty discounts | LOW | Optional; auto-calculates deduction from total |
| Payment type: cash / card / debt | These are the only three real-world cases | LOW | Three large toggle buttons. Choosing "debt" must require a client name. |
| Order list (day view) | Seller and owner review what was sold | LOW | Chronological list with client, total, payment type. Tap to view detail. |
| Debt screen per client | Know who owes what right now | MEDIUM | Per-client balance = sum of debt orders minus payments. Must show outstanding amount prominently. |
| Partial debt payment recording | Clients pay off debts in installments | MEDIUM | Record payment amount + payment type (cash/card). Reduce balance. Show history. |
| Period report with payment breakdown | Owner reviews cash vs card vs outstanding at end of day or week | MEDIUM | Date range selector; totals by payment type; product summary table (kg, boxes, revenue) |
| Export to Excel and PDF | Owner needs to share/archive reports outside the app | MEDIUM | Standard export. Excel for numbers, PDF for printing. This is explicitly in scope for v1. |
| Russian UI | Users are non-technical Russian speakers; English is a blocker | LOW | All labels, buttons, messages, validations in Russian. Code stays English. |
| Simple password auth | Two users, same access level, no individual accounts | LOW | Single shared password checked server-side. No OAuth, no sessions per user. |
| Redirect to prices if none set today | Without prices, orders are impossible; guard against this | LOW | First order of day with missing prices → redirect to /prices with message |

---

### Differentiators (Competitive Advantage)

Features beyond replacing the notebook — these make the app noticeably better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Copy prices from yesterday" button | Morning price setup is repetitive; prices rarely change much day-to-day | LOW | One button on /prices that pre-fills today's prices from the last day that has prices. Saves 2 minutes every morning. Confidence: MEDIUM (pattern inferred from workflow analysis; not found in direct competitor docs) |
| Live debt balance on client card | Seller can see total debt while creating a new order — prevents accidentally selling more to a client deep in debt | LOW | Show running debt total next to client name in order creation |
| Inline price display during order entry | Seller does not need to remember or look up today's price | LOW | Show price_per_kg next to product name when adding a line item |
| Warning on anomalous manual total | Catch typos and unusual discounts before they corrupt the data | LOW | Already in business rules: warn at < 80% of calculated. Simple UX modal. |
| Discount > 50% warning | Same category — protect against fat-finger errors | LOW | Already in business rules. Non-blocking warning, not a hard stop. |
| Per-product sales totals in report | Owner can see which tomato type sells best / most kilograms | LOW | Add per-product breakdown (kg, boxes, revenue) to the period report. Included in the snapshot wireframe. |
| Client history (past orders) | Seller can answer "what did we sell you last time?" without digging through notes | MEDIUM | Filter /orders by client. Not needed for v1 but valuable quickly. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately exclude from v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Offline mode | Phone signal can be unreliable at a market stand | Requires local DB sync, conflict resolution, background sync — triples complexity. The business context confirms "always online" is acceptable. | Ensure fast API responses; show clear error when offline instead of silently failing |
| Multi-location / multi-truck support | Owner may want to expand | Adds tenant isolation, routing, per-location pricing — wrong scope for v1 | Design schema with location_id ready (already planned) but do not surface in UI |
| Individual user accounts / roles | Seems like good security practice | Two users with identical permissions; login overhead slows Rustam down with zero benefit | Single shared password is intentionally the right answer here |
| Inventory / stock tracking | Logically related to sales | Produce trucks deal in weights, not discrete units; stock is not counted in this workflow; adds friction to every order | Track only what's sold (weights, boxes, revenue) — which is what matters |
| Push notifications / reminders | Debt reminder automation | Over-engineered for two users; SMS/WhatsApp is faster for this context | Debt screen is the reminder — owner can message client directly |
| Customer-facing receipts / digital invoices | Seems professional | Market customers don't expect receipts; adds email/SMS sending complexity | Optional: add note field to order; address in v2 if requested |
| Barcode scanning | Common in POS | Products are fixed (6 types); no barcodes exist on produce boxes | Fixed product list is already the correct solution |
| Real-time sync / Supabase Realtime for orders | Sounds useful | Two users rarely operate simultaneously; polling on page load is sufficient | Use standard fetch on page load/navigation; Realtime only if concurrent editing is proven to be a problem |
| Advanced analytics / charts | Owner might like dashboards | Adds charting library, aggregation complexity, and features that are useless until there is months of data | Plain period report with totals and product breakdown is the right v1 analytics surface |
| Client self-service portal | Future expansion idea | Completely outside the defined use case; market clients pay in person | Out of scope; log for v2+ backlog |
| Photo attachments on orders | Some debt-tracking apps include this | Adds storage, file handling, UI complexity with marginal value for this workflow | Notes field on order is sufficient |

---

## Feature Dependencies

```
[Daily Price Setting]
    └──required-by──> [Order Creation]
                          └──required-by──> [Order List]
                          └──required-by──> [Debt Screen]
                                                └──required-by──> [Debt Payment Recording]
                          └──required-by──> [Period Report]
                                                └──required-by──> [Export Excel/PDF]

[Client Management (name/list)]
    └──required-by──> [Order Creation (client assignment)]
    └──required-by──> [Debt Screen (per-client view)]

[Order Creation]
    └──enhances──> [Copy Prices from Yesterday] (prices must exist to copy)

[Password Auth]
    └──gates──> [All screens]
```

### Dependency Notes

- **Daily Price Setting required-by Order Creation:** An order cannot be created if no prices exist for today. The redirect guard must be in place before order creation goes live.
- **Client Management required-by Debt Screen:** Debt tracking is meaningless without a client identity. Anonymous orders cannot become debt orders.
- **Order Creation required-by Period Report:** Report has nothing to aggregate without orders. Build in sequence.
- **Export required-by Period Report:** Export is a button on the report screen; the report must work before export is added.

---

## MVP Definition

### Launch With (v1)

Minimum to replace the paper notebook and deliver real value to Rustam and the owner.

- [ ] Password auth (shared password) — gates everything
- [ ] Daily price setting for 6 products — without this, zero sales can be recorded
- [ ] Order creation: client + line items (product/weight/boxes) + payment type + manual total — the primary workflow
- [ ] Order list with basic filtering by date — seller review
- [ ] Debt screen: per-client balance + payment recording — owner's main concern beyond revenue
- [ ] Period report: revenue by payment type + per-product summary — owner's review tool
- [ ] Export to Excel and PDF — explicitly required by owner in project definition
- [ ] Russian UI throughout — non-negotiable for users

### Add After Validation (v1.x)

Features to add once the core loop is proven correct with real data.

- [ ] "Copy prices from yesterday" — first morning after launch will reveal how tedious manual entry is; add immediately if confirmed
- [ ] Client order history view — add when seller asks "can I check what I sold to X?"
- [ ] Live debt balance shown during order creation — add when seller reports creating orders for over-indebted clients

### Future Consideration (v2+)

- [ ] Multi-location support — only if business expands beyond Rustam
- [ ] SMS/WhatsApp debt reminders — only if owner requests automation
- [ ] Customer-facing receipts — only if clients start requesting them
- [ ] Advanced analytics / charts — only after 3+ months of data exists

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Daily price setting | HIGH | LOW | P1 |
| Order creation (full flow) | HIGH | MEDIUM | P1 |
| Order list | HIGH | LOW | P1 |
| Debt screen + payment recording | HIGH | MEDIUM | P1 |
| Period report | HIGH | MEDIUM | P1 |
| Excel/PDF export | HIGH | MEDIUM | P1 |
| Password auth | HIGH | LOW | P1 |
| Copy prices from yesterday | MEDIUM | LOW | P2 |
| Live debt balance during order entry | MEDIUM | LOW | P2 |
| Client order history | MEDIUM | MEDIUM | P2 |
| Charts / analytics | LOW | MEDIUM | P3 |
| Multi-location | LOW | HIGH | P3 |
| Offline mode | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Direct competitors for this specific niche (Russian-speaking produce truck, non-technical seller) are not publicly documented. Analysis draws from analogous products:

| Feature | Khatabook / OkCredit (debt ledger apps) | Square / SumUp (mobile POS) | Our Approach |
|---------|------------------------------------------|------------------------------|--------------|
| Debt/credit tracking | Core feature: per-customer ledger, partial payments, balance display | Basic: "on account" rarely present | Debt is first-class: own screen, per-client balance, partial payments |
| Order entry speed | Not a POS — entry is ledger-style (amount + label) | Full POS: product catalog, tap to add | Hybrid: fixed product list (like POS) but weight-based manual input (like ledger) |
| Daily price changes | Not applicable | Price management exists but assumes stable prices | First-class: prices screen is Day 1 feature; snapshot on order_items |
| Reporting | PDF export of ledger, date range | Full dashboard, analytics | Scoped: period totals, product breakdown, export — no charts in v1 |
| Offline | Yes — critical for remote areas | Yes — with sync | Explicitly out of scope; always-online assumption |
| Multi-user | Per-user accounts | Multiple staff accounts with roles | Single shared password — intentional simplification |

---

## Sources

- POS UX design principles: [Efficient UX Design for Modern POS Systems](https://snabble.io/en/latest/efficient-ux-design-for-modern-pos-systems) (MEDIUM confidence — verified via WebFetch)
- POS UX 16 factors: [The 16 UX Factors of the Point of Sale System](https://medium.com/uxjournal/pos-ux-design-part-one-the-16-ux-factors-in-point-of-sale-b94661936eea) (MEDIUM confidence — verified via WebFetch)
- Debt/credit tracking patterns for small vendors: [Udhar Khata Book on Google Play](https://play.google.com/store/apps/details?id=com.pccomputer.udhar_khata_book&hl=en_US), [OkCredit on App Store](https://apps.apple.com/us/app/okcredit-udhar-bahi-khata/id1488748286) (MEDIUM confidence — multiple sources agree on patterns)
- Daily sales reporting patterns: [Daily Sales Record App](https://www.dailysalesrecordapp.com/) (LOW confidence — single source)
- Mobile checkout UX: [Mobile Checkout Optimization](https://www.convertcart.com/blog/mobile-checkout-optimization) (MEDIUM confidence — multiple sources agree on numeric keyboard pattern)
- Farmers market POS feature survey: [Best Apps for Farmers Market Vendors](https://findhomegrown.com/blog/best-apps-farmers-market-vendors), [Best Farmers Market POS Systems](https://sourceforge.net/software/farmers-market-pos/) (LOW confidence — indirect analogy to produce truck)
- Project context: `/home/user/Projects/tomat/.planning/PROJECT.md`, `/home/user/Projects/tomat/TOMATO_SALES_SNAPSHOT.md`

---

*Feature research for: Mobile produce sales tracking (tomato truck, Rustam)*
*Researched: 2026-04-28*
