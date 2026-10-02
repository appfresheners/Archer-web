---
title: "Remove Dead Copy/Download Code"
type: "chore"
created: "2026-09-27"
status: "done"
baseline_commit: "bce007ac8277af1056ad9196f8b94055e2aed93d"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The superseded static-export MVP1 UI still ships: the unauthenticated root page `app/page.tsx` and its whole tree — mode toggle, markdown output panel, a "Copy Markdown"/"Download .md" ActionBar, and a client-side encrypted localStorage "vault" (SavedBreakdowns, portable identity). None of it is reachable from the authenticated Supabase app, it contradicts the current architecture (structured JSON persisted to Supabase, no copy/download, Archer as system of record), and its `mode:'goal'` POST now 400s. It is dead weight and a source of confusion.

**Approach:** Delete the entire dead MVP1 tree — the root page, its five components, the `lib/vault/` directory, the copy/download/slugify/escape-markdown utils, and the now-orphaned markdown templates — plus all their tests. Investigation (recorded in the Code Map) confirmed the tree is fully self-contained: nothing under the live app imports any of it. Replace the now-empty `/` route with a redirect into the authenticated app so the root still resolves. After removal, no "Copy Markdown" or "Download .md" control exists anywhere, and the build/tests are green with no references to the removed modules.

## Boundaries & Constraints

**Always:**

