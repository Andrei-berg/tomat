# Phase 5: Reports & Export — Research

**Researched:** 2026-05-04
**Domain:** Report aggregation (Supabase) + Excel export (ExcelJS) + PDF export (@react-pdf/renderer) in Next.js 16 Route Handlers
**Confidence:** MEDIUM-HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPORT-01 | Пользователь может посмотреть выручку за период с разбивкой по типам оплаты (наличные / карта / долги не получено) | DAL function `getReportData(from, to)` aggregates orders by payment_type using `calcEffective`; debt "не получено" = sum of debt-status orders' effective totals minus debt_payments received |
| REPORT-02 | Пользователь может посмотреть таблицу ящиков, кг и сумм по каждому товару за период | Join orders → order_items → products; group by product_id; sum boxes_count, weight_kg, line_total |
| REPORT-03 | Пользователь может экспортировать отчёт в Excel | ExcelJS 4.4.0 `workbook.xlsx.writeBuffer()` → Next.js Route Handler `GET /api/report/excel?from=&to=` returns binary Response |
| REPORT-04 | Пользователь может экспортировать отчёт в PDF | `@react-pdf/renderer` v4.x `renderToBuffer(<Doc/>)` → Route Handler `GET /api/report/pdf?from=&to=`; `@react-pdf/renderer` is auto-opted out in Next.js serverExternalPackages |
</phase_requirements>

---

## Summary

Phase 5 has three distinct concerns: data aggregation, Excel export, and PDF export. The data aggregation uses the existing Supabase client patterns (gte/lte date filter on `created_at`, join to `order_items` and `products`) and the existing `calcEffective()` helper. No new database primitives are needed — only new DAL functions.

Excel export uses **ExcelJS 4.4.0** via a Next.js Route Handler. ExcelJS is a pure Node.js library; it runs without configuration changes. `workbook.xlsx.writeBuffer()` returns a `Buffer` (typed as `ExcelJS.Buffer`) that Next.js `new Response(buffer, { headers })` serves directly. The requirement for "числовые ячейки" (numeric cells so Excel can sum them) means data must be inserted as JavaScript numbers, not strings.

PDF export uses **@react-pdf/renderer** v4.x via a separate Route Handler. This library is in Next.js's built-in `serverExternalPackages` auto-opt-out list as of Next.js 15.0.0, so **no `next.config.ts` change is needed** for Next.js 16. There are documented issues with App Router in Next.js 15 for some users, but the official list inclusion means the standard bundler fix is already applied. Tables in react-pdf are built from nested `<View>` flexbox rows — there is no built-in `<Table>` component.

**Primary recommendation:** Two Route Handlers (`GET /api/report/excel` and `GET /api/report/pdf`) sharing one DAL function `getReportData(from, to)`. ExcelJS for Excel (no config needed). @react-pdf/renderer for PDF (no config needed, but verify renderToBuffer works in production build — known sporadic issue in Next.js 15 was unresolved as of Feb 2025; Next.js 16.2.4 in this project is the latest stable, so test early).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | 4.4.0 | Generate `.xlsx` workbooks server-side | Pure Node.js; rich formatting API; `writeBuffer()` returns Buffer for HTTP; numeric cell types supported natively |
| @react-pdf/renderer | 4.x (latest ~4.5.1) | Generate PDF documents server-side | React component model; `renderToBuffer()` for server; auto-opted out of Next.js bundling; 500k+ weekly downloads |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | No additional libraries needed | Date range params parsed from `request.nextUrl.searchParams` using native URL APIs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ExcelJS | SheetJS (xlsx) | SheetJS community edition is on a private CDN (not npm registry) — install friction; ExcelJS is on npm directly |
| ExcelJS | `write-excel-file` | Simpler API, less formatting control; ExcelJS gives column widths, number formats, bold headers |
| @react-pdf/renderer | pdfkit | PDFKit is lower-level (imperative, x/y coordinates); fine for simple text but tables require manual x-y math; react-pdf's flexbox model is better for tabular reports |
| @react-pdf/renderer | Puppeteer/HTML-to-PDF | 50-150 MB binary, slow cold start, overkill for a simple report |

