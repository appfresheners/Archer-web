---
title: "Sign Up & Sign In with Email and Password"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "c0bd1d3f9ae94b8f6932674c1dfd477786e9bdee"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The auth boundary exists (Story 1.3 redirects unauthenticated users to `/sign-in`), but `/sign-in` and `/sign-up` don't exist — so there is no way to actually create an account or authenticate. Every feature is gated behind auth with no entry door.

**Approach:** Build the minimal auth layout and the `/sign-in` + `/sign-up` pages backed by Supabase Auth email + password. Client-side forms call the browser client's `signInWithPassword` / `signUp`, show inline errors on failure, and on success navigate to `/app/engage` (refreshing so middleware sees the new session). Email + password only — no OAuth, no magic link. A "Create account" link connects sign-in → sign-up; a "Forgot password" link points to `/forgot-password` (built in Story 1.5).

## Boundaries & Constraints

**Always:**

- Auth pages (`/sign-in`, `/sign-up`) use a minimal single-column centred layout, max 480px, no sidebar — via a route-group layout so it does not inherit the authenticated shell.
- Sign-in calls `supabase.auth.signInWithPassword({ email, password })`; sign-up calls `supabase.auth.signUp({ email, password })`, using the browser client from `lib/supabase/client.ts`.
- On successful sign-in, navigate to `/app/engage` and refresh so the middleware/server sees the session (`router.push` + `router.refresh`, or equivalent).
- On sign-up success (email confirmation is disabled per the Supabase config, so a session is established), navigate to `/app/engage` the same way.
- Incorrect credentials show a clear inline error and keep the user on the page; the error is associated with the form via `aria-describedby`/`role="alert"` and is not color-only.
- Only email + password is offered — no OAuth buttons, no magic-link option anywhere in the auth UI.
- The sign-in page has a "Create account" link to `/sign-up` and a "Forgot password" link to `/forgot-password`; the sign-up page links back to `/sign-in`.
- Forms meet the WCAG floor: labelled inputs, keyboard operable, visible focus, 44×44px targets, correct input types/autocomplete (`type=email`, `type=password`, `autocomplete=current-password`/`new-password`).
- Use design tokens from `globals.css` (primary button, input border/focus-ring, surface, text hierarchy). No new UI kit.

**Ask First:**

- Enabling email confirmation / changing the Supabase auth config.
- Adding client-side password-strength rules beyond Supabase's own minimum.

**Never:**

- No OAuth, no magic link, no SSO in v1.
- Do not build `/forgot-password` (Story 1.5) or the `/app` shell (Story 1.6) — link to them only.
- Do not weaken the middleware guard or bypass it.
- Do not store credentials anywhere client-side beyond the Supabase session cookie the SDK manages.

## I/O & Edge-Case Matrix

| Scenario                 | Input / State                    | Expected Output / Behavior                                                            | Error Handling                                |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sign in OK               | Valid email + password           | Authenticated; navigate to `/app/engage`                                              | N/A                                           |
| Sign in bad creds        | Wrong email/password             | Inline error shown; stays on `/sign-in`; password not cleared silently without notice | Supabase error surfaced as a friendly message |
| Sign up OK               | Valid new email + password       | Account created + session established; navigate to `/app/engage`                      | N/A                                           |
| Sign up existing/invalid | Duplicate email or weak password | Inline error shown; stays on `/sign-up`                                               | Supabase error surfaced as a friendly message |
| Empty submit             | Blank email or password          | Blocked with inline validation before calling Supabase                                | Native + inline validation                    |
| In-flight                | Submit pressed, request pending  | Submit disabled + loading state; no double-submit                                     | N/A                                           |

## Code Map

- `app/(auth)/layout.tsx` -- **new.** Route-group layout: single-column centred, max 480px, no sidebar. Wraps the auth pages so they don't get the authenticated shell (which arrives in Story 1.6). Uses tokens.
- `app/(auth)/sign-in/page.tsx` -- **new.** Renders `SignInForm` inside the auth layout. Route path `/sign-in` (route group `(auth)` is not in the URL).
- `app/(auth)/sign-up/page.tsx` -- **new.** Renders `SignUpForm`.
- `components/auth/SignInForm.tsx` -- **new client component.** Email + password fields, submit → `signInWithPassword`, inline error, loading state, links to `/sign-up` and `/forgot-password`. Uses `createClient()` from `lib/supabase/client.ts` and `useRouter`.
- `components/auth/SignUpForm.tsx` -- **new client component.** Email + password fields, submit → `signUp`, inline error, loading state, link back to `/sign-in`.
- `lib/supabase/client.ts` -- existing (Story 1.3). `createClient()` browser client. Read-only.
- `middleware.ts` -- existing (Story 1.3). Redirects unauth `/app/*` → `/sign-in`; `/sign-in` and `/sign-up` are NOT matched by the matcher, so they render freely. Read-only; confirm no change needed.
- `app/globals.css` -- existing tokens (Story 1.1). Read-only; consume tokens.
- Note: `/app/engage` (the post-auth target) is built in Story 1.6 — until then a successful auth redirects to a route that 404s. Acceptable sequencing.

