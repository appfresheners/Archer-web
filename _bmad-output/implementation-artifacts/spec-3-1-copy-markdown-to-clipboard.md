---
title: "Copy Markdown to Clipboard"
type: "feature"
created: "2026-08-27"
status: "done"
baseline_commit: f39596713d0dd628e5959617a38a7bd5af2503a9
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After generating a GTD breakdown, users have no way to get the raw markdown out of the app. They need one-click copy to paste into Notion where the markdown renders natively.

**Approach:** Add a "Copy Markdown" button below the output panel that writes the raw markdown string to the system clipboard via the Clipboard API, shows a timed confirmation state ("Copied ✓"), announces the state change to screen readers, and provides a fallback textarea modal when clipboard access is denied.

## Boundaries & Constraints

**Always:**

- Clipboard utility lives in `lib/utils/clipboard.ts` — the component never calls `navigator.clipboard` directly.
- Button uses `--color-success` (#10b981) for the confirmation state text/icon.
- Confirmation resets after exactly 2 seconds.
- State change announced via `aria-live="polite"` region.
- Fallback modal pre-selects the full markdown content so the user can Cmd/Ctrl+C immediately.
- Button meets 44×44px minimum touch target on mobile.
- No new dependencies — use native Clipboard API and DOM.

**Ask First:**

- If the Clipboard API `writeText` throws for a reason other than NotAllowedError (e.g., SecurityError in non-HTTPS context), decide whether to show fallback or an error message.

**Never:**

- No third-party clipboard libraries.
- No network requests.
- Do not modify template generation logic or OutputPanel's markdown rendering.
- Do not add the Download button in this story (that's Story 3.2).

## I/O & Edge-Case Matrix

| Scenario          | Input / State                                                 | Expected Output / Behavior                                                              | Error Handling                               |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| Happy path        | User clicks "Copy Markdown" with clipboard permission granted | Raw markdown written to clipboard; button shows "Copied ✓" (emerald) for 2s then resets | N/A                                          |
| Permission denied | Browser denies clipboard write                                | Fallback modal opens with full markdown in a textarea, text pre-selected                | Modal has close button; user copies manually |
| Rapid re-click    | User clicks copy again during 2s confirmation                 | Timer resets; no duplicate clipboard writes                                             | Previous timeout cancelled                   |
| Output cleared    | Mode switch or reset clears output while confirmation showing | Button unmounts cleanly (no orphan timeout)                                             | useEffect cleanup cancels pending timeout    |

</frozen-after-approval>

## Code Map

- `archer/app/page.tsx` — orchestrator; passes `output` (raw markdown) down, renders ActionBar conditionally
- `archer/components/OutputPanel.tsx` — currently renders markdown; ActionBar will be a sibling below it (not inside)
- `archer/components/ActionBar.tsx` — NEW: contains "Copy Markdown" button, manages confirmation state, renders fallback modal
- `archer/lib/utils/clipboard.ts` — NEW: `copyToClipboard(text: string): Promise<{ success: boolean }>` — wraps Clipboard API with try/catch
- `archer/lib/utils/.gitkeep` — DELETE after creating clipboard.ts
- `archer/app/globals.css` — has `--color-success: #10b981` token (no changes needed)
- `archer/vitest.setup.ts` — may need `navigator.clipboard` mock for tests

## Tasks & Acceptance

**Execution:**

- [x] `archer/lib/utils/clipboard.ts` — Create clipboard utility: async function that calls `navigator.clipboard.writeText()`, returns `{ success: true }` on success, `{ success: false }` on any error (including NotAllowedError)
- [x] `archer/components/ActionBar.tsx` — Create ActionBar component with "Copy Markdown" button: receives `markdown: string` prop; manages `copied` boolean state + 2s timeout; shows fallback textarea modal on failure; includes `aria-live="polite"` region for state announcements
- [x] `archer/app/page.tsx` — Import and render ActionBar below OutputPanel (inside the `{output && ...}` block); pass `markdown={output}`
- [x] `archer/components/ActionBar.test.tsx` — Unit tests: renders button, happy-path copy sets confirmation state, permission-denied shows fallback modal, rapid re-click resets timer, aria-live announces state
- [x] `archer/app/page.test.tsx` — Integration tests: ActionBar not rendered when output empty, ActionBar rendered after generation, copy button triggers clipboard write
- [x] `archer/lib/utils/.gitkeep` — Delete (replaced by clipboard.ts)

**Acceptance Criteria:**

- Given output is generated, when I click "Copy Markdown", then `navigator.clipboard.writeText` is called with the raw markdown string (not HTML)
- Given copy succeeds, when I view the button, then it shows "Copied ✓" in emerald color and resets after 2 seconds
- Given clipboard permission is denied, when I click "Copy Markdown", then a modal/fallback appears with the full markdown in a pre-selected textarea
- Given the button is in confirmation state, when a screen reader reads the page, then the state change is announced via aria-live
- Given mobile viewport, when I measure the Copy button, then its touch target is ≥ 44×44px

## Design Notes

**ActionBar placement:** Rendered as a sibling `<div>` below `OutputPanel` in the page layout (not inside OutputPanel). This keeps OutputPanel purely presentational and follows the boundary rule that page orchestrates layout.

**Fallback modal pattern:** A minimal full-screen overlay with a `<textarea>` containing the markdown. The textarea auto-selects on mount so the user can immediately Ctrl+C. A "Close" button dismisses it. No fancy dialog library — a simple fixed-position div with backdrop.

**Button styling:** Primary style matches the Generate button pattern. Confirmation state swaps text + applies `text-[var(--color-success)]` with a subtle transition. The button remains the same size to prevent layout shift.

## Verification

**Commands:**

- `npm run build` -- expected: exits 0, no TypeScript errors
- `npm run lint` -- expected: exits 0, no lint errors
- `npm run test` -- expected: all existing 124 tests pass + new ActionBar/clipboard tests pass

## Suggested Review Order

**Clipboard utility (isolated browser API)**

- Native Clipboard API wrapper with navigator-undefined guard
  [`clipboard.ts:7`](../../archer/lib/utils/clipboard.ts#L7)

- Unit tests proving success/failure/unavailable contract
  [`clipboard.test.ts:1`](../../archer/lib/utils/clipboard.test.ts#L1)

**ActionBar component (copy button + fallback modal)**

- Button with 2s confirmation state, aria-live, and timeout cleanup
  [`ActionBar.tsx:38`](../../archer/components/ActionBar.tsx#L38)

- Fallback modal with Escape-key dismiss and auto-select
  [`ActionBar.tsx:85`](../../archer/components/ActionBar.tsx#L85)

- 11 unit tests covering happy path, failure, rapid re-click, accessibility
  [`ActionBar.test.tsx:1`](../../archer/components/ActionBar.test.tsx#L1)

**Page integration**

- ActionBar rendered conditionally below OutputPanel
  [`page.tsx:74`](../../archer/app/page.tsx#L74)

- 5 integration tests verifying wiring and lifecycle
  [`page.test.tsx:380`](../../archer/app/page.test.tsx#L380)