**Installation:**
```bash
npm install exceljs @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

Note: `@react-pdf/renderer` ships its own types; no `@types/` package needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── report/
│   │       ├── excel/
│   │       │   └── route.ts      # GET /api/report/excel?from=&to=
│   │       └── pdf/
│   │           └── route.ts      # GET /api/report/pdf?from=&to=
│   └── report/
│       └── page.tsx              # /report — report UI page (Server Component)
├── components/ui/
│   └── report-form.tsx           # Client Component: date pickers + export buttons
└── lib/
    └── dal.ts                    # Add: getReportData(from, to)
```

### Pattern 1: DAL function getReportData

**What:** Single function fetching all data needed by both the UI page and the export handlers. Avoids duplicated queries.
**When to use:** Called from `/report` page Server Component and from both Route Handlers.

```typescript
// src/lib/dal.ts (addition)
// Source: project patterns (dal.ts existing style) + Supabase JS docs

export type ReportPaymentSummary = {
  cash: number
  card: number
  debtUnpaid: number   // sum of effective totals for debt orders (не получено)
  debtReceived: number // sum of debt_payments in the same period
}

export type ReportProductRow = {
  productId: string
  productName: string
  totalBoxes: number
  totalKg: number
  totalAmount: number
}

export type ReportData = {
  paymentSummary: ReportPaymentSummary
  productRows: ReportProductRow[]
  fromDate: string
  toDate: string
}

export async function getReportData(from: string, to: string): Promise<ReportData> {
  const supabase = createClient()

  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, payment_type, calculated_total, discount_percent, manual_total, status, order_items(product_id, boxes_count, weight_kg, line_total, products(name))')
      .gte('created_at', `${from}T00:00:00+00:00`)
      .lte('created_at', `${to}T23:59:59+00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('debt_payments')
      .select('order_id, amount')
      // no date filter — we want payments on orders in range, regardless of payment date
  ])

  // aggregate payment summary and product rows from orders
  // (see Code Examples section for full implementation)
}
```

**Important note on joins:** As established in Phase 3, Supabase join types aren't inferred when `Relationships: []` — use `unknown` cast pattern from Phase 3 (`data as unknown as RawRow`).

### Pattern 2: Route Handler returning binary file

**What:** Next.js `GET` route handler that calls `verifySession()`, reads `from`/`to` from query params, fetches data, generates file, returns binary `Response`.
**When to use:** Both Excel and PDF export handlers follow this identical structure.

```typescript
// Source: Next.js route.md official docs + ExcelJS writeBuffer pattern

import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/dal'
import { getReportData } from '@/lib/dal'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  await verifySession()

  const sp = request.nextUrl.searchParams
  const from = sp.get('from') ?? new Date().toISOString().split('T')[0]
  const to = sp.get('to') ?? from

  const data = await getReportData(from, to)
  const buffer = await buildExcel(data)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report-${from}-${to}.xlsx"`,
    },
  })
}
```

### Pattern 3: Client-side download trigger

**What:** `<a href="/api/report/excel?from=...&to=...">` or `window.open(url)` from the report page. No JS fetch needed — browser handles binary download natively.
**When to use:** Export buttons on the `/report` page.

```tsx
// Simple anchor-based download — no client-side JS needed
<a
  href={`/api/report/excel?from=${from}&to=${to}`}
  download
>
  Экспорт Excel
</a>
```

### Pattern 4: @react-pdf/renderer server-side PDF

**What:** Build a Document component (pure function using @react-pdf/renderer primitives), render with `renderToBuffer`, return as Response.
**When to use:** `/api/report/pdf` route handler.

```typescript
// Source: react-pdf.org/node official docs
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import type { ReportData } from '@/lib/dal'

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', padding: 4 },
  cell: { flex: 1, fontSize: 10 },
  header: { fontWeight: 'bold', fontSize: 11 },
})