- Remove `components/ActionBar.tsx`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` so they are referenced by no UI surface, and ensure no "Copy Markdown" or "Download .md" control appears anywhere in the product.
- Remove the rest of the dead MVP1 tree that exists only to support that root page, since leaving it would strand dead code that imports the removed utils: `app/page.tsx`, `components/{InputSection,ModeToggle,OutputPanel,SavedBreakdowns}.tsx`, the entire `lib/vault/` directory, `lib/utils/slugify.ts`, `lib/utils/escape-markdown.ts`, and `lib/templates/{goal,project}-template.ts` — with every associated `*.test.*` file.
- Replace the `/` route: since `app/page.tsx` is deleted, add a root route that redirects to the authenticated app (`/app/engage`) so `/` does not 404. (Middleware still bounces unauthenticated users to `/sign-in`.)
- After removal: `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build` all pass, with no import or reference to any removed module remaining anywhere.

**Ask First:**

- Removing now-unused npm dependencies (`react-markdown`, `rehype-raw`, `remark-gfm`, `qrcode`) from `package.json` — confirm before touching dependencies (they are harmless if left, and a later epic may re-introduce a renderer). Default: leave them.

**Never:**

- Do not touch any file under the live app: `app/app/**`, `app/api/**`, `lib/ai/**`, `lib/projects/**`, `lib/supabase/**`, `components/{auth,authenticated,projects}/**`.
- Do not reintroduce any copy, download, or markdown-render path.
- Do not delete `app/layout.tsx`, `app/globals.css`, `app/auth/**`, or the `(auth)` routes.

## I/O & Edge-Case Matrix

| Scenario                         | Input / State   | Expected Output / Behavior                                                                                 | Error Handling |
| -------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| Visit `/`                        | any user        | Redirects into the app (`/app/engage`); unauthenticated users are then bounced to `/sign-in` by middleware | N/A            |
| Search product for copy/download | full app        | No "Copy Markdown" / "Download .md" control exists on any surface                                          | N/A            |
| Build after removal              | `npm run build` | Succeeds; no unresolved imports; `/` resolves via redirect                                                 | N/A            |
| Tests after removal              | `npm test`      | Green; no test references a removed module                                                                 | N/A            |

</frozen-after-approval>

## Code Map

Investigation partition (context-gathered; the dead tree is fully self-contained — no live consumer imports any of it):

**Delete — dead MVP1 UI (root + components):**

- `app/page.tsx` -- the unauthenticated MVP1 root; its imports define the whole tree. Its `/` route is replaced by a redirect (below).
- `components/ActionBar.tsx` -- the Copy/Download control (the story's headline target).
- `components/InputSection.tsx`, `components/ModeToggle.tsx`, `components/OutputPanel.tsx`, `components/SavedBreakdowns.tsx` -- MVP1-only components; not imported by the live app (the live Project Mode uses `components/projects/*`; the detail view renders structured data, not `OutputPanel`).

**Delete — dead libs (used only by the tree above):**

- `lib/vault/` (whole directory: `useVaultSession.ts`, `transfer.ts`, `encrypted-storage.ts`, `storage.ts`, `crypto.ts`, `portable-identity.ts`, `types.ts`) -- the localStorage vault, superseded by Supabase persistence; consumed only by `app/page.tsx`/`SavedBreakdowns`.
- `lib/utils/clipboard.ts`, `lib/utils/download.ts` -- copy/download primitives (headline targets); consumed only by `ActionBar`/`SavedBreakdowns`/`vault/transfer`.
- `lib/utils/slugify.ts` -- consumed only by `ActionBar`.
- `lib/utils/escape-markdown.ts` -- consumed only by the templates below.
- `lib/templates/goal-template.ts`, `lib/templates/project-template.ts` -- orphaned static markdown templates; the live route generates structured JSON via `lib/projects/generate-project.ts` and does not use these.

**Delete — all tests for the above:**

- `app/page.test.tsx`, `app/page.a11y.test.tsx`, `app/page.contrast.test.tsx`, `app/page.layout.test.tsx`, `app/page.motion.test.tsx`
- `components/ActionBar.test.tsx`, `components/InputSection.test.tsx`, `components/ModeToggle*.test.tsx` (test, a11y, keyboard, visual), `components/OutputPanel.test.tsx`, `components/SavedBreakdowns*.test.tsx` (test, a11y)
- `lib/vault/*.test.ts` (crypto, encrypted-storage, portable-identity, storage, transfer, useVaultSession)
- `lib/utils/{clipboard,download,slugify}.test.ts`, `lib/templates/{goal,project}-template.test.ts`

**Add:**

- `app/page.tsx` -- **replace** with a minimal server component that `redirect("/app/engage")` (import `redirect` from `next/navigation`). Keeps `/` resolving; middleware handles the unauthenticated bounce to `/sign-in`.

**Keep (must not touch):** everything under `app/app/**`, `app/api/**`, `lib/ai/**`, `lib/projects/**`, `lib/supabase/**`, `components/{auth,authenticated,projects}/**`, `app/layout.tsx`, `app/globals.css`, `app/auth/**`, the `(auth)` routes.

## Tasks & Acceptance

**Execution:**

- [x] Delete the dead components: `components/{ActionBar,InputSection,ModeToggle,OutputPanel,SavedBreakdowns}.tsx` and their test files.
- [x] Delete the dead libs: the whole `lib/vault/` directory, `lib/utils/{clipboard,download,slugify,escape-markdown}.ts`, `lib/templates/{goal,project}-template.ts`, and all their test files.
- [x] Replace `app/page.tsx` with a server component that redirects `/` to `/app/engage`; delete the MVP1 root's `app/page.*.test.tsx` files.
- [x] Verify no dangling references: a repo-wide search for the removed module paths/symbols returns nothing outside deleted files. (Review also removed the now-orphaned `--color-error` token.)

**Acceptance Criteria:**

- Given the codebase from the prior build, when the cleanup pass runs, then `ActionBar`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` are no longer referenced by any UI surface, and no "Copy Markdown" or "Download .md" control appears anywhere in the product.
- Given the app after cleanup, when the build and existing tests run, then they pass with no references to the removed modules.
- Given the `/` route after `app/page.tsx` is replaced, when it is visited, then it redirects into the authenticated app rather than 404-ing.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no unresolved imports from removed modules.
- `npm test` -- expected: suite green; no test references a removed module.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; `/` present as a redirect; standalone intact.

**Manual checks:**

- Repo-wide grep for `ActionBar`, `clipboard`, `download`, `OutputPanel`, `SavedBreakdowns`, `useVaultSession`, `lib/vault`, `lib/templates` returns only historical planning/spec docs, not live code.
- Confirm no "Copy Markdown" / "Download .md" text exists in any component.

## Suggested Review Order

- Entry point — the root route is now a redirect into the authenticated app (the MVP1 landing is gone). The `/` contract is verified by the proxy middleware tests.
  [`page.tsx:10`](../../app/page.tsx#L10)

- The copy/download control (`ActionBar`), the markdown output panel, the mode toggle/input, the saved-breakdowns UI, the whole `lib/vault/` tree, the copy/download/slugify/escape-markdown utils, and the orphaned markdown templates were deleted (8.6k lines) — confirmed self-contained with no live consumer.
  (deletions — see `git diff --stat`)

- Orphaned `--color-error` design token + its stale "consumed by MVP1 components" comment removed (its only consumers were the deleted components).
  [`globals.css`](../../app/globals.css)
