# Phase 1: Foundation - Research

**Researched:** 2026-04-29
**Domain:** Next.js 15 App Router + Supabase schema + custom shared-password auth
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Неаутентифицированный пользователь перенаправляется на /login с любой страницы | Middleware + verifySession() pattern — see Architecture Patterns |
| AUTH-02 | Пользователь входит с одним общим паролем | iron-session stateless cookie + shared password in env — see Code Examples |
| AUTH-03 | Сессия сохраняется после обновления браузера | iron-session httpOnly cookie, 14-day TTL — see Standard Stack |
| AUTH-04 | Пользователь может выйти из системы | deleteSession() + redirect('/login') Server Action — see Code Examples |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire project: Next.js 15 app scaffold, Supabase database schema with RLS on every table, and a custom shared-password auth layer. The auth is intentionally minimal — no user accounts, no Supabase Auth — just a single password checked server-side, a session stored in an encrypted httpOnly cookie via `iron-session`, and middleware redirecting unauthenticated requests to `/login`.

The critical security constraint from STATE.md is to pin Next.js >= 15.2.3 due to CVE-2025-29927 (middleware bypass via `x-middleware-subrequest` header, CVSS 9.1). Middleware alone is NOT sufficient for security — `verifySession()` must also be called in every Server Action and Route Handler that touches data.

The Supabase schema is fully defined in TOMATO_SALES_SNAPSHOT.md (6 tables). RLS must be enabled per-table in the same migration that creates it. Because this app uses a custom auth (not Supabase Auth), all RLS policies will use `service_role` or a pattern where the app accesses Supabase via the service role key server-side (bypassing RLS) — this is a deliberate architecture decision given single-user access model.

**Primary recommendation:** Scaffold with `create-next-app` (Next.js >= 15.2.3), install `iron-session` for stateless sessions, set up Supabase CLI migrations with RLS + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table, and gate all routes via middleware + `verifySession()` DAL function.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | >= 15.2.3 | App framework (App Router, Server Actions, Middleware) | Pin for CVE-2025-29927 fix |
| typescript | ^5 | Type safety | Project requirement |
| @supabase/supabase-js | ^2 | Supabase client (DB queries) | Official JS client |
| @supabase/ssr | ^0.5 | Server-side Supabase client for Next.js | Cookie-aware server client |
| iron-session | ^8 | Encrypted stateless session cookie | Official Next.js docs recommendation; no DB needed |
| tailwindcss | ^3 or ^4 | Utility CSS | Project requirement |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3 | Password form validation on server | Validate login form input server-side |
| server-only | ^0.0.1 | Prevents session/DAL code from leaking to client | Import at top of session.ts and dal.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iron-session | jose (JWT) | Jose is lower-level; iron-session wraps it with cookie management; iron-session is simpler for this use case |
| iron-session | NextAuth.js | NextAuth adds user accounts, OAuth — massively over-engineered for a single shared password |
| Supabase service_role server access | Supabase anon + RLS policies | With custom auth (not Supabase Auth) there is no `auth.uid()` — service_role on server is cleaner |

**Installation:**
```bash
npx create-next-app@latest tomat --typescript --tailwind --app --src-dir --import-alias "@/*"
cd tomat
npm install iron-session @supabase/supabase-js @supabase/ssr zod server-only
npm install -D supabase
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Login form (Server Component)
│   ├── (protected)/
│   │   └── layout.tsx            # Optional layout; auth enforced in middleware + verifySession
│   ├── api/
│   │   └── session/
│   │       └── route.ts          # GET session for client components (if needed)
│   ├── actions/
│   │   └── auth.ts               # login(), logout() Server Actions
│   ├── layout.tsx
│   └── page.tsx                  # Redirects to /login or /orders
├── lib/
│   ├── session.ts                # iron-session config + createSession/deleteSession
│   ├── dal.ts                    # verifySession() — called in every Server Action/Component
│   └── supabase/
│       ├── server.ts             # createClient() for Server Components/Actions
│       └── client.ts             # createBrowserClient() for Client Components
├── components/
│   └── ui/
│       └── login-form.tsx        # 'use client' login form with useActionState
├── types/
│   └── database.ts               # Generated Supabase types (supabase gen types)
└── middleware.ts                 # Route protection + redirect to /login
supabase/
├── migrations/
│   └── 20260429000000_initial_schema.sql
└── seed.sql                      # INSERT INTO products (6 tomato varieties)
```

### Pattern 1: Stateless Session with iron-session

**What:** Shared password checked server-side; session stored as encrypted httpOnly cookie; no database session table needed.