function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Отчёт {data.fromDate} — {data.toDate}</Text>
        {/* payment summary section */}
        {/* product table section */}
      </Page>
    </Document>
  )
}

export async function GET(request: NextRequest) {
  await verifySession()
  // ... parse params, fetch data ...
  const buffer = await renderToBuffer(<ReportDocument data={reportData} />)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${from}-${to}.pdf"`,
    },
  })
}
```

### Anti-Patterns to Avoid

- **Inserting cell values as strings in Excel:** ExcelJS will store them as text, Excel won't sum them. Always use JS `number` type for numeric cells.
- **Computing debt "not received" as all debt orders:** Debt orders with partial payments have partially received funds. Use `calcEffective(order) - (paidByOrder.get(order.id) ?? 0)` for the unpaid portion, then separately sum actual `debt_payments` amounts for "received."
- **Date filter timezone mismatch:** The project uses UTC timestamps in Supabase. `from=2026-05-01` must become `2026-05-01T00:00:00+00:00` and `to=2026-05-01` becomes `2026-05-01T23:59:59+00:00`. The existing `getOrdersByDate` pattern confirms this approach.
- **Importing @react-pdf/renderer in a Client Component:** Must stay server-only. The PDF document component should be a plain function (not `'use client'`), imported only in the Route Handler.
- **Fetching debt_payments by date range instead of by order IDs:** Payments on a debt order created in the period may arrive after the period ends. The canonical approach: filter orders by date, then look up all payments on those order IDs (no date filter on payments). This matches the existing `getClientDebtOrders` pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .xlsx binary generation | Custom XML + ZIP | ExcelJS | OOXML spec is 6000 pages; cell type encoding, shared strings, style indexes are all non-trivial |
| PDF layout engine | Manual x/y positioning | @react-pdf/renderer | Font metrics, line wrapping, page overflow, table splitting across pages are all handled |
| Number formatting in Excel | Regex string format | `worksheet.getColumn('x').numFmt = '#,##0.00'` | Excel uses its own format code language |
| Date range parsing in Route Handler | Custom date logic | `request.nextUrl.searchParams.get('from')` + fallback | URLSearchParams is native Web API available in Next.js route context |

**Key insight:** The hardest part of Excel/PDF generation is the file format details, not the data. Both ExcelJS and @react-pdf/renderer encapsulate format complexity behind clean APIs. Building either from scratch would take weeks and still miss edge cases.

---

## Common Pitfalls

### Pitfall 1: ExcelJS writeBuffer TypeScript type mismatch

**What goes wrong:** `workbook.xlsx.writeBuffer()` returns `ExcelJS.Buffer`, not Node.js `Buffer`. TypeScript may complain when passing to `new Response()`.
**Why it happens:** ExcelJS has its own Buffer typedef.
**How to avoid:** Cast: `const buf = await workbook.xlsx.writeBuffer() as Buffer` — or use `new Response(Buffer.from(await workbook.xlsx.writeBuffer()))`.
**Warning signs:** TypeScript error "ExcelJS.Buffer is not assignable to BodyInit".

### Pitfall 2: @react-pdf/renderer "PDFDocument is not a constructor" error

**What goes wrong:** Route Handler throws this error at runtime in Next.js App Router.
**Why it happens:** Next.js bundler inlines the package; some internal class instantiation breaks. Reported against Next.js 15; may be present in 16.
**How to avoid:** `@react-pdf/renderer` is in Next.js's official `serverExternalPackages` auto-opt-out list as of v15.0.0, which should prevent this. If the error still occurs, explicitly add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
}
```
**Warning signs:** Error only appears after `next build` (not in `next dev`), or only in production.

### Pitfall 3: React import required in Route Handler for JSX

**What goes wrong:** `renderToBuffer(<ReportDocument data={...} />)` fails with "React is not defined".
**Why it happens:** @react-pdf/renderer JSX needs React in scope; Route Handlers don't auto-import React in Next.js 16 (React 19).
**How to avoid:** Add `import React from 'react'` at the top of the Route Handler file that contains JSX.
**Warning signs:** "React is not defined" at runtime.

