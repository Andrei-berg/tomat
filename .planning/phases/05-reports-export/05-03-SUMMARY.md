---
phase: 05-reports-export
plan: "03"
subsystem: api
tags: [exceljs, react-pdf, xlsx, pdf, route-handler, export]

requires:
  - phase: 05-01
    provides: [getReportData, verifySession, ReportData types, exceljs, "@react-pdf/renderer"]
  - phase: 05-02
    provides: [/report UI page with export anchor links pointing to these route handlers]

provides:
  - GET /api/report/excel — .xlsx binary with Выручка and Товары sheets
  - GET /api/report/pdf — .pdf binary with payment summary and product table

affects:
  - 05-04 (UI verification — export links now have real targets)

tech-stack:
  added: []
  patterns:
    - "Uint8Array cast for Node Buffer → Response BodyInit (works for both ExcelJS and react-pdf)"
    - "Route handler JSX requires .tsx extension (not .ts)"
    - "import React from 'react' required in route handler for react-pdf JSX rendering"

key-files:
  created:
    - src/app/api/report/excel/route.ts
    - src/app/api/report/pdf/route.tsx
  modified: []

key-decisions:
  - "route.tsx extension (not .ts) required for JSX in PDF route handler — TypeScript cannot parse JSX in .ts files"
  - "Uint8Array wrap for ExcelJS.Buffer and react-pdf Buffer — Node.js Buffer is not assignable to BodyInit in this Next.js/TypeScript setup"

patterns-established:
  - "Binary route handler pattern: generate buffer → new Uint8Array(buffer) → new Response(uint8array, { headers })"

requirements-completed:
  - REPORT-03
  - REPORT-04

duration: ~10min
completed: 2026-05-04
---

# Phase 05 Plan 03: Excel and PDF Export Route Handlers Summary

**ExcelJS two-sheet .xlsx and react-pdf A4 .pdf route handlers returning binary downloads with verifySession auth guard**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-04T~
- **Completed:** 2026-05-04T~
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments
- GET /api/report/excel generates a .xlsx with two sheets (Выручка: payment type breakdown; Товары: product breakdown with boxes/kg/amount) using ExcelJS, numeric cells with numFmt
- GET /api/report/pdf generates an A4 PDF with payment summary and product table sections using @react-pdf/renderer ReportDocument component
- Both handlers call verifySession() first, ensuring 401/redirect on invalid session
- Full production build passes (npm run build exits 0) with both routes appearing as dynamic handlers

## Task Commits

1. **Task 1: Excel export Route Handler** - `02c40dd` (feat)
2. **Task 2: PDF export Route Handler** - `2f43352` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/report/excel/route.ts` — GET handler, ExcelJS Workbook, two sheets, Uint8Array cast for BodyInit
- `src/app/api/report/pdf/route.tsx` — GET handler, ReportDocument JSX component, renderToBuffer, Uint8Array cast

## Decisions Made
- Used `.tsx` extension for PDF route (not `.ts` as specified in plan) — JSX parsing requires `.tsx`; this is a correction not a deviation
- Used `new Uint8Array(buffer)` instead of `as Buffer` cast — Node.js Buffer type is not assignable to web `BodyInit` in this TypeScript configuration; Uint8Array is accepted by the web Response API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] File extension .tsx required for JSX in PDF route handler**
- **Found during:** Task 2 (PDF export Route Handler)
- **Issue:** Plan specified `route.ts` but TypeScript cannot parse JSX in `.ts` files — errors "Declaration or statement expected" at JSX lines
- **Fix:** Created file as `route.tsx` instead of `route.ts`
- **Files modified:** src/app/api/report/pdf/route.tsx
- **Verification:** `npx tsc --noEmit` exits 0 after rename
- **Committed in:** 2f43352 (Task 2 commit)

**2. [Rule 1 - Bug] Uint8Array wrap instead of `as Buffer` cast for BodyInit compatibility**
- **Found during:** Task 1 and Task 2
- **Issue:** Plan specified `as Buffer` cast for ExcelJS.Buffer → BodyInit, and direct Buffer from renderToBuffer → Response. Both fail TypeScript: "Buffer is not assignable to BodyInit" due to Node vs browser Buffer type conflict
- **Fix:** `new Uint8Array(excelBuffer as ArrayBuffer)` for Excel; `new Uint8Array(pdfBuffer)` for PDF — Uint8Array is a valid BodyInit
- **Files modified:** src/app/api/report/excel/route.ts, src/app/api/report/pdf/route.tsx
- **Verification:** `npx tsc --noEmit` exits 0; `npm run build` exits 0
- **Committed in:** 02c40dd (Task 1), 2f43352 (Task 2)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for TypeScript correctness. No scope creep. Binary output is identical — Uint8Array wraps the same bytes as Buffer.

## Issues Encountered

- TypeScript Node Buffer vs browser Buffer type conflict: ExcelJS and react-pdf both return Node `Buffer`, but Next.js's type for `new Response()` expects web `BodyInit` which does not include Node `Buffer`. Solution: `new Uint8Array(buffer)` which is a valid `BufferSource` → `BodyInit`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both export endpoints are live and buildable
- /report page (05-02) already has `<a href download>` anchor links pointing to these routes
- Ready for 05-04: browser verification (download actual files, open in Excel/PDF viewer)

---
*Phase: 05-reports-export*
*Completed: 2026-05-04*