## Tasks & Acceptance

**Execution:**

- [x] `app/(auth)/layout.tsx` -- Minimal centred auth layout (max 480px, no sidebar) via a route group -- isolates auth pages from the authenticated shell.
- [x] `components/auth/SignInForm.tsx` -- Client sign-in form: email + password, `signInWithPassword`, inline `role="alert"` error, loading/disabled state, links to `/sign-up` + `/forgot-password`, navigate to `/app/engage` + refresh on success -- the sign-in entry point.
- [x] `components/auth/SignUpForm.tsx` -- Client sign-up form: email + password, `signUp`, inline error, loading state, link to `/sign-in`, navigate to `/app/engage` + refresh on success -- account creation.
- [x] `app/(auth)/sign-in/page.tsx` -- Page rendering `SignInForm` in the auth layout.
- [x] `app/(auth)/sign-up/page.tsx` -- Page rendering `SignUpForm` in the auth layout.
- [x] `components/auth/SignInForm.test.tsx` + `SignUpForm.test.tsx` -- Unit-test the I/O matrix (success navigates, bad creds shows inline error and stays, empty blocked, loading disables submit, only email+password offered) by mocking `createClient` + `useRouter` -- covers the matrix.

**Acceptance Criteria:**

- Given the `/sign-up` page, when I submit a valid email and password, then a Supabase Auth account is created and I am signed in, and the page uses the minimal single-column centred layout (max 480px, no sidebar).
- Given the `/sign-in` page, when I submit correct credentials, then I am authenticated and redirected to `/app/engage`.
- Given the `/sign-in` page, when I submit incorrect credentials, then a clear inline error is shown and I remain on the page.
- Given either auth form, when I inspect the available methods, then only email + password is offered — no magic link and no OAuth providers.
- Given a "Create account" link on the sign-in page, when I click it, then I navigate to `/sign-up`.

## Design Notes

Use a `(auth)` route group so `/sign-in` and `/sign-up` share the minimal layout without a URL segment and without inheriting the (future) `/app` shell. Forms are client components (interactive inline validation + loading), calling the existing browser client. After `signInWithPassword`/`signUp` success, call `router.push('/app/engage')` then `router.refresh()` so the server/middleware re-reads the freshly set session cookie. Surface `error.message` from Supabase but keep it friendly (e.g. map "Invalid login credentials" to a plain sentence). The `/app/engage` target 404s until Story 1.6 — expected.

## Verification

**Commands:**

- `npm run build` -- expected: succeeds; `/sign-in` and `/sign-up` compile; standalone intact.
- `npx tsc --noEmit` -- expected: no type errors.
- `npm test` -- expected: new auth-form tests pass; existing suite still green.
- `npm run lint` -- expected: no new errors.

**Manual checks:**

- Confirm `/sign-in` and `/sign-up` render centred, max 480px, no sidebar.
- Confirm forms expose only email + password (no OAuth/magic-link), inputs are labelled with correct types/autocomplete, and the error region uses `role="alert"`.
- Confirm the "Create account" and "Forgot password" links target `/sign-up` and `/forgot-password`.

## Suggested Review Order

**Auth forms (the core of the change)**

- Entry point — sign-in form: `signInWithPassword`, inline `role="alert"` error, session check + try/catch, navigate to `/app/engage`.
  [`SignInForm.tsx:44`](../../components/auth/SignInForm.tsx#L44)

- Sign-up form: `signUp`, plus the anti-enumeration (empty `identities`) and no-session guards before navigating.
  [`SignUpForm.tsx:44`](../../components/auth/SignUpForm.tsx#L44)

**Layout & pages**

- Minimal centred auth layout (max 480px, no sidebar) via the `(auth)` route group.
  [`layout.tsx:14`](<../../app/(auth)/layout.tsx#L14>)

- Sign-in / sign-up pages rendering the forms.
  [`sign-in/page.tsx:1`](<../../app/(auth)/sign-in/page.tsx#L1>)

**Verification (peripheral)**

- Form unit tests covering the I/O matrix + patch cases (network throw, whitespace email, duplicate-email, session checks).
  [`SignInForm.test.tsx:1`](../../components/auth/SignInForm.test.tsx#L1)
