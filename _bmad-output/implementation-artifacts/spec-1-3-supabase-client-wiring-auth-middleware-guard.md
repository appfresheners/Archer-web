---
title: "Supabase Client Wiring & Auth Middleware Guard"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "1754e5dea2d6ea4df0bba4825aeb5bebfe8796e4"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The schema exists (Story 1.2) but nothing connects the app to Supabase, and there is no auth boundary. Without browser/server clients, a session-refresh helper, a middleware guard on `/app/*`, a root `/` redirect, and a fail-loud env contract, no authenticated feature can be built and unauthenticated requests could reach app routes.

**Approach:** Add the `@supabase/ssr` + `@supabase/supabase-js` clients — `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server/route-handler), `lib/supabase/middleware.ts` (session-refresh helper) — typed with the Story 1.2 `Database` type. Add root `middleware.ts` that refreshes the session and enforces auth: unauthenticated `/app/*` → `/sign-in`; `/` → `/app/engage` (authed) or `/sign-in` (unauthed). Add a small env accessor that fails loudly on missing required vars, and complete `.env.example` with the full contract.

## Boundaries & Constraints

**Always:**

- Use `@supabase/ssr` with the recommended `getAll`/`setAll` cookie methods (not the deprecated get/set/remove). Pin exact dependency versions.
- `lib/supabase/client.ts` exports a browser client via `createBrowserClient<Database>` for client components.
- `lib/supabase/server.ts` exports an async server client via `createServerClient<Database>` reading/writing cookies through `next/headers` `cookies()` for route handlers & server components.
- `lib/supabase/middleware.ts` exports an `updateSession(request)` helper that creates a server client bound to the request/response cookies, calls `supabase.auth.getUser()` to refresh, and returns the response with refreshed auth cookies — this is the single session-refresh path.
- Root `middleware.ts`: run `updateSession`; then guard — an unauthenticated request to any `/app/*` route redirects to `/sign-in`; `/` redirects to `/app/engage` when authenticated and `/sign-in` when not. Redirect enforcement lives in middleware, not in individual pages.
- The `matcher` must cover `/` and `/app/*` while excluding static assets and `/api` internals per Next.js middleware conventions.
- Env access goes through a typed accessor that throws a clear, logged error naming the missing variable; `.env.example` lists every required var: `AI_PROVIDER`, the provider model var, the provider API key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Types come from `lib/supabase/schema.ts` (`Database`).

**Ask First:**

- Adding any auth logic beyond session refresh + route redirect (e.g. sign-in/up handlers) — that is Story 1.4.
- Changing the redirect targets or the matcher scope.

**Never:**

- Do not build `/sign-in`, `/sign-up`, `/forgot-password`, or any `/app/*` page/shell — those are Stories 1.4–1.6. Redirect _targets_ may 404 until then; that is expected and acceptable for this story.
- Do not delete or rewrite `app/page.tsx` or its tests (MVP1 landing; the `/` redirect is enforced in middleware, leaving the component and its unit tests intact). MVP1 cleanup is Epic 2 / Story 2.6.
- Do not read the service-role key in client or middleware code — it is server-route-handler only.
- Do not weaken or bypass the schema RLS.

## I/O & Edge-Case Matrix

| Scenario              | Input / State                                           | Expected Output / Behavior                       | Error Handling                            |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| Unauth hits app route | No/invalid session, request `/app/engage`               | 307 redirect to `/sign-in`                       | N/A                                       |
| Auth hits app route   | Valid session, request `/app/inbox`                     | Passes through (no redirect)                     | N/A                                       |
| Root as guest         | No session, request `/`                                 | Redirect to `/sign-in`                           | N/A                                       |
| Root as user          | Valid session, request `/`                              | Redirect to `/app/engage`                        | N/A                                       |
| Missing env var       | `NEXT_PUBLIC_SUPABASE_URL` unset when a client is built | Throws a clear error naming the variable; logged | Loud failure, not silent                  |
| Session refresh       | Any matched request with a refreshable session          | Auth cookies refreshed on the response           | Expired/none → treated as unauthenticated |

## Code Map

- `package.json` (root) -- add pinned `@supabase/ssr` and `@supabase/supabase-js` deps. No UI kit. Scripts unchanged.
- `lib/supabase/schema.ts` -- existing (Story 1.2). Import `Database` to type all three clients. Read-only.
- `lib/supabase/client.ts` -- **new.** `createBrowserClient<Database>(url, anonKey)` using the env accessor. Browser/client-component client.
- `lib/supabase/server.ts` -- **new.** async `createClient()` → `createServerClient<Database>` with `cookies()` getAll/setAll (wrapped in try/catch for the read-only server-component cookie case). For route handlers & server components.
- `lib/supabase/middleware.ts` -- **new.** `updateSession(request: NextRequest)`: build a `NextResponse.next`, create a server client bound to request cookies + response setAll, `await supabase.auth.getUser()`, return `{ response, user }` (or response + user) so the root middleware can branch on auth.
- `lib/supabase/env.ts` -- **new.** Typed getters (`getSupabaseUrl()`, `getSupabaseAnonKey()`, `getServiceRoleKey()`) that throw a clear, logged error naming any missing var. Single source for required-var validation.
- `middleware.ts` (root) -- **new.** Import `updateSession`; refresh session; apply the guard/redirect rules; export `config.matcher` covering `/` and `/app/:path*`, excluding `_next`, static files, and image assets.
- `.env.example` (root) -- extend the existing AI-provider vars with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (with issuance guidance comments). Currently only lists AI vars.
- `app/page.tsx` + `app/page*.test.tsx` -- existing MVP1 landing + unit tests. Read-only / preserve; they render `<Home/>` directly and are unaffected by middleware.

## Tasks & Acceptance

**Execution:**

- [x] `package.json` -- Add pinned `@supabase/ssr` and `@supabase/supabase-js` dependencies; run install -- provides the SSR auth primitives.
- [x] `lib/supabase/env.ts` -- Add typed required-env getters that throw a clear logged error naming a missing variable -- the fail-loud env contract.
- [x] `lib/supabase/client.ts` -- Browser client via `createBrowserClient<Database>` -- for client components.
- [x] `lib/supabase/server.ts` -- Async server client via `createServerClient<Database>` with `next/headers` cookies (getAll/setAll) -- for route handlers & server components.
- [x] `lib/supabase/middleware.ts` -- `updateSession` helper: request-bound server client, `getUser()` refresh, returns response + user -- the single session-refresh path.
- [x] `middleware.ts` -- Root middleware wiring `updateSession` + the guard/redirect rules with a `config.matcher` for `/` and `/app/*` -- enforces the auth boundary.
- [x] `.env.example` -- Add the three Supabase vars to complete the required-variable contract.
- [x] `lib/supabase/middleware.test.ts` (or `middleware.test.ts`) -- Unit-test the I/O matrix redirect rules (unauth→/sign-in on /app/\*, auth passthrough, / redirects both ways, missing-env throws) by mocking the Supabase client's `getUser` -- covers the matrix.

**Acceptance Criteria:**

- Given the Supabase integration modules, when inspected, then `lib/supabase/client.ts` provides a browser client for client components, `lib/supabase/server.ts` provides a server client for route handlers and server components, and `lib/supabase/middleware.ts` provides a session-refresh helper.
- Given a root `middleware.ts`, when an unauthenticated request targets any `/app/*` route, then it is redirected to `/sign-in`, and the redirect is enforced by middleware, not by individual pages.
- Given the root route `/`, when an authenticated user visits it they are redirected to `/app/engage`, and an unauthenticated user visiting `/` is redirected to `/sign-in`.
- Given the required environment variables are absent, when a route handler that depends on one executes, then it fails loudly with a logged error and a user-facing message rather than degrading silently, and `.env.example` lists every required variable (`AI_PROVIDER`, provider model var, provider API key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

## Design Notes

Follow the current `@supabase/ssr` Next.js App Router pattern: `createBrowserClient` (client), `createServerClient` with `cookies()` getAll/setAll (server), and a middleware `updateSession` that must call `supabase.auth.getUser()` (never trust `getSession()` alone in middleware) and return the SAME response object whose cookies were mutated — do not construct a fresh response after setting cookies, or the refreshed session is lost. The redirect targets (`/sign-in`, `/app/engage`) do not exist yet; that is intentional sequencing — the guard logic is correct and unit-testable now.

## Verification

**Commands:**

- `npm run build` -- expected: succeeds with middleware compiled; standalone output intact.
- `npx tsc --noEmit` -- expected: clients type-check against `Database`.
- `npm test` -- expected: new middleware/redirect unit tests pass; the existing 368 tests still pass (MVP1 page tests unaffected).
- `npm run lint` -- expected: no new errors.

**Manual checks:**

- Confirm `middleware.ts` `config.matcher` includes `/` and `/app/:path*` and excludes `_next`/static/image paths.
- Confirm the service-role key is referenced only in `server.ts`/`env.ts` server context, never in `client.ts` or `middleware.ts` client-exposed code.

## Suggested Review Order

**Auth boundary (the core of the change)**

- Entry point — the root middleware guard: unauth `/app/*` → `/sign-in`, `/` branches on auth. Redirects preserve refreshed cookies.
  [`middleware.ts:38`](../../middleware.ts#L38)

- The single session-refresh path — `updateSession` returns the same mutated response + user; fail-safe to unauthenticated on error.
  [`middleware.ts:26`](../../lib/supabase/middleware.ts#L26)

**Supabase clients**

- Server client for route handlers & server components (cookies via `next/headers`).
  [`server.ts:22`](../../lib/supabase/server.ts#L22)

- Browser client for client components (public URL + anon key only).
  [`client.ts:15`](../../lib/supabase/client.ts#L15)

- Fail-loud env accessor — throws + logs naming any missing var; service-role getter documented server-only.
  [`env.ts:20`](../../lib/supabase/env.ts#L20)

**Verification & contract (peripheral)**

- Middleware/redirect/env unit tests, incl. refreshed-cookie propagation through redirects and the `/apple` lookalike guard.
  [`middleware.test.ts:38`](../../middleware.test.ts#L38)

- `.env.example` completes the required-variable contract (public vs server-only vars).
  [`.env.example:1`](../../.env.example#L1)