**When to use:** Exactly this case — single shared password, no per-user data in session.

**Example:**
```typescript
// src/lib/session.ts
// Source: https://github.com/vvo/iron-session + https://nextjs.org/docs/app/guides/authentication
import 'server-only'
import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  isAuthenticated: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET!, // min 32 chars
  cookieName: '_tomat_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function createSession() {
  const session = await getSession()
  session.isAuthenticated = true
  await session.save()
}

export async function deleteSession() {
  const session = await getSession()
  session.destroy()
}
```

### Pattern 2: Data Access Layer (DAL) — verifySession

**What:** Single `verifySession()` function memoized with React `cache()`. Every Server Component, Server Action, and Route Handler calls this — not just middleware.

**When to use:** Every time a protected page renders or a mutation runs. This is the defense-in-depth that makes the app secure even if middleware is bypassed.

```typescript
// src/lib/dal.ts
// Source: https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export const verifySession = cache(async () => {
  const session = await getSession()
  if (!session.isAuthenticated) {
    redirect('/login')
  }
  return { isAuth: true }
})
```

### Pattern 3: Middleware for Optimistic Route Guard

**What:** Middleware reads the cookie and redirects unauthenticated users to `/login` before the page renders. This is the first line of defense (UX), not the only one.

```typescript
// src/middleware.ts
// Source: https://nextjs.org/docs/app/guides/authentication
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const publicRoutes = ['/login']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublic = publicRoutes.some(r => path.startsWith(r))

  const session = await getSession()

  if (!isPublic && !session.isAuthenticated) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublic && session.isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$).*)'],
}
```

### Pattern 4: Login Server Action

```typescript
// src/app/actions/auth.ts
// Source: iron-session README + Next.js docs
'use server'
import { redirect } from 'next/navigation'
import { createSession, deleteSession } from '@/lib/session'

export async function login(state: { error?: string } | undefined, formData: FormData) {
  const password = formData.get('password') as string
  const redirectPath = (formData.get('redirect') as string) || '/'

  if (password !== process.env.APP_PASSWORD) {
    return { error: 'Неверный пароль' }
  }

  await createSession()
  redirect(redirectPath.startsWith('/') ? redirectPath : '/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
```

### Pattern 5: Supabase Server Client (service_role)

**What:** Because there is no Supabase Auth (no `auth.uid()`), the server uses the `service_role` key to bypass RLS and access data directly. RLS is still enabled on all tables as a security baseline (protects against anon key exposure).

```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only, never expose to client
  )
}
```

**Important:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in a `NEXT_PUBLIC_` variable. Only import this client in server files.

### Pattern 6: Database Schema Migration with RLS

```sql
-- supabase/migrations/20260429000000_initial_schema.sql

-- products (fixed list — 6 tomato varieties)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null
);
alter table public.products enable row level security;
-- Service role bypasses RLS; anon key blocked by default (deny-all)

-- prices
create table public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  date date not null,
  price_per_kg decimal(10,2) not null,
  unique (product_id, date)
);
alter table public.prices enable row level security;

-- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now()
);
alter table public.clients enable row level security;

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references public.clients(id),
  client_name_raw text,
  payment_type text not null check (payment_type in ('cash','card','debt')),
  calculated_total decimal(10,2),
  discount_percent decimal(5,2) default 0,
  manual_total decimal(10,2),
  status text not null check (status in ('paid','debt','partial')) default 'paid',
  notes text
);
alter table public.orders enable row level security;

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  boxes_count int not null,
  weight_kg decimal(10,3) not null,
  price_per_kg decimal(10,2) not null,
  line_total decimal(10,2) generated always as (weight_kg * price_per_kg) stored
);
alter table public.order_items enable row level security;

-- debt_payments
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  amount decimal(10,2) not null,
  paid_at timestamptz default now(),
  payment_type text not null check (payment_type in ('cash','card')),
  notes text
);
alter table public.debt_payments enable row level security;
```

```sql
-- supabase/seed.sql
insert into public.products (name, sort_order) values
  ('Пятерка', 1),
  ('Шестерка', 2),
  ('Семерка', 3),
  ('Восьмерка', 4),
  ('НС', 5),
  ('Хара-Хура', 6);
```

### Anti-Patterns to Avoid

