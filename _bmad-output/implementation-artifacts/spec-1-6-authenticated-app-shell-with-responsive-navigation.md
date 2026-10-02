---
title: "Authenticated App Shell with Responsive Navigation"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "2b0944a8cd960363322742320db03341fedb973c"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
  - "{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Auth works (Stories 1.3–1.5) and redirects signed-in users to `/app/engage`, but no `/app` shell or routes exist — so `/app/engage` 404s and there is no navigation chrome. Signed-in users need a consistent, responsive shell to move between features.

**Approach:** Build the authenticated shell layout at `app/app/layout.tsx` (server component, defense-in-depth auth check) rendering a fixed 240px sidebar (wordmark, primary nav, settings/avatar footer) with the main content capped at 720px, plus a persistent floating capture button. Navigation adapts purely via CSS/Tailwind breakpoints: full 240px sidebar > 1024px, 56px icon-only rail 768–1024px, bottom nav < 768px. Add minimal placeholder pages for the four nav destinations (Engage, Inbox, Goals, Weekly Review) and Settings so navigation resolves and `/app/engage` exists.

## Boundaries & Constraints

**Always:**

- `app/app/layout.tsx` is a server component that reads the session via the server client (`lib/supabase/server.ts`); if there is no user, redirect to `/sign-in` (defense-in-depth — middleware already guards, but the shell must not render for an unauthenticated user).
- Sidebar shows: Archer wordmark (Inter Bold), primary nav in order **Inbox, Goals, Engage, Weekly Review**, and a settings/avatar footer. Background `--color-surface`, right border `--color-border`.
- Active nav item uses `--color-primary-subtle` background with `--color-primary` text (via `sidebar.nav-item-active-*` tokens); active state derived from the current path (`usePathname`).
- Main content area is capped at `--spacing-content-max` (720px) and centred within the remaining space.
- Responsive behavior is **CSS/Tailwind breakpoint-driven, not JS-toggled**: `>1024px` full 240px sidebar; `768–1024px` 56px icon-only rail (labels hidden, accessible name preserved, tooltip via `title`/`aria-label`); `<768px` sidebar not rendered and a bottom nav bar (Inbox, Goals, Engage, Review) shown instead.
- A persistent floating capture button (bottom-right) is present in every `/app/*` view, activated by clicking or the `C` keyboard shortcut. Its drawer behavior is Epic 5 — this story ships the affordance only (button + shortcut wiring + accessible label); pressing it may be a no-op/placeholder handler.
- WCAG floor: logical keyboard tab order, visible focus indicators, 44×44px minimum touch targets on all nav items and the capture button, nav marked up with `<nav>` + `aria-current="page"` on the active item, `C` shortcut must not hijack typing in inputs/textareas.
- Placeholder pages for `/app/engage`, `/app/inbox`, `/app/goals`, `/app/review`, `/app/settings` render inside the shell with a heading naming the surface (content is built in later epics).
- Use design tokens only; no external UI kit. Icons may be minimal inline SVGs.

**Ask First:**

- Introducing any JS state for sidebar collapse (spec requires CSS-driven) — confirm before deviating.
- Adding an icon dependency instead of inline SVGs.

**Never:**

- Do not build feature content for Engage/Inbox/Goals/Review (later epics) — placeholders only.
- Do not implement the capture drawer (Epic 5) — affordance only.
- Do not use client-side JS to toggle the sidebar/bottom-nav visibility; rely on Tailwind responsive utilities.
- Do not weaken the middleware guard or the auth redirect.

## I/O & Edge-Case Matrix

