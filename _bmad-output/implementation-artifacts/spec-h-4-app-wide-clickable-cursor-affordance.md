---
title: "App-wide Clickable Cursor Affordance"
type: "hardening"
created: "2026-10-01"
status: "ready-for-dev"
review_loop_iteration: 0
context: []
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

## Verification

- Add a focused browser-level style check for enabled/disabled control cursors.
- Run `npm run lint`, `npx tsc --noEmit`, focused UI tests, and `npm run build`.