### Pitfall 4: Supabase join data shape for order_items with product name

**What goes wrong:** `order.order_items[i].products.name` TypeScript type not inferred.
**Why it happens:** `Relationships: []` in database.ts means Supabase types can't infer join shape.
**How to avoid:** Use the established Phase 3 `unknown` cast pattern:
```typescript
type RawOrderItem = OrderItemRow & { products: { name: string } | null }
type RawOrder = OrderRow & { order_items: RawOrderItem[] }
const raw = data as unknown as RawOrder[]
```
**Warning signs:** TypeScript error on `.products.name` access.

### Pitfall 5: Period filter UI — date pickers on mobile

**What goes wrong:** Native `<input type="date">` has poor UX variance on Android browsers (inconsistent locale display, tap area small).
**Why it happens:** Browser inconsistency.
**How to avoid:** Use the same pattern already in `/orders` page: `<input type="date">` with `colorScheme: 'dark'` style. The project has established this works acceptably. No custom date picker library needed.
**Warning signs:** Would only be flagged in browser testing.

---

## Code Examples

### ExcelJS workbook for report

```typescript
// Source: ExcelJS README (github.com/exceljs/exceljs) + project pattern
import ExcelJS from 'exceljs'
import type { ReportData } from '@/lib/dal'

export async function buildExcelReport(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tomat'
  wb.created = new Date()

  // Sheet 1: Revenue by payment type
  const summary = wb.addWorksheet('Выручка')
  summary.columns = [
    { header: 'Тип оплаты', key: 'type', width: 20 },
    { header: 'Сумма', key: 'amount', width: 16 },
  ]
  summary.getRow(1).font = { bold: true }
  summary.addRow({ type: 'Наличные', amount: data.paymentSummary.cash })
  summary.addRow({ type: 'Карта', amount: data.paymentSummary.card })
  summary.addRow({ type: 'Долги (не получено)', amount: data.paymentSummary.debtUnpaid })
  summary.addRow({ type: 'Долги (получено)', amount: data.paymentSummary.debtReceived })
  summary.getColumn('amount').numFmt = '#,##0.00'

  // Sheet 2: Products breakdown
  const products = wb.addWorksheet('Товары')
  products.columns = [
    { header: 'Товар', key: 'name', width: 20 },
    { header: 'Ящики', key: 'boxes', width: 10 },
    { header: 'кг', key: 'kg', width: 10 },
    { header: 'Сумма', key: 'amount', width: 16 },
  ]
  products.getRow(1).font = { bold: true }
  for (const row of data.productRows) {
    products.addRow({
      name: row.productName,
      boxes: row.totalBoxes,
      kg: row.totalKg,
      amount: row.totalAmount,
    })
  }
  products.getColumn('amount').numFmt = '#,##0.00'

  // Return buffer — cast needed for TypeScript
  return wb.xlsx.writeBuffer() as Promise<Buffer>
}
```

### @react-pdf/renderer Document component (table using flexbox)

