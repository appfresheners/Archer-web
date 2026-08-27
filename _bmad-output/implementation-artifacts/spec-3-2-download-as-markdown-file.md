---
title: "Download as Markdown File"
type: "feature"
created: "2026-08-27"
status: "done"
baseline_commit: 5fd304d03c21d95623c9e875797be198ea47b307
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After generating a GTD breakdown, users can copy markdown to clipboard (Story 3.1) but have no way to save it as a persistent file for later import into Notion or offline use.

**Approach:** Add a "Download .md" button to the existing ActionBar that constructs a Blob from the raw markdown, triggers a browser-native file download via an anchor click, shows a timed "Downloaded ✓" confirmation state, and uses a filename format of `archer-{mode}-{slug}.md` where slug is derived from the user's input text.

## Boundaries & Constraints

**Always:**

- Download utility lives in `lib/utils/download.ts` — the component never constructs Blobs or creates object URLs directly.
- Slugify utility lives in `lib/utils/slugify.ts` — pure function, no side effects.
- Button uses `--color-success` (#10b981) for the "Downloaded ✓" confirmation state text.
- Confirmation resets after exactly 2 seconds (same pattern as Copy button).
- State change announced via the existing `aria-live="polite"` region in ActionBar.
- Filename format: `archer-goal-{slug}.md` or `archer-project-{slug}.md`.
- Slug rules: lowercase, alphanumeric + hyphens only, no leading/trailing hyphens, max 50 characters, truncated at word boundary.
- Button styled as secondary outline (border, no fill) matching the design system.
- Button meets 44×44px minimum touch target on mobile.
- No new dependencies — use native Blob, URL.createObjectURL, and anchor click.
- Object URL must be revoked after download to prevent memory leaks.

**Ask First:**

- If `URL.createObjectURL` is unavailable (very old browsers), decide whether to show a fallback or silently fail.

**Never:**

- No network requests.
- No third-party file-saving libraries.
- Do not modify the Copy Markdown button behavior or the clipboard utility.
- Do not modify template generation logic or OutputPanel's markdown rendering.

## I/O & Edge-Case Matrix

| Scenario               | Input / State                                                | Expected Output / Behavior                                                                                                           | Error Handling                            |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Happy path             | User clicks "Download .md" with output generated             | Browser triggers download of `archer-goal-learn-guitar.md` with raw markdown content; button shows "Downloaded ✓" for 2s then resets | N/A                                       |
| Special chars in input | Input: "My goal: 100% success!!!"                            | Filename slug: `my-goal-100-success` (special chars stripped, spaces → hyphens)                                                      | N/A                                       |
| Long input             | Input > 50 chars after slugification                         | Slug truncated to 50 chars at nearest word boundary, no trailing hyphen                                                              | N/A                                       |
| Empty input edge       | Input is whitespace (shouldn't reach here due to validation) | Slug falls back to `untitled`                                                                                                        | N/A                                       |
| Rapid re-click         | User clicks Download again during 2s confirmation            | Timer resets; no duplicate downloads triggered                                                                                       | Previous timeout cancelled                |
| Output cleared         | Mode switch clears output while confirmation showing         | Button unmounts cleanly (no orphan timeout)                                                                                          | useEffect cleanup cancels pending timeout |

</frozen-after-approval>

## Code Map

- `archer/components/ActionBar.tsx` — MODIFY: add Download button as sibling to Copy button inside the `flex items-center gap-3` container (line 62); extend props to accept `mode` and `inputText`; add download confirmation state + timer with same pattern as copy
- `archer/app/page.tsx` — MODIFY: pass `mode={mode}` and `inputText={inputText}` to ActionBar (line 79)
- `archer/lib/utils/download.ts` — NEW: `downloadMarkdown(content: string, filename: string): { success: boolean }` — creates Blob, object URL, triggers via anchor click, revokes URL
- `archer/lib/utils/slugify.ts` — NEW: `slugify(text: string, maxLength?: number): string` — lowercase, strip non-alphanumeric (except spaces/hyphens), collapse whitespace → hyphens, trim hyphens, truncate at word boundary
- `archer/lib/utils/clipboard.ts` — READ-ONLY: reference for utility pattern (async, returns `{ success: boolean }`)
- `archer/components/ActionBar.test.tsx` — MODIFY: add tests for Download button behavior
- `archer/lib/utils/download.test.ts` — NEW: unit tests for download utility
- `archer/lib/utils/slugify.test.ts` — NEW: unit tests for slugify utility
- `archer/app/page.test.tsx` — MODIFY: add integration tests for Download button wiring

## Tasks & Acceptance

**Execution:**

- [x] `archer/lib/utils/slugify.ts` — Create slugify utility: pure function that lowercases, replaces non-alphanumeric with hyphens, collapses consecutive hyphens, trims leading/trailing hyphens, truncates at word boundary to maxLength (default 50)
- [x] `archer/lib/utils/slugify.test.ts` — Unit tests: basic slugification, special characters stripped, consecutive hyphens collapsed, truncation at word boundary, empty/whitespace input returns "untitled", no trailing hyphens
- [x] `archer/lib/utils/download.ts` — Create download utility: synchronous function that constructs a text/markdown Blob, creates object URL, appends a hidden anchor, clicks it, removes anchor, revokes URL; returns `{ success: true }` on completion or `{ success: false }` if URL.createObjectURL is unavailable
- [x] `archer/lib/utils/download.test.ts` — Unit tests: calls createObjectURL with correct Blob, triggers anchor click with correct href/download attributes, revokes object URL after click, returns `{ success: false }` when createObjectURL unavailable
- [x] `archer/components/ActionBar.tsx` — Extend props interface to add `mode: "goal" | "project"` and `inputText: string`; add "Download .md" button (secondary outline style) after Copy button; implement download handler using slugify + downloadMarkdown; add `downloaded` state + 2s timeout with same pattern as `copied`; update aria-live region to announce download state
- [x] `archer/components/ActionBar.test.tsx` — Add tests: renders Download button, happy-path triggers downloadMarkdown with correct filename, confirmation state shows "Downloaded ✓" for 2s then resets, rapid re-click resets timer, aria-live announces download state
- [x] `archer/app/page.tsx` — Update ActionBar usage to pass `mode={mode}` and `inputText={inputText}` props
- [x] `archer/app/page.test.tsx` — Add integration tests: Download button not rendered when output empty, Download button rendered after generation, download triggers with correct filename format

**Acceptance Criteria:**

- Given output is generated, when I click "Download .md", then a file downloads with the raw markdown content and filename `archer-{mode}-{slug}.md`
- Given download succeeds, when I view the button, then it shows "Downloaded ✓" in emerald color and resets after 2 seconds
- Given the button is in confirmation state, when a screen reader reads the page, then the state change is announced via aria-live
- Given input text "Become a proficient guitarist in 3 months" in Goal mode, when I download, then filename is `archer-goal-become-a-proficient-guitarist-in-3-months.md`
- Given mobile viewport, when I measure the Download button, then its touch target is ≥ 44×44px
- Given the Download button, when I inspect its styling, then it uses secondary outline style (border, no background fill)

## Spec Change Log

## Design Notes

**Download button styling:** Secondary outline — `border border-[var(--color-border)]` with `text-[var(--color-text-primary)]`, transparent background, hover adds `bg-[var(--color-surface)]`. Same height and padding as Copy button for visual balance.

**ActionBar responsive layout:** On mobile (<640px), buttons stack vertically full-width with "Copy Markdown" first (primary) and "Download .md" second (secondary outline). Desktop keeps horizontal layout. This aligns with Epic 3 UX requirements.

**Filename generation:** Page.tsx passes `mode` and `inputText` to ActionBar. ActionBar composes the filename: `archer-${mode}-${slugify(inputText)}.md`. If `inputText` is somehow empty, slugify returns "untitled" as fallback.

**Download mechanism:** Synchronous — create Blob → URL → hidden anchor → click → cleanup. No async needed since no network request or permission check involved (unlike clipboard). The utility still returns `{ success: boolean }` for consistency and to handle the edge case where `URL.createObjectURL` doesn't exist.

## Verification

**Commands:**

- `npm run build` -- expected: exits 0, no TypeScript errors
- `npm run lint` -- expected: exits 0, no lint errors
- `npm run test` -- expected: all existing tests pass + new download/slugify/ActionBar tests pass

## Suggested Review Order

**Utilities (isolated browser API wrappers)**

- Pure slug function — lowercase, strip, truncate at word boundary
  [`slugify.ts:5`](../../archer/lib/utils/slugify.ts#L5)

- Blob + object URL + anchor click with delayed revoke for Firefox
  [`download.ts:5`](../../archer/lib/utils/download.ts#L5)

- Unit tests proving slugify edge cases and fallback to "untitled"
  [`slugify.test.ts:4`](../../archer/lib/utils/slugify.test.ts#L4)

- Unit tests proving Blob creation, anchor attributes, and URL revocation
  [`download.test.ts:4`](../../archer/lib/utils/download.test.ts#L4)

**ActionBar component (download button + confirmation state)**

- Download handler with ref-based duplicate guard and 2s timeout
  [`ActionBar.tsx:63`](../../archer/components/ActionBar.tsx#L63)

- Secondary outline button alongside existing Copy button, responsive stacking
  [`ActionBar.tsx:101`](../../archer/components/ActionBar.tsx#L101)

- 10 new unit tests covering filename generation, confirmation, and duplicate guard
  [`ActionBar.test.tsx:213`](../../archer/components/ActionBar.test.tsx#L213)

**Page integration**

- Passes mode and inputText props to ActionBar for filename construction
  [`page.tsx:77`](../../archer/app/page.tsx#L77)

- 5 integration tests verifying download wiring across mode switch
  [`page.test.tsx:472`](../../archer/app/page.test.tsx#L472)
