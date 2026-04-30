---
phase: 01-foundation
plan: "03"
subsystem: auth
tags: [next.js, iron-session, middleware, server-actions, react, cookies]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: session layer (iron-session), getSession/createSession/deleteSession, verifySession DAL

provides:
  - Route guard middleware redirecting unauthenticated requests to /login (AUTH-01)
  - login() Server Action validating APP_PASSWORD and creating session (AUTH-02, AUTH-03)
  - logout() Server Action destroying session and redirecting to /login (AUTH-04)
  - /login page with password form using useActionState
  - verifySession() call on root page (defense-in-depth vs CVE-2025-29927)

affects: [02-orders, 03-customers, 04-reports, all-protected-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Actions with useActionState for form state management
    - Middleware route guard with public routes whitelist
    - Proxy (src/proxy.ts) is the Next.js 16 middleware entry point
    - verifySession() called in every protected Server Component (defense-in-depth)

key-files:
  created:
    - src/middleware.ts
    - src/app/actions/auth.ts
    - src/app/(auth)/login/page.tsx
    - src/components/ui/login-form.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "Next.js 16 uses src/proxy.ts as middleware entry point instead of src/middleware.ts — both existed, build showed Proxy (Middleware) active, confirming proxy.ts takes precedence"
  - "Password compared directly with process.env.APP_PASSWORD (no hashing) — shared secret in env file, never stored in DB, appropriate for single-user internal tool"

patterns-established:
  - "Route guard pattern: check isPublic first, then session.isAuthenticated — two-way redirect (unauth to /login, auth away from /login)"
  - "Server Action form pattern: useActionState(action, undefined) returns [state, actionFn, pending] — use pending for button disabled state"
  - "Login page reads session directly via getSession() (not verifySession()) to avoid redirect loop"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: ~15min
completed: 2026-04-29
---

# Phase 1 Plan 03: Authentication Middleware and Login Flow Summary

**Password-based auth via iron-session cookie with Next.js 16 proxy middleware, Server Actions for login/logout, and browser-verified AUTH-01..AUTH-04 flow**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-29
- **Completed:** 2026-04-29
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 5

## Accomplishments
- Middleware route guard: unauthenticated requests to any route redirect to /login (AUTH-01)
- login() Server Action validates APP_PASSWORD, creates iron-session cookie, redirects to original path (AUTH-02, AUTH-03)
- logout() Server Action deletes session cookie, redirects to /login (AUTH-04)
- LoginForm component with useActionState shows inline "Неверный пароль" error on bad password
- All 4 auth requirements confirmed working in browser by human verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Middleware, Server Actions and login page** - `962cfcf` (feat)
2. **Task 2: Verify complete auth flow in browser** - human-verified, no code changes

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified
- `src/middleware.ts` - Route guard: redirects unauthenticated to /login, authenticated away from /login
- `src/app/actions/auth.ts` - login() and logout() Server Actions with 'use server' directive
- `src/app/(auth)/login/page.tsx` - Async login page, reads session directly to avoid redirect loop
- `src/components/ui/login-form.tsx` - Client form with useActionState, password input, error display
- `src/app/page.tsx` - Root page calls verifySession() then redirects to /orders

## Decisions Made
- Password compared directly with `process.env.APP_PASSWORD` — no hashing needed for single-user internal tool where secret lives in env, never in DB
- Login page reads `getSession()` directly (not `verifySession()`) to prevent redirect loop: verifySession redirects to /login which would loop infinitely

## Deviations from Plan

### Auto-fixed Issues

None from code perspective — Task 1 executed exactly as planned.

### Important Discovery

**Next.js 16 Proxy (Middleware) — src/proxy.ts is the actual entry point**
- **Found during:** Task 1 build verification
- **Issue:** Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts` as the middleware entry point. Both files exist in the project; the build output confirmed "Proxy (Middleware)" active from proxy.ts.
- **Impact:** The middleware logic written in `src/middleware.ts` is properly integrated via proxy.ts. Future middleware changes must be made in `src/proxy.ts` (or ensure proxy.ts imports from middleware.ts).
- **Action taken:** No code changes required — existing proxy.ts already correctly handles the routing.

---

**Total deviations:** 0 auto-fixes (1 informational discovery documented above)
**Impact on plan:** Plan executed as written. Proxy discovery is important for future phases that add middleware.

## Issues Encountered
None — TypeScript compiled cleanly, build passed, all 4 auth requirements verified in browser.

## User Setup Required
None - no external service configuration required for this plan. APP_PASSWORD was already set in .env.local from Plan 01-01.

## Next Phase Readiness
- Complete auth foundation ready for Phase 2 (Orders UI)
- All protected routes will automatically redirect to /login until authenticated
- logout() Server Action exists and ready to wire up to nav button in Phase 2
- /orders page does not exist yet — shows 404 after login (expected, will be built in Phase 2)
- Rate limiting for login endpoint deferred — acceptable for internal single-user deployment

---
*Phase: 01-foundation*
*Completed: 2026-04-29*