```typescript
// Source: react-pdf.org/components official docs
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import React from 'react'
import type { ReportData } from '@/lib/dal'

const S = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ccc', paddingVertical: 4 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#333', paddingVertical: 4 },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
})

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

export function ReportDocument({ data }: { data: ReportData }) {
  const { paymentSummary: ps, productRows } = data
  const grandTotal = ps.cash + ps.card + ps.debtUnpaid
  return (
    <Document title={`Отчёт ${data.fromDate}–${data.toDate}`}>
      <Page size="A4" style={S.page}>
        <Text style={S.title}>Отчёт за период {data.fromDate} — {data.toDate}</Text>

        <Text style={S.sectionTitle}>Выручка по типам оплаты</Text>
        <View style={S.headerRow}>
          <Text style={[S.cell, S.bold]}>Тип</Text>
          <Text style={[S.cellRight, S.bold]}>Сумма</Text>
        </View>
        {[
          ['Наличные', ps.cash],
          ['Карта', ps.card],
          ['Долги (не получено)', ps.debtUnpaid],
          ['Долги (получено)', ps.debtReceived],
          ['Итого выручка', grandTotal],
        ].map(([label, value]) => (
          <View key={String(label)} style={S.row}>
            <Text style={S.cell}>{label}</Text>
            <Text style={S.cellRight}>{rub(Number(value))}</Text>
          </View>
        ))}

        <Text style={S.sectionTitle}>По товарам</Text>
        <View style={S.headerRow}>
          <Text style={[S.cell, S.bold]}>Товар</Text>
          <Text style={[S.cellRight, S.bold]}>Ящики</Text>
          <Text style={[S.cellRight, S.bold]}>кг</Text>
          <Text style={[S.cellRight, S.bold]}>Сумма</Text>
        </View>
        {productRows.map(r => (
          <View key={r.productId} style={S.row}>
            <Text style={S.cell}>{r.productName}</Text>
            <Text style={S.cellRight}>{r.totalBoxes}</Text>
            <Text style={S.cellRight}>{r.totalKg.toFixed(1)}</Text>
            <Text style={S.cellRight}>{rub(r.totalAmount)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
```

### DAL: getReportData full implementation sketch

```typescript
// Source: project dal.ts patterns + Supabase JS date filter pattern
import { calcEffective } from '@/lib/dal' // existing helper

export async function getReportData(from: string, to: string): Promise<ReportData> {
  const supabase = createClient()

  const [{ data: rawOrders }, { data: allPayments }, { data: products }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, payment_type, calculated_total, discount_percent, manual_total, status, order_items(product_id, boxes_count, weight_kg, line_total, products(name))')
      .gte('created_at', `${from}T00:00:00+00:00`)
      .lte('created_at', `${to}T23:59:59+00:00`),
    supabase.from('debt_payments').select('order_id, amount'),
    supabase.from('products').select('id, name').order('sort_order'),
  ])

  type RawItem = { product_id: string; boxes_count: number; weight_kg: number; line_total: number; products: { name: string } | null }
  type RawOrd = { id: string; payment_type: string; calculated_total: number | null; discount_percent: number | null; manual_total: number | null; status: string; order_items: RawItem[] }
  const orders = (rawOrders ?? []) as unknown as RawOrd[]

  const paidByOrder = new Map<string, number>()
  for (const p of allPayments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  // Filter payments to only those on orders in our period
  const orderIdsInPeriod = new Set(orders.map(o => o.id))
  let debtReceived = 0
  for (const [orderId, amount] of paidByOrder) {
    if (orderIdsInPeriod.has(orderId)) debtReceived += amount
  }

  const paymentSummary: ReportPaymentSummary = { cash: 0, card: 0, debtUnpaid: 0, debtReceived }
  const productMap = new Map<string, ReportProductRow>()

  for (const prod of products ?? []) {
    productMap.set(prod.id, { productId: prod.id, productName: prod.name, totalBoxes: 0, totalKg: 0, totalAmount: 0 })
  }

  for (const o of orders) {
    const eff = calcEffective(o as Parameters<typeof calcEffective>[0])
    if (o.payment_type === 'cash') paymentSummary.cash += eff
    else if (o.payment_type === 'card') paymentSummary.card += eff
    else if (o.payment_type === 'debt' || o.status === 'partial') {
      const paid = paidByOrder.get(o.id) ?? 0
      paymentSummary.debtUnpaid += Math.max(0, eff - paid)
    }

    for (const item of o.order_items) {
      const row = productMap.get(item.product_id)
      if (row) {
        row.totalBoxes += item.boxes_count
        row.totalKg += item.weight_kg
        row.totalAmount += item.line_total
      }
    }
  }

  return {
    paymentSummary,
    productRows: Array.from(productMap.values()).filter(r => r.totalBoxes > 0 || r.totalKg > 0),
    fromDate: from,
    toDate: to,
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serverComponentsExternalPackages` in next.config | `serverExternalPackages` | Next.js v15.0.0 | Renamed (no functional change); `@react-pdf/renderer` auto-included |
| Manually add `@react-pdf/renderer` to external packages list | Already in Next.js built-in list | v15.0.0 | No next.config change needed |
| SheetJS on private CDN | ExcelJS on npm | Ongoing | SheetJS community edition moved off npm registry; ExcelJS is the straightforward npm alternative |
| `context.params` as object | `context.params` as Promise (must `await params`) | Next.js v15.0.0-RC | Already handled in this project — confirmed in Phase 3 decisions |

