---
phase: 05-reports-export
verified: 2026-05-05T00:00:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "Open /report in browser and verify revenue breakdown renders with real data"
    expected: "Наличные / Карта / Долги (не получено) / Долги (получено) / Итого получено rows all show correct amounts for current month"
    why_human: "Requires live Supabase data; cannot verify aggregation correctness with grep"
  - test: "Click Excel (.xlsx) download button and open in Excel/LibreOffice"
    expected: "Two sheets — Выручка and Товары; numeric cells (can be summed with SUM formula, not stored as text)"
    why_human: "Binary file content verification requires opening in spreadsheet application"
  - test: "Click PDF download button and open in PDF viewer"
    expected: "Cyrillic text renders correctly (Roboto font registered); payment summary section and product table both visible with correct data"
    why_human: "Font rendering and PDF structure require visual inspection; Roboto TTF files exist in public/fonts/ but rendering quality is visual"
  - test: "Navigate to /prices, /orders, /debts — verify Отчёты link appears in NavBar and is highlighted when on /report"
    expected: "NavBar shows Прайс / Заказы / Отчёты links on all protected pages; Отчёты has accent background style when pathname starts with /report"
    why_human: "Active state styling is visual; requires browser navigation"
  - test: "Change date range picker — select a past month — verify report data updates"
    expected: "Page re-fetches and shows product rows with boxes/kg/amount for the new date range; 'Нет заказов за выбранный период' shown when no orders"
    why_human: "router.push re-render cycle and data freshness require browser testing"
---

# Phase 05: Reports & Export Verification Report