| Scenario               | Input / State                            | Expected Output / Behavior                                                     | Error Handling                                          |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Authed desktop         | Signed-in user at `/app/engage`, >1024px | Full 240px sidebar (wordmark, 4 nav items, settings footer); main capped 720px | N/A                                                     |
| Active nav item        | Current path `/app/goals`                | Goals nav item shows primary-subtle bg + primary text + `aria-current="page"`  | N/A                                                     |
| Unauthed reaches shell | No session hits `app/app/layout`         | Server redirect to `/sign-in` (defense-in-depth)                               | N/A                                                     |
| Tablet                 | 768–1024px                               | Sidebar is a 56px icon-only rail; labels hidden but accessible name kept       | N/A                                                     |
| Mobile                 | <768px                                   | Sidebar not rendered; bottom nav bar shown with the 4 destinations             | N/A                                                     |
| Capture shortcut       | `C` pressed while not typing in a field  | Capture affordance activates (placeholder handler)                             | Ignored when focus is in input/textarea/contenteditable |

## Code Map

- `app/app/layout.tsx` -- **new server component.** Auth-check via `createClient()` (server) → `getUser()`; redirect `/sign-in` if none. Renders `Sidebar`, `BottomNav`, `FloatingCapture`, and `{children}` in a main region capped at 720px. Responsive grid/flex via Tailwind.
- `components/authenticated/Sidebar.tsx` -- **new client component** (`usePathname` for active state). Wordmark, `<nav>` with the 4 nav links + settings/avatar footer. Hidden `<768px`; 56px icon rail `768–1024px`; full 240px `>1024px`. Active item tokens + `aria-current`.
- `components/authenticated/BottomNav.tsx` -- **new client component.** Fixed bottom bar shown only `<768px` with the 4 destinations (icon + label), active state + `aria-current`.
- `components/authenticated/FloatingCapture.tsx` -- **new client component.** Fixed bottom-right button, `aria-label`, 44px target; `C` global shortcut (ignored while typing); placeholder onClick (drawer is Epic 5).
- `components/authenticated/nav-items.ts` -- **new.** Shared nav definition (label, href, inline SVG icon) consumed by Sidebar + BottomNav so the two stay in sync.
- `app/app/engage/page.tsx` -- **new placeholder.** Heading "Engage"; the post-login landing + redirect target.
- `app/app/inbox/page.tsx`, `app/app/goals/page.tsx`, `app/app/review/page.tsx`, `app/app/settings/page.tsx` -- **new placeholders.** Headings only.
- `lib/supabase/server.ts` -- existing (Story 1.3). Used for the layout auth check. Read-only.
- `app/globals.css` -- existing tokens (Story 1.1); sidebar/spacing/color tokens. Read-only; consume.
- `middleware.ts` -- existing (Story 1.3). Already redirects unauth `/app/*` → `/sign-in`; the layout check is belt-and-suspenders. Read-only.

## Tasks & Acceptance

**Execution:**

- [x] `components/authenticated/nav-items.ts` -- Shared nav item list (label, href, icon) for Inbox/Goals/Engage/Weekly Review -- single source so Sidebar and BottomNav agree.
- [x] `components/authenticated/Sidebar.tsx` -- Fixed sidebar: wordmark, nav with active-state tokens + `aria-current`, settings/avatar footer; CSS-responsive full 240px (>1024px) / 56px icon rail (768–1024px) / hidden (<768px) -- primary desktop/tablet navigation.
- [x] `components/authenticated/BottomNav.tsx` -- Bottom nav bar shown only <768px with the 4 destinations + active state -- mobile navigation.
- [x] `components/authenticated/FloatingCapture.tsx` -- Persistent bottom-right capture button with `aria-label`, 44px target, and a `C` shortcut ignored while typing; placeholder handler -- the capture affordance (drawer deferred to Epic 5).
- [x] `app/app/layout.tsx` -- Server shell: auth-check + redirect, renders Sidebar/BottomNav/FloatingCapture and a 720px-capped main -- the authenticated shell every `/app/*` route inherits.
- [x] `app/app/engage/page.tsx` + `app/app/{inbox,goals,review,settings}/page.tsx` -- Minimal placeholder pages (headings) so nav resolves and `/app/engage` exists.
- [x] `components/authenticated/Sidebar.test.tsx` + `FloatingCapture.test.tsx` -- Unit-test the matrix: active item gets `aria-current`/active classes for the current path; nav lists the 4 destinations in order; the `C` shortcut fires the handler but is ignored while an input/textarea is focused -- covers the matrix.

