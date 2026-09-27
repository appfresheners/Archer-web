---
title: "Password Reset"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "ee81724c71863411529ad8575b2ef5992c286be3"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The sign-in page links to `/forgot-password` (Story 1.4), but that route and the whole reset flow don't exist. A user who forgets their password has no way to regain access, and the flow must not leak whether an email is registered.

**Approach:** Add the three-part Supabase password-reset flow: (1) `/forgot-password` requests a reset email via `resetPasswordForEmail` and always shows the same neutral confirmation (no account enumeration); (2) an `/auth/callback` route handler exchanges the emailed PKCE code for a recovery session and redirects to the reset page; (3) `/reset-password` lets the signed-in-via-recovery user set a new password via `updateUser`, then continues into the app. All auth pages reuse the minimal `(auth)` layout from Story 1.4.

## Boundaries & Constraints

**Always:**

- `/forgot-password` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })` where `redirectTo` points at the app's `/auth/callback` with a `next=/reset-password` param, built from the current request origin (no hardcoded host).
- After submitting the forgot-password form, show the SAME confirmation message whether or not the email exists — no account enumeration; never reveal existence via message, timing branch, or error.
- `/auth/callback` is a route handler that reads the `code` query param, calls `supabase.auth.exchangeCodeForSession(code)` using the server client, and redirects to the `next` path (defaulting to `/reset-password`); on failure redirects to `/sign-in` with a generic error.
- `/reset-password` calls `supabase.auth.updateUser({ password })`; on success navigates into the app (`/app/engage`) with refresh; on failure shows an inline `role="alert"` error.
- All three auth pages use the minimal `(auth)` route-group layout (max 480px, centred, no sidebar) and design tokens; forms follow the same a11y floor as Story 1.4 (labelled inputs, `type=password` `autocomplete=new-password`, 44px targets, visible focus, inline non-color-only errors).
- Reuse the existing browser client (`lib/supabase/client.ts`) in client forms and the server client (`lib/supabase/server.ts`) in the callback route.

**Ask First:**

- Changing Supabase email-template or redirect-allowlist config (the `redirectTo` origin must be allowlisted in the Supabase dashboard by the operator — note it, don't assume a code change).
- Adding password-strength rules beyond Supabase's minimum.

**Never:**

- Do not reveal whether an account exists at any point in the forgot-password flow.
- Do not build or alter the `/app` shell (Story 1.6) or the sign-in/sign-up forms (Story 1.4) beyond what already links here.
- Do not weaken the middleware guard; `/forgot-password`, `/reset-password`, `/auth/callback` are intentionally outside the `/app/*` matcher.
- Do not log the reset code, email, or any token.

## I/O & Edge-Case Matrix

| Scenario                      | Input / State                                | Expected Output / Behavior                                  | Error Handling                                                           |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Request reset (existing)      | Registered email submitted                   | Reset email sent; neutral confirmation shown                | N/A                                                                      |
| Request reset (unknown)       | Unregistered email submitted                 | SAME neutral confirmation shown; no hint of non-existence   | resetPasswordForEmail errors are swallowed into the neutral confirmation |
| Empty email                   | Blank/whitespace email                       | Blocked with inline validation before calling Supabase      | Inline validation                                                        |
| Callback valid code           | `/auth/callback?code=…&next=/reset-password` | Recovery session established; redirect to `/reset-password` | N/A                                                                      |
| Callback missing/invalid code | No/invalid `code`                            | Redirect to `/sign-in` with a generic error param           | No session established                                                   |
| Set new password OK           | Valid new password on `/reset-password`      | Password updated; navigate to `/app/engage`                 | N/A                                                                      |
| Set new password fail         | Weak/short password, or no recovery session  | Inline error shown; stays on page                           | Supabase error surfaced friendly                                         |

## Code Map

- `app/(auth)/forgot-password/page.tsx` -- **new.** Renders `ForgotPasswordForm` in the `(auth)` layout.
- `components/auth/ForgotPasswordForm.tsx` -- **new client component.** Email field → `resetPasswordForEmail(email, { redirectTo: ${origin}/auth/callback?next=/reset-password })`; on submit (success OR error) shows the same neutral "If an account exists, we've sent a reset link." confirmation; empty blocked; loading state; link back to `/sign-in`.
- `app/auth/callback/route.ts` -- **new route handler.** GET: read `code` + `next`; `const supabase = await createClient()`; `exchangeCodeForSession(code)`; redirect to `next` (validated to be an internal path, default `/reset-password`) on success, `/sign-in?error=…` on failure.
- `app/(auth)/reset-password/page.tsx` -- **new.** Renders `ResetPasswordForm` in the `(auth)` layout.
- `components/auth/ResetPasswordForm.tsx` -- **new client component.** New-password field → `updateUser({ password })`; success → `router.push('/app/engage')` + refresh; failure (incl. no recovery session) → inline error; loading state.
- `lib/supabase/client.ts` / `lib/supabase/server.ts` -- existing (Story 1.3). Browser client for forms, server client for the callback route. Read-only.
- `app/(auth)/layout.tsx` -- existing (Story 1.4). Minimal centred auth layout. Read-only; reuse.
- `middleware.ts` -- existing (Story 1.3). Confirm the matcher does not capture `/forgot-password`, `/reset-password`, `/auth/callback`. Read-only.

## Tasks & Acceptance

**Execution:**

- [x] `components/auth/ForgotPasswordForm.tsx` -- Client request form: email → `resetPasswordForEmail` with an origin-derived `redirectTo`; neutral no-enumeration confirmation on success or error; empty blocked; loading; link to `/sign-in` -- the reset request entry.
- [x] `app/(auth)/forgot-password/page.tsx` -- Page rendering `ForgotPasswordForm` in the auth layout.
- [x] `app/auth/callback/route.ts` -- Route handler exchanging the PKCE `code` for a recovery session (server client) and redirecting to a validated internal `next` (default `/reset-password`), or `/sign-in?error` on failure -- bridges the email link to a session.
- [x] `components/auth/ResetPasswordForm.tsx` -- Client set-new-password form: `updateUser({ password })`, inline error, loading, navigate to `/app/engage` on success -- completes the reset.
- [x] `app/(auth)/reset-password/page.tsx` -- Page rendering `ResetPasswordForm` in the auth layout.
- [x] `components/auth/ForgotPasswordForm.test.tsx` + `ResetPasswordForm.test.tsx` (+ callback route test) -- Unit-test the I/O matrix: neutral confirmation on both existing/unknown email, empty blocked, update-password success navigates, update failure shows error, callback redirects on valid/invalid code -- covers the matrix and the no-enumeration invariant.

**Acceptance Criteria:**

- Given the sign-in page, when I click "Forgot password", then I navigate to `/forgot-password` (minimal centred layout).
- Given the forgot-password form, when I submit my email, then Supabase Auth sends a password-reset email, and a confirmation message is shown regardless of whether the email exists (no account enumeration).
- Given I follow the reset link from the email, when I set a new password, then the password is updated and I can sign in with it.

## Design Notes

Supabase reset is PKCE: `resetPasswordForEmail` emails a link to `${origin}/auth/callback?code=…`; the callback route runs `exchangeCodeForSession` to create a short-lived recovery session, then routes to `/reset-password` where `updateUser({ password })` sets the new password. The neutral confirmation is the crux of the no-enumeration AC — render the same message on both the resolve and reject paths of `resetPasswordForEmail`; do not branch UI on its error. Validate the `next` param in the callback to an app-internal path (starts with `/`, no protocol/host) to avoid open-redirect. Operator note: the `redirectTo` origin must be in the Supabase Auth redirect allowlist — a config step, not code.

## Verification

**Commands:**

- `npm run build` -- expected: succeeds; `/forgot-password`, `/reset-password`, and the `/auth/callback` handler compile; standalone intact.
- `npx tsc --noEmit` -- expected: no type errors.
- `npm test` -- expected: new reset-flow tests pass (incl. no-enumeration assertion); existing suite green.
- `npm run lint` -- expected: no new errors.

**Manual checks:**

- Confirm the forgot-password confirmation text is identical for a known vs unknown email (no timing/message/branch difference).
- Confirm the callback validates `next` to an internal path and redirects to `/sign-in` on a missing/invalid code.
- Confirm `/reset-password` uses `updateUser` and surfaces a friendly inline error when there is no recovery session.

## Suggested Review Order

**Reset flow (the core of the change)**

- Entry point — the no-enumeration request form: same neutral confirmation on success/error/throw; origin-derived `redirectTo`.
  [`ForgotPasswordForm.tsx:32`](../../components/auth/ForgotPasswordForm.tsx#L32)

- The PKCE bridge — callback exchanges the code for a recovery session; `safeNext` blocks open-redirect (`//`, `/\`, non-allowlisted paths).
  [`callback/route.ts:42`](../../app/auth/callback/route.ts#L42)

- Set-new-password form — `updateUser`, inline error on no recovery session, navigate to `/app/engage`.
  [`ResetPasswordForm.tsx:1`](../../components/auth/ResetPasswordForm.tsx#L1)

**Pages**

- Forgot-password + reset-password pages in the minimal `(auth)` layout.
  [`forgot-password/page.tsx:1`](<../../app/(auth)/forgot-password/page.tsx#L1>)

**Verification (peripheral)**

- Reset-flow tests incl. the no-enumeration invariant and open-redirect (`//`, `/\`, absolute-URL) cases.
  [`callback/route.test.ts:1`](../../app/auth/callback/route.test.ts#L1)