- **Rely on middleware alone for security:** CVE-2025-29927 proved middleware can be bypassed. Always call `verifySession()` in Server Actions too.
- **Put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` env var:** This exposes admin DB access to the browser.
- **Enable RLS without verifying it:** Always run the pg_tables check after migration (see Verification SQL below).
- **Forget the `matcher` in middleware:** Without a proper matcher, middleware runs on `_next/static` assets and slows everything down.
- **Check auth in layouts for navigation protection:** Next.js partial rendering means layout auth checks don't re-run on navigation. Check auth in the DAL, not the layout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session encryption/cookies | Custom JWT cookie logic | `iron-session` | Handles key rotation, cookie options, encryption — easy to get wrong by hand |
| Server-side cookie access | Manual `headers().get('cookie')` parsing | `iron-session` + `cookies()` from `next/headers` | Next.js `cookies()` API is the right primitive; iron-session wraps it safely |
| TypeScript DB types | Manual interface definitions for each table | `supabase gen types typescript` | Auto-generated from live schema; stays in sync |
| Password hashing | Custom bcrypt | Not needed — it's a single shared secret in env vars | Shared password is never stored in DB; no hashing needed |

**Key insight:** The auth here is simpler than typical user auth — resist adding complexity. The shared password lives only in env vars, never in the DB.

---

## Common Pitfalls

### Pitfall 1: Next.js Version < 15.2.3

**What goes wrong:** Attacker sends `x-middleware-subrequest` header, middleware is skipped entirely, unauthenticated access to all routes.
**Why it happens:** Internal Next.js header used to prevent infinite middleware loops was not validated against external requests before 15.2.3.
**How to avoid:** Pin `"next": ">=15.2.3"` in package.json. Run `npm list next` after install to verify. Also: `verifySession()` in Server Actions provides defense-in-depth even if middleware is bypassed.
**Warning signs:** `npm list next` shows version < 15.2.3.

### Pitfall 2: RLS Enabled But No Access Policy — Silent Data Denial

**What goes wrong:** After enabling RLS, queries from the app return empty arrays with no error, even though data exists.
**Why it happens:** RLS with no policies = deny all. The anon key returns nothing.
**How to avoid:** Since we use `service_role` on the server, this is not an issue for the app — service_role bypasses RLS. But if any code accidentally uses the anon key, it hits the wall. Keep service_role in server-only files.
**Warning signs:** `.select()` returns `data: []` with no error in Supabase response.

### Pitfall 3: `cookies()` Must Be Awaited in Next.js 15

**What goes wrong:** `TypeError: Cannot read properties of undefined` when reading the session.
**Why it happens:** In Next.js 15, `cookies()` from `next/headers` is now async — it must be awaited.
**How to avoid:** Always `const cookieStore = await cookies()`. The iron-session README and Next.js docs show this pattern.
**Warning signs:** Error mentioning `cookies()` return value being a Promise.

### Pitfall 4: Auth Check in Layout Component

**What goes wrong:** User navigates between protected pages — auth check in layout doesn't re-run due to partial rendering; user could theoretically remain on a protected page after session expires.
**Why it happens:** Next.js layouts persist across navigations; they don't re-render when the route changes within the same layout segment.
**How to avoid:** Call `verifySession()` in the Server Component (page) or in the Server Action — not in the layout. Middleware handles the redirect on navigation.

### Pitfall 5: `GENERATED ALWAYS AS ... STORED` Column in order_items

**What goes wrong:** Attempting to INSERT a value for `line_total` raises a PostgreSQL error.
**Why it happens:** Generated columns cannot be set by the caller — Postgres computes them.
**How to avoid:** Never include `line_total` in INSERT statements for `order_items`. Only insert `weight_kg` and `price_per_kg`.

### Pitfall 6: IRON_SESSION_SECRET shorter than 32 characters

**What goes wrong:** iron-session throws at runtime: `TypeError: password must be at least 32 characters long`.
**Why it happens:** The library enforces this minimum to ensure encryption strength.
**How to avoid:** Generate with `openssl rand -base64 32` and store in `.env.local`. Never commit `.env.local`.

---

## Code Examples

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe to expose (anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # NEVER expose — server only
IRON_SESSION_SECRET=<32+ chars random string>  # generate: openssl rand -base64 32
APP_PASSWORD=your_shared_password_here
```

### Verify RLS is Enabled (Success Criterion #5)

```sql
-- Run in Supabase SQL Editor after migration
-- Expected: rowsecurity = true for all 6 tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Find any table WITHOUT RLS (should return 0 rows after migration):
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```

### Generate TypeScript Types from Schema

```bash
# After running migration (supabase db push or via dashboard)
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts
```

### Deploy Migration to Hosted Supabase

```bash
# Option A: Supabase CLI
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Option B: Paste SQL directly in Supabase Dashboard > SQL Editor
# Simplest for a new project with no local Supabase running
```

### Login Page (Server Component)

