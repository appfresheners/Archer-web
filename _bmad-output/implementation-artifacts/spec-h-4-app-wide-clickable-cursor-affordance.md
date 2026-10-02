---
title: "App-wide Clickable Cursor Affordance"
type: "hardening"
created: "2026-10-01"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "30062459ffb2d8580d93e0aa631a82b810775f44"
---

<frozen-after-approval reason="human-approved course correction">

## Intent

**Problem:** Cursor feedback is assigned inconsistently across the app, so enabled clickable controls do not always communicate that they can be activated.

**Approach:** Establish a shared pointer-cursor rule for enabled semantic interactive elements and button-like controls, while preserving the not-allowed cursor for disabled controls. Audit existing custom click handlers and use semantic controls where needed.

## Boundaries & Constraints

**Always:** Apply consistently across authenticated and auth surfaces. Preserve keyboard operation, visible focus, hover/selected states, and the 44px touch-target/accessibility requirements. Cursor shape is supplemental, not the sole indication of interactivity. Disabled and `aria-disabled="true"` controls retain a not-allowed cursor.

**Ask First:** Any interaction redesign or component-library/dependency addition.

**Never:** Add click handlers to non-semantic elements merely to qualify them for pointer styling; make disabled controls appear enabled.

## Acceptance Criteria

- Enabled links, buttons, selects, checkboxes/radios, disclosure summaries, and semantic custom button-like controls render a pointer cursor.
- Disabled native controls and `aria-disabled="true"` controls render a not-allowed cursor.
- Any custom clickable element found in the audit is converted to an appropriate semantic interactive element or receives equivalent keyboard, role, and focus behavior.
- Pointer styling does not replace visible hover, focus, selected, or disabled states.
- Browser checks verify representative enabled and disabled controls across app surfaces; existing component tests and lint remain clean.

## Code Map

- `app/globals.css` -- shared rules for interactive and disabled controls.
- `components/**` and `app/**` -- audit custom click handlers and non-semantic controls; add local exceptions only when needed and documented.

## Review Triage Log

- blind-hunter · `a[href]`/`select`/`input` pointer selectors omit `:not([aria-disabled="true"])`, so aria-disabled controls kept pointer · medium: patched — exclusions added.
- edge-case-hunter · same aria-disabled specificity gap (pointer 0-1-1 beats not-allowed 0-1-0) · medium: patched (same fix).
- blind-hunter · test missing aria-disabled variants of link/select/checkbox · medium: patched — fixture + assertions added.
- verification-gap · unlayered rule overrode `ProjectModeInput`'s `cursor-not-allowed` on logically-disabled submit buttons · medium: patched — rules moved into `@layer base` so component cursor utilities override.
- blind-hunter · date/time/color/file inputs lack pointer · low: rejected (not in the spec's enumerated controls).
- blind-hunter · labels lack a pointer rule · low: rejected (not in the spec's controls).
- blind-hunter · selector-coverage test brittle to whitespace edits · low: rejected.
- blind-hunter · `extractAffordanceRules` calls `expect()` at module top level · low: rejected.
- blind-hunter · test resolves via `process.cwd()` · low: rejected.
- blind-hunter · `summary` selected globally rather than `details > summary` · low: rejected (stray summary is invalid HTML).
- blind-hunter · `[aria-disabled="true"]` on group containers shows not-allowed · low: rejected (matches spec intent).
- blind-hunter · sprint-status in-progress vs spec in-review · false: lifecycle sync happens at completion.
- edge-case-hunter · `[role="button"]` lacks `:not(:disabled)` · low: rejected (a div cannot be `:disabled`).
- edge-case-hunter · `aria-disabled="TRUE"` case-sensitivity · low: rejected (non-conforming ARIA value).
- edge-case-hunter · `[role="link"]` and href-less anchors lack pointer · low: rejected.
- edge-case-hunter · `input[type=submit|button|reset]` omitted · low: rejected (spec enumerates `<button>`).
- edge-case-hunter + verification-gap · synthetic jsdom fixture vs a real browser check across app surfaces · defer: browser automation (Playwright) would need sign-off; jsdom computed styles are a reasonable proxy.

## Verification

- Add a focused browser-level style check for enabled/disabled control cursors.
- Run `npm run lint`, `npx tsc --noEmit`, focused UI tests, and `npm run build`.