**Phase Goal:** Build a date-range report page with revenue breakdown and product totals, plus Excel and PDF export.
**Verified:** 2026-05-05
**Status:** human_needed (all automated checks passed; 5 items require browser verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `getReportData(from, to)` returns `paymentSummary` and `productRows` for the date range | VERIFIED | `src/lib/dal.ts` line 297: full implementation with Promise.all, calcEffective reuse, UTC timestamp filter |
| 2 | Debt unpaid computed as effectiveTotal minus payments received on orders in range | VERIFIED | `dal.ts` line 366-373: `calcEffective(o)` called; `paidByOrder.get(o.id)` subtracted for debt orders |
| 3 | Product rows aggregated from order_items joined to products, ordered by sort_order | VERIFIED | `dal.ts` lines 354-388: products fetched with `order('sort_order')`, map initialized from products table, filtered to products with sales |
| 4 | exceljs and @react-pdf/renderer packages are installed and importable | VERIFIED | `package.json` lines 12 & 15: `"@react-pdf/renderer": "^4.5.1"`, `"exceljs": "^4.4.0"` |
| 5 | User can navigate to /report via NavBar link visible on all protected pages | VERIFIED | `nav-bar.tsx` line 54: `<Link href="/report" style={isReportActive ? activeStyle : inactiveStyle}>Отчёты</Link>`; isReportActive on line 11 |
| 6 | User can see revenue breakdown and product table on /report | VERIFIED | `report-form.tsx`: cash/card/debtUnpaid/debtReceived rows rendered (lines 131-151); product table with boxes/kg/amount (lines 155-177) |
| 7 | Export buttons link to /api/report/excel and /api/report/pdf with query params | VERIFIED | `report-form.tsx` lines 77-78: `exportUrl` builds `/api/report/${format}?from=${from}&to=${to}`; both `<a href download>` tags present |
| 8 | GET /api/report/excel returns .xlsx binary with two sheets and numeric cells | VERIFIED | `route.ts`: ExcelJS Workbook with `addWorksheet('Выручка')` and `addWorksheet('Товары')`; `numFmt = '#,##0.00'`; `writeBuffer()` → `Uint8Array` → Response with correct Content-Type |
| 9 | GET /api/report/pdf returns .pdf binary with payment summary and product table | VERIFIED | `route.tsx`: `ReportDocument` component with payment rows and product table; `renderToBuffer` → `Uint8Array` → Response; Roboto font registered from `public/fonts/` |

**Score:** 9/9 automated truths verified

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lib/dal.ts` | `getReportData`, `ReportData`, `ReportPaymentSummary`, `ReportProductRow` | VERIFIED | All 4 exports confirmed at lines 275, 282, 290, 297; substantive implementation with 93 lines added |
| `package.json` | exceljs and @react-pdf/renderer dependencies | VERIFIED | Lines 12 & 15; both appear in dependencies (not devDependencies) |
| `src/app/report/page.tsx` | Server Component — /report route protected by verifySession | VERIFIED | 35 lines; `verifySession()` first call; `getReportData` called with searchParams; default month range logic present |
| `src/components/ui/report-form.tsx` | Client Component — date range picker + report tables + export buttons | VERIFIED | 234 lines; `'use client'` directive; `useRouter` for date changes; all sections rendered |
| `src/components/ui/nav-bar.tsx` | Updated NavBar with /report link | VERIFIED | `isReportActive = pathname.startsWith('/report')`; Отчёты link with active/inactive style |
| `src/app/api/report/excel/route.ts` | GET handler returning .xlsx binary | VERIFIED | 69 lines; substantive ExcelJS implementation; verifySession + getReportData + writeBuffer |
| `src/app/api/report/pdf/route.tsx` | GET handler returning .pdf binary | VERIFIED | 154 lines; ReportDocument JSX component; Roboto font registration; renderToBuffer; verifySession + getReportData |

**Note on file location:** SUMMARY-04 mentions `src/app/report/ReportForm.tsx` as a modified file (post-checkpoint fix target), but this file does not exist. The actual component is at `src/components/ui/report-form.tsx` and `src/app/report/page.tsx` correctly imports from there. The SUMMARY-04 key-files entry appears to be a documentation error — the CSS variable fix was applied to `src/components/ui/report-form.tsx` (confirmed: `--mk-text` is used throughout, not `--mk-text-1`).

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/report/page.tsx` | `src/lib/dal.ts` | `import { getReportData }` called with searchParams from/to | WIRED | Line 3 import + line 25 call: `const data = await getReportData(from, to)` |
| `src/app/report/page.tsx` | `src/components/ui/report-form.tsx` | `<ReportForm data={data} from={from} to={to} />` | WIRED | Line 5 import + line 31 usage |
| `src/components/ui/report-form.tsx` | `/api/report/excel` | `<a href>` download link with from/to query params | WIRED | Line 78: `exportUrl = /api/report/excel?from=&to=`; line 191 anchor tag |
| `src/components/ui/report-form.tsx` | `/api/report/pdf` | `<a href>` download link with from/to query params | WIRED | Line 78: `exportUrl = /api/report/pdf?from=&to=`; line 210 anchor tag |
| `src/app/api/report/excel/route.ts` | `src/lib/dal.ts` | `import { getReportData, verifySession }` | WIRED | Line 3 import + lines 6 (verifySession) and 14 (getReportData) |
| `src/app/api/report/excel/route.ts` | exceljs | `new ExcelJS.Workbook() → writeBuffer() → Response` | WIRED | Line 4 import; line 16 Workbook; line 59 writeBuffer; line 60 Uint8Array cast |
| `src/app/api/report/pdf/route.tsx` | `src/lib/dal.ts` | `import { getReportData, verifySession }` | WIRED | Line 5 import + lines 132 (verifySession) and 139 (getReportData) |
| `src/app/api/report/pdf/route.tsx` | `@react-pdf/renderer` | `renderToBuffer(<ReportDocument />) → Response` | WIRED | Line 6-14 import; line 145 renderToBuffer; line 146 Uint8Array wrap |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| REPORT-01 | 05-01, 05-02, 05-04 | Пользователь может посмотреть выручку за период с разбивкой по типам оплаты | SATISFIED | ReportForm renders Наличные/Карта/Долги/Итого; getReportData computes all four values |
| REPORT-02 | 05-01, 05-02, 05-04 | Пользователь может посмотреть таблицу ящиков, кг и сумм по каждому товару за период | SATISFIED | ReportForm productRows table with boxes/kg/amount; getReportData aggregates from order_items |
| REPORT-03 | 05-03, 05-04 | Пользователь может экспортировать отчёт в Excel | SATISFIED | GET /api/report/excel: ExcelJS two-sheet workbook with numeric cells and correct Content-Type header |
| REPORT-04 | 05-03, 05-04 | Пользователь может экспортировать отчёт в PDF | SATISFIED | GET /api/report/pdf: ReportDocument with Roboto Cyrillic font, payment summary and product table sections |

All four REPORT requirements from REQUIREMENTS.md are claimed by plans and have implementation evidence. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODO/FIXME/placeholder/stub patterns detected in any phase-modified file. No `return null`, empty implementations, or console.log-only handlers found.

**Notable implementation quality:**
- `import 'server-only'` guard present in all three server-side files (dal.ts additions, excel route, pdf route) — prevents accidental client bundle inclusion
- `verifySession()` is first call in both export route handlers — correct auth pattern
- `Uint8Array` wrapping for ExcelJS and react-pdf buffers — correctly resolves Node Buffer vs web BodyInit type conflict
- `import React from 'react'` present in pdf/route.tsx — required for JSX in route handler context
- Roboto font files confirmed at `public/fonts/Roboto-Regular.ttf` and `public/fonts/Roboto-Bold.ttf`

---

## Commit Verification

All commits from SUMMARYs verified in git log:

| Commit | Task |
|--------|------|
| `bc05452` | Install exceljs and @react-pdf/renderer |
| `6e8702a` | Add ReportData types and getReportData to dal.ts |
| `ec9176e` | Add /report Server Component page |
| `b10f2b5` | Add ReportForm Client Component and NavBar Отчёты link |
| `02c40dd` | Excel export route handler |
| `2f43352` | PDF export route handler |
| `8fc7cb0` | Fix dark background on report page |
| `41f17c5` | Fix --mk-text-1 → --mk-text CSS variable |
| `b6ec232` | Register Roboto font with Cyrillic support |
| `7018006` | Add Отчёт tab to BottomNav |

---

## Human Verification Required

### 1. Revenue breakdown with real data

**Test:** Open /report in browser (log in if needed); verify the Выручка card shows all four rows — Наличные, Карта, Долги (не получено), Долги (получено), Итого получено — with correct monetary values for the current month.
**Expected:** Amounts reflect actual orders in the database; Итого = cash + card + debtReceived (not debtUnpaid).
**Why human:** Requires live Supabase connection; correctness of aggregation logic cannot be confirmed by static analysis alone.

### 2. Excel file opens with numeric cells

**Test:** Click "Excel (.xlsx)" button on /report; open downloaded file in Excel or LibreOffice Calc.
**Expected:** Two sheets named "Выручка" and "Товары"; amount columns contain numeric values (SUM formula works on them, not stored as text); column widths readable.
**Why human:** Binary .xlsx file content validation requires a spreadsheet application.

### 3. PDF renders Cyrillic correctly

**Test:** Click "PDF" button on /report; open downloaded file in a PDF viewer.
**Expected:** Russian text (Наличные, Карта, Товар column headers, product names) renders as text characters — not boxes or missing glyphs. Report title shows date range. Payment summary section and product table both visible.
**Why human:** Font rendering quality (Roboto Cyrillic) requires visual inspection of the rendered PDF.

### 4. NavBar Отчёты active state

**Test:** Navigate to /prices, /orders, /debts — confirm Отчёты link is visible. Click Отчёты — confirm it becomes highlighted (accent background).
**Expected:** Three-link NavBar (Прайс / Заказы / Отчёты) visible on all protected pages; Отчёты shows `rgba(200,67,26,0.12)` accent background when on /report.
**Why human:** Active CSS styling is visual; requires browser navigation.

### 5. Date range picker triggers data refresh

**Test:** On /report, change the "С" (from) date to a month with known orders; observe the data updates.
**Expected:** Page re-renders with data for the new date range; if no orders exist for the period, "Нет заказов за выбранный период" message appears instead of an empty product table.
**Why human:** The router.push → Server Component re-fetch cycle requires live browser testing.

---

## Summary

Phase 05 goal is structurally complete. All 9 automated must-haves verified across 7 artifacts with all 8 key links wired. The data layer (`getReportData`), UI (`/report` page + `ReportForm`), navigation (`NavBar` Отчёты link), and both export route handlers (`/api/report/excel`, `/api/report/pdf`) are implemented, substantive, and connected. TypeScript compiles cleanly. All 10 commits verified in git.

The phase cannot be declared fully passed without browser verification because the primary deliverables — visual report display, Excel numeric cells, PDF Cyrillic rendering — require human inspection. The post-checkpoint fixes in commit `b6ec232` (Roboto font registration) specifically address a failure mode (boxes instead of Cyrillic) that can only be confirmed visually.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
