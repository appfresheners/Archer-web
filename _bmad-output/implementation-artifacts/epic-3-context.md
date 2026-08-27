# Epic 3 Context: Export Actions & Polish

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to extract their generated GTD breakdown from Archer via clipboard copy or file download, both producing Notion-optimized markdown. Additionally, provide discovery aids (try an example) and reset flow (start over) so the complete user journey—from first visit to exported output—is seamless and self-evident.

## Stories

- Story 3.1: Copy Markdown to Clipboard
- Story 3.2: Download as Markdown File
- Story 3.3: Try an Example
- Story 3.4: Start Over
- Story 3.5: Notion-Optimized Markdown Quality

## Requirements & Constraints

- Copy writes the raw markdown string (not rendered HTML) to the system clipboard. On permission denial, a fallback textarea modal must allow manual copy.
- Download triggers a browser-native file save with filename `archer-{mode}-{slug}.md`. Slug is derived from user input (lowercase, hyphens, no special characters).
- Both Copy and Download buttons show a confirmation state ("Copied ✓" / "Downloaded ✓" in emerald color) for exactly 2 seconds, then reset. State changes must be announced via `aria-live`.
- "Try an example" pre-fills the input with a curated string per mode (Goal: "Become a proficient guitarist in 3 months"; Project: "Personal portfolio website deployed online") and auto-triggers generation and scroll.
- "Start over" clears input and output, scrolls to top, returns focus to the input field, restoring exact initial page state.
- Generated markdown must be Notion-optimized: `#` headings, `- [ ]` checkboxes (space after dash, space inside brackets), `|` pipe tables with header separator row, blank line between every block element, no trailing whitespace or extra newlines.
- Project Mode action lists use `- [ ]` checkboxes (not numbered lists) for Notion compatibility.
- No network requests, cookies, analytics, or data collection at any point (NFR6).

## Technical Decisions

- Browser APIs (clipboard, download, scroll) are isolated in `lib/utils/` — components never call raw APIs directly.
- `lib/utils/clipboard.ts` handles copy-to-clipboard with permission-denial fallback.
- `lib/utils/download.ts` constructs a Blob, creates an object URL, triggers via anchor click, and revokes the URL. No network requests.
- `lib/utils/slugify.ts` converts user input to a safe filename slug.
- All state lives in `useState` on the page component (AD-3). No external state libraries.
- Template functions in `lib/templates/` are pure — Epic 3 consumes their output but does not modify generation logic.
- Components: `ActionBar.tsx` (Copy + Download buttons), `ExampleButton.tsx` ("Try an example" trigger). These receive props and emit callbacks; the page orchestrates.

## UX & Interaction Patterns

- ActionBar renders inline beneath the output panel. On mobile (<640px), buttons stack vertically full-width with "Copy Markdown" first (primary style) and "Download .md" second (secondary outline).
- "Try an example" uses ghost/text-link styling (not a primary button) and must meet 44×44px minimum touch target.
- Confirmation button state: text swaps + emerald color for 2s, then auto-resets.
- Focus order within this epic's scope: output region → Copy → Download → Start over.
- After "Start over", focus returns to the input field.
- All animations respect `prefers-reduced-motion`.

## Cross-Story Dependencies

- Stories 3.1, 3.2, and 3.5 all depend on Epic 2's template engine output (the raw markdown string stored in page state).
- Story 3.3 depends on Epic 2's generation flow (it triggers the same submit logic).
- Story 3.5 is a quality constraint that applies to template output from Epic 2 — implementation may require adjustments to `lib/templates/` files created in Epic 2.
- ActionBar and ExampleButton components mount inside or adjacent to the OutputPanel created in Epic 2.
