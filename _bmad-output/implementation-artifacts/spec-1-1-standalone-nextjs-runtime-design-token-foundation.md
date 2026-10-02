---
title: "Standalone Next.js Runtime & Design Token Foundation"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "33463cf855920abb2c78302481127655ea21d118"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
  - "{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer's v1-full plan needs a consistent, deployable foundation: a Next.js App Router project on the Node.js standalone runtime with Archer's full design-token system encoded as Tailwind v4 CSS-first `@theme` tokens. The repo already sets `output: 'standalone'` and uses Tailwind v4, but the `@theme` token block in `globals.css` is an incomplete, partly-divergent subset of the canonical DESIGN.md spec (missing warning/destructive/subtle roles, status-badge colors, wizard step states, `font-mono`, several radius rungs and layout spacing tokens, plus two spacing value mismatches), and the mono font it will reference is not wired.

**Approach:** Complete and reconcile the `@theme` token block in `app/globals.css` to match DESIGN.md exactly, wire JetBrains Mono (and the missing Inter weights 500/600) via `next/font` in the root layout, and confirm the standalone runtime config is correct. No product features, routes, or components are built in this story — this is the token + runtime foundation only.

## Boundaries & Constraints

**Always:**

- Use Tailwind CSS v4 CSS-first `@theme` tokens in `app/globals.css`. No `tailwind.config.{js,ts}`.
- Encode the full DESIGN.md token set verbatim: complete color palette (primary + hover + subtle; success + hover + subtle; warning + subtle; destructive + hover + subtle; neutral surfaces incl. surface-raised, border, border-strong; text hierarchy incl. text-inverse; focus-ring #2563EB40; wizard step states; seven status-badge colors), typography (Inter body, JetBrains Mono for output, major-third ×1.25 scale), full radius scale (xs 4px → full pill), and spacing tokens (page-x, page-x-lg, section-y, card-p, sidebar-w 240px, content-max 720px).
- Keep `output: 'standalone'` in `next.config.ts`; the API route requires the Node.js runtime.
- Any font token referenced from `@theme` must be registered via `next/font` in the root layout so the CSS var it points at is defined.
- Preserve the existing `.output-prose` styles and `animate-fade-in`/`@keyframes fade-in` in `globals.css` (MVP1 markdown output depends on them).

**Ask First:**

- Removing or renaming any existing token that a current component/class consumes.
- Changing the runtime `output` mode or adding `output: 'export'`.
- Adding any external UI kit (shadcn, Radix, MUI, Chakra) or CSS-in-JS library.

**Never:**

- Do not add `output: 'export'` (static) — it breaks API routes.
- Do not add a component library or CSS-in-JS dependency.
- Do not build product features, routes, auth, schema, or components — those are later Epic 1 stories.
- Do not delete or regress `app/api/generate/route.ts` or `lib/templates/*` (MVP1 flow; cleanup is deferred to Epic 2 Story 2.6).

## I/O & Edge-Case Matrix

| Scenario            | Input / State                                                                                                      | Expected Output / Behavior                                             | Error Handling                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------ |
| Production build    | `npm run build` on a clean checkout                                                                                | Build succeeds; `.next/standalone/` bundle emitted (standalone output) | Build fails loudly if config invalid |
| Token consumption   | A Tailwind class references a DESIGN.md token (e.g. `bg-warning`, `text-status-paused`, `font-mono`, `rounded-xs`) | Class resolves to the exact DESIGN.md value                            | N/A                                  |
| Mono font token     | `font-mono` / `--font-mono` used                                                                                   | Resolves to registered JetBrains Mono var, not an undefined var        | N/A                                  |
| Static-export guard | `next.config.ts` inspected                                                                                         | `output: 'standalone'` present; no `output: 'export'`                  | N/A                                  |

</frozen-after-approval>

## Code Map

- `next.config.ts` (root, line 6) -- already `output: 'standalone'`; verify only, no `output: 'export'`. Read-only unless a gap is found.
- `postcss.config.mjs` (root) -- Tailwind v4 single-plugin wiring (`@tailwindcss/postcss`). Correct; leave as-is.
- `package.json` (root) -- Next 16.3.3 / React 19.2.8 / Tailwind ^4; no UI kit, no CSS-in-JS. Scripts: `build`, `dev`, `lint`, `test` (vitest). Reference only.
- `app/globals.css` -- **primary edit target.** `@theme` block (lines ~3–41) is the incomplete/divergent token set to reconcile & extend to DESIGN.md. Lines ~43+ (`@keyframes fade-in`, `@utility animate-fade-in`, `body`, `.output-prose *`) are MVP1-dependent — preserve.
- `app/layout.tsx` -- root layout. `next/font/google` Inter (weights 400/700) wired to `--font-inter` → `--font-sans`. **Add** JetBrains Mono (→ `--font-mono`) and Inter weights 500/600; apply both font `.variable`s on `<html>`.
- `tsconfig.json` (root) -- `@/*` alias. Reference only, no change.
- `_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md` -- canonical token values (colors, typography ×1.25 scale, radius, spacing). Source of truth.

Token divergences to fix (current → DESIGN.md): `--spacing-page-x-lg` 4rem → 1.5rem; `--spacing-section-y` 4rem → 2rem. Add missing: `primary-subtle #EFF6FF`, `success-hover #059669`, `success-subtle #ECFDF5`, `warning #F59E0B` + `warning-subtle #FFFBEB`, `destructive #EF4444` + `destructive-hover #DC2626` + `destructive-subtle #FEF2F2`, `surface-raised #FFFFFF`, `border-strong #D1D5DB`, `text-inverse #FFFFFF`, `step-complete/active/upcoming`, `status-active/paused/someday/completed/archived/not-now`, `--font-mono`, `--radius-xs .25rem`, `--radius-xl 1rem`, `--spacing-card-p 1.5rem`, `--spacing-sidebar-w 240px`, `--spacing-content-max 720px`. Normalize hex to uppercase to match DESIGN.md. Preserve existing `--color-error`/`--color-secondary` only if referenced; otherwise align to DESIGN.md naming (`destructive`, `success`).

## Tasks & Acceptance

**Execution:**

- [x] `app/globals.css` -- Reconcile and extend the `@theme` block to encode the full DESIGN.md token set (all colors incl. subtle/warning/destructive/surface-raised/border-strong/text-inverse/focus-ring, wizard step states, seven status badges; typography with `--font-mono` and the ×1.25 scale; full radius xs→full; spacing incl. card-p, sidebar-w 240px, content-max 720px; fix page-x-lg→1.5rem and section-y→2rem; uppercase hex) -- gives every later story a single correct token source.
- [x] `app/layout.tsx` -- Register JetBrains Mono via `next/font/google` (→ `--font-mono`) and add Inter weights 500 & 600; apply both font `.variable`s to `<html className>` -- so `--font-mono` and non-400/700 weight tokens resolve to real fonts instead of dangling vars.
- [x] `next.config.ts` -- Verify `output: 'standalone'` present and no `output: 'export'`; make no change unless a gap is found -- confirms the deployable runtime foundation.

**Acceptance Criteria:**

- Given a clean checkout, when `npm run build` runs, then the build completes with `output: 'standalone'` configured and no `output: 'export'` present.
- Given `globals.css`, when the `@theme` block is inspected, then the full DESIGN.md color palette (primary + hover/subtle, success #10B981, warning #F59E0B, destructive #EF4444, neutral surfaces, text hierarchy, focus ring #2563EB40, wizard step states, seven status-badge colors), typography tokens (Inter body, JetBrains Mono for output, major-third ×1.25 scale), the rounded scale (xs 4px → full pill), and spacing tokens (page-x, section-y, card-p, sidebar-w 240px, content-max 720px) are all present with values matching DESIGN.md.
- Given the token system, when `--font-mono` (or `font-mono`) is used, then it resolves to a registered JetBrains Mono font rather than an undefined variable.
- Given the current build, when foundation changes land, then no external UI kit (shadcn, Radix, MUI) or CSS-in-JS library is added, and the existing `.output-prose` / `animate-fade-in` styles remain intact.

## Design Notes

The runtime and Tailwind-v4 CSS-first setup already exist in the repo, so this story is primarily a token-completion + font-wiring pass, not a scaffold-from-scratch. Encode `content-max` and `sidebar-w` as `--spacing-*` tokens (they are consumed as width/padding utilities like `max-w-content-max`, `w-sidebar-w` in Tailwind v4). Keep the `@theme` block the single source of truth — do not duplicate values into component CSS.

## Verification

**Commands:**

- `npm run build` -- expected: succeeds, emits `.next/standalone/` (confirms standalone runtime).
- `npm run lint` -- expected: no new lint errors introduced by the changes.

**Manual checks:**

- Inspect `app/globals.css` `@theme` block against DESIGN.md: every color role, wizard step state, status badge, typography token (incl. `--font-mono` and ×1.25 scale), radius rung (xs→full), and spacing token (incl. card-p, sidebar-w 240px, content-max 720px) is present with the matching value; `page-x-lg` = 1.5rem and `section-y` = 2rem.
- Inspect `app/layout.tsx`: JetBrains Mono registered via `next/font` and its `.variable` applied to `<html>`; Inter includes weights 400/500/600/700; `--font-mono` in globals.css points at the registered var.
- Confirm `.output-prose` and `animate-fade-in` blocks are unchanged in `globals.css`.

## Suggested Review Order

**Design tokens (the core of the change)**

- Entry point — the completed `@theme` palette; every later story consumes these token names.
  [`globals.css:4`](../../app/globals.css#L4)

- Typography tokens: `--font-mono` chain + the major-third ×1.25 size scale.
  [`globals.css:68`](../../app/globals.css#L68)

- Radius (xs→full) and layout spacing (page-x-lg 1.5rem, section-y 2rem, card-p, sidebar-w 240px, content-max 720px).
  [`globals.css:88`](../../app/globals.css#L88)

- Legacy `--color-error` kept deliberately — MVP1 components still consume it (cleanup deferred to Epic 2).
  [`globals.css:30`](../../app/globals.css#L30)

- `body` now applies `font-family: var(--font-sans)` so Inter is actually the default (review patch).
  [`globals.css:113`](../../app/globals.css#L113)

**Font wiring**

- JetBrains Mono registered (weights 400/700) and Inter extended to 400/500/600/700; both vars applied to `<html>`.
  [`layout.tsx:12`](../../app/layout.tsx#L12)

**Runtime config (verify-only)**

- Confirmed `output: 'standalone'`; no `output: 'export'`. Unchanged.
  [`next.config.ts:6`](../../next.config.ts#L6)