```typescript
// src/app/(auth)/login/page.tsx
// Source: https://www.alexchantastic.com/revisiting-password-protecting-next
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/ui/login-form'

interface Props {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const session = await getSession()

  if (session.isAuthenticated) {
    redirect(params.redirect?.startsWith('/') ? params.redirect : '/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <LoginForm redirectPath={params.redirect} />
    </main>
  )
}
```

### Login Form (Client Component with useActionState)

```typescript
// src/components/ui/login-form.tsx
// Source: https://nextjs.org/docs/app/guides/authentication
'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginForm({ redirectPath }: { redirectPath?: string }) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="flex flex-col gap-4 w-full max-w-sm">
      <input type="hidden" name="redirect" value={redirectPath ?? '/'} />
      <h1 className="text-xl font-bold">Вход</h1>
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        autoFocus
        required
        className="border rounded px-3 py-2"
      />
      {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? 'Вход...' : 'Войти'}
      </button>
    </form>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous in Next.js 14 | `await cookies()` — async in Next.js 15 | Next.js 15.0 | Must await in iron-session setup |
| Middleware as sole auth guard | Middleware + verifySession() in every Server Action | Post CVE-2025-29927 (March 2025) | Defense in depth required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var name | New naming: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase renaming in progress) | 2025 | Some Supabase docs show old name; both work |
| `create-next-app` without `--src-dir` | `--src-dir` flag puts code in `src/` | Current | Cleaner separation of app code from config files |

**Deprecated/outdated:**
- `useFormStatus` (partial): React 19 adds more fields; `useActionState` supersedes `useFormStatus` for form handling.
- Supabase `@supabase/auth-helpers-nextjs`: Deprecated in favor of `@supabase/ssr`.

---

## Open Questions

1. **Rate limiting for /login**
   - What we know: STATE.md flags this as a pending decision — Upstash Redis vs. accept low risk.
   - What's unclear: Is rate limiting in scope for Phase 1 or deferred?
   - Recommendation: Defer to after Phase 1. This is an internal tool with 2 users — brute-force risk is low. Add a note to address before production hardening.

2. **Supabase CLI local dev vs. dashboard SQL Editor**
   - What we know: Both approaches (local CLI + `supabase db push` vs. paste SQL in dashboard) work for applying the migration.
   - What's unclear: Whether the team has Docker available for `supabase start` (local development).
   - Recommendation: For Phase 1, use the simpler path — paste migration SQL in Supabase Dashboard SQL Editor, then generate types. Use CLI (`supabase db push`) only if local dev stack is already set up.

3. **Tailwind CSS v3 vs v4**
   - What we know: `create-next-app` installs Tailwind; v4 is the current major version as of 2025.
   - What's unclear: Any compatibility issues with v4 on this project.
   - Recommendation: Accept whatever `create-next-app` installs (likely v4). No special configuration needed for Phase 1.

---

## Sources

### Primary (HIGH confidence)
- https://nextjs.org/docs/app/guides/authentication (fetched 2026-04-29) — stateless sessions, middleware pattern, DAL/verifySession, Server Actions, cookie options
- https://github.com/vvo/iron-session (fetched 2026-04-29) — version 8.0.1, getIronSession API, 32-char password requirement, Next.js App Router pattern
- https://supabase.com/docs/guides/database/postgres/row-level-security (fetched) — ALTER TABLE ENABLE RLS, deny-all default
- https://www.alexchantastic.com/revisiting-password-protecting-next (fetched 2026-04-29) — complete single-password Next.js 15 implementation with iron-session
- https://supabase.com/docs/guides/getting-started/quickstarts/nextjs (fetched) — createClient pattern, env var names

### Secondary (MEDIUM confidence)
- https://nvd.nist.gov/vuln/detail/CVE-2025-29927 — CVE-2025-29927 details (affected versions < 15.2.3)
- https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass — CVE-2025-29927 technical analysis
- WebSearch cross-verified: pg_tables RLS check (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`) — multiple sources agree

### Tertiary (LOW confidence)
- Next.js 15 project structure recommendations from community articles — structure is conventional, not prescriptive

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — iron-session v8 verified via GitHub; Next.js docs explicitly recommend it; Supabase packages from official docs
- Architecture: HIGH — patterns taken directly from official Next.js authentication guide (fetched 2026-04-29, last updated 2026-04-10)
- Pitfalls: HIGH — CVE-2025-29927 from NVD + Vercel postmortem; RLS deny-all from official Supabase docs; `await cookies()` from Next.js 15 changelog

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable domain — Next.js auth patterns are unlikely to change in 30 days)