**Deprecated/outdated:**
- `serverComponentsExternalPackages` (old Next.js 14 name): replaced by `serverExternalPackages` in Next.js 15+. This project is on 16.2.4, so use the new name.
- `workbook.xlsx.write(res)` (piping to Node response): Works in Pages Router / Express but not in Next.js App Router Route Handlers which use Web API `Response`. Use `writeBuffer()` instead.

---

## Open Questions

1. **@react-pdf/renderer App Router stability in Next.js 16**
   - What we know: `@react-pdf/renderer` is in the official auto-opt-out list since Next.js 15.0.0. An open GitHub issue (#3074) reported "PDFDocument is not a constructor" in Next.js 15.1.6 in February 2025. The latest @react-pdf/renderer version is ~4.5.1 (published ~15 days ago as of May 2026).
   - What's unclear: Whether the February 2025 issue was fixed in a subsequent release of either package.
   - Recommendation: In the first plan (DAL + Excel), include a smoke test for `renderToBuffer` in a minimal route handler before committing to the full PDF plan. If it fails, fall back to PDFKit for the PDF route handler — PDFKit has no App Router compatibility issues (it's a plain Node stream library).

2. **Debt "received" semantics in the report period**
   - What we know: The requirements say "наличные / карта / долги не получено". The spec doesn't define whether "долги не получено" includes payments made before or after the period.
   - What's unclear: Should `debtReceived` include only payments received during the period, or all payments ever made on orders in the period?
   - Recommendation: Report all payments ever made on orders created in the period (not filtered by payment date). This gives the owner the complete picture: "I sold X in debt orders and have received Y of it back." Planner can override if user specifies otherwise.

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`) — Route Handler API, params as Promise, binary Response pattern
- Next.js official docs (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`) — `@react-pdf/renderer` confirmed in auto-opt-out list as of v15.0.0
- ExcelJS README (raw.githubusercontent.com/exceljs/exceljs/master/README.md) — workbook/worksheet/column/row/writeBuffer API — version 4.4.0
- react-pdf.org/node — `renderToBuffer`, `renderToStream`, `renderToFile` API confirmed
- react-pdf.org/components — Document/Page/View/Text/StyleSheet component API confirmed

### Secondary (MEDIUM confidence)
- Multiple WebSearch sources confirming ExcelJS `writeBuffer()` returns `ExcelJS.Buffer` (not `Buffer`) — TypeScript cast needed
- WebSearch + react-pdf issues confirmed `@react-pdf/renderer` auto-opts out of bundling in Next.js 15+ (no config needed)
- react-pdf.org/compatibility — React 19 support added in v4.1.0; Node.js 18/20/21 tested

### Tertiary (LOW confidence)
- GitHub issue #3074 — "PDFDocument is not a constructor" in Next.js 15.1.6 with react-pdf 4.1.6 — unresolved as of Feb 2025; status in Next.js 16 / react-pdf 4.5.x unknown
- pkgpulse.com 2026 comparison article — @react-pdf/renderer recommended for server-side Next.js; treated as LOW because single marketing-adjacent source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — ExcelJS and @react-pdf/renderer verified via official docs and READMEs; versions confirmed
- Architecture: HIGH — Route Handler binary response pattern verified from Next.js official docs; DAL patterns verified from project source
- Pitfalls: MEDIUM — ExcelJS Buffer type issue confirmed from multiple sources; @react-pdf/renderer App Router issue is MEDIUM (exists but may be resolved in newer versions)

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (both libraries are actively maintained; @react-pdf/renderer releases frequently)