**Acceptance Criteria:**

- Given I am signed in on desktop (>1024px), when I view any `/app/*` route, then a fixed 240px left sidebar shows the Archer wordmark, primary nav (Inbox, Goals, Engage, Weekly Review), and a settings/avatar footer; the main content area is capped at max 720px; and the active nav item uses the primary-subtle background with primary text.
- Given a tablet-landscape viewport (768–1024px), when I view the shell, then the sidebar collapses to a 56px icon-only rail with tooltips.
- Given a viewport under 768px, when I view the shell, then navigation is a bottom nav bar (Inbox, Goals, Engage, Review) and the sidebar is not rendered; the collapse behavior is CSS/Tailwind-driven at breakpoints, not JS-toggled.
- Given any authenticated view, when I look for capture, then a persistent floating capture button (keyboard shortcut `C`) is present (its drawer behavior is delivered in Epic 5).
- Given the shell is navigated by keyboard, when I tab through it, then focus order is logical and focus indicators are visible, and all interactive elements meet the 44×44px minimum touch target.

## Design Notes

The three responsive states are pure Tailwind breakpoint utilities — e.g. Sidebar `hidden md:flex md:w-14 lg:w-sidebar-w` (labels `hidden lg:inline`), BottomNav `flex md:hidden`. No `useState`/JS toggle. Active state is the only client concern (`usePathname`), so Sidebar/BottomNav are client components; the layout stays a server component doing the auth check. The `C` shortcut listens on `document keydown`, early-returning when `document.activeElement` is an input/textarea/contenteditable so it never hijacks typing. FloatingCapture's click is a placeholder — the Inbox drawer is Epic 5; keep the handler a documented no-op/TODO. Icons: small inline SVGs in `nav-items.ts` (no icon library).

## Verification

**Commands:**

- `npm run build` -- expected: succeeds; `/app/engage`, `/app/inbox`, `/app/goals`, `/app/review`, `/app/settings` compile; standalone intact.
- `npx tsc --noEmit` -- expected: no type errors.
- `npm test` -- expected: new Sidebar/FloatingCapture tests pass; existing suite green.
- `npm run lint` -- expected: no new errors.

**Manual checks:**

- Confirm the three responsive states are driven only by Tailwind classes (no JS toggle state in the components).
- Confirm active nav uses `--color-primary-subtle`/`--color-primary` and `aria-current="page"`; nav is inside `<nav>`; targets are ≥44px.
- Confirm the `C` shortcut is ignored while focus is in a text field, and the capture button has an accessible label.
- Confirm `app/app/layout.tsx` redirects to `/sign-in` when there is no user.

## Suggested Review Order

**Shell (the core of the change)**

- Entry point — the server shell layout: defense-in-depth auth check (try/catch → redirect) + 720px-capped main.
  [`layout.tsx:26`](../../app/app/layout.tsx#L26)

- Shared nav definition (label, short label, href, icon) — single source for Sidebar + BottomNav.
  [`nav-items.ts:1`](../../components/authenticated/nav-items.ts#L1)

- Sidebar — CSS-responsive full/rail/hidden states, active-item tokens + `aria-current`, settings footer.
  [`Sidebar.tsx:35`](../../components/authenticated/Sidebar.tsx#L35)

- BottomNav — mobile-only (`flex md:hidden`) bar with the 4 destinations.
  [`BottomNav.tsx:22`](../../components/authenticated/BottomNav.tsx#L22)

- FloatingCapture — `C` shortcut (ignores modifiers, IME composition, and editable targets); placeholder handler.
  [`FloatingCapture.tsx:44`](../../components/authenticated/FloatingCapture.tsx#L44)

**Placeholders & verification (peripheral)**

- `/app/engage` (post-login landing / redirect target) and the other placeholder pages.
  [`engage/page.tsx:1`](../../app/app/engage/page.tsx#L1)

- Sidebar / BottomNav / FloatingCapture unit tests (active state, ordering, shortcut guards).
  [`Sidebar.test.tsx:1`](../../components/authenticated/Sidebar.test.tsx#L1)
