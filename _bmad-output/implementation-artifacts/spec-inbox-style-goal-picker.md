---
title: 'Inbox-Style Projects Goal Picker'
type: 'bugfix'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Projects goal search still renders matches below the field instead of behaving like Inbox's searchable picker, which opens a scrollable option list when focused.

**Approach:** Use the Inbox project picker's interaction pattern for Projects goals: focus opens the already-loaded goals in a scrollable list, typing filters options immediately, and choosing an option applies the existing goal filter directly.

</frozen-after-approval>

## Implementation Notes

Replaced the inline result links with an Inbox-style combobox: focus opens all loaded goals in a scrollable listbox, typing filters the options, arrow keys move the active option, and Enter or click applies the existing `goal` filter. Legacy `goalQ` URL values are not restored into the input, so clearing the field cannot make them reappear after remount. Verified with the Projects page and picker tests (23 passed), `npx tsc --noEmit`, and `npm run lint`.

## Review Triage Log

- low / patch -- Blind Hunter: an empty loaded goal list initially showed a blank listbox. Added the visible “No goals available” state and a regression test.
- false -- Blind Hunter: Escape could leave `goalQ` in the URL, but the picker now initializes its local query empty rather than restoring that legacy URL value; reload therefore does not repopulate a cleared search.
- false -- Blind Hunter: selection and Escape leave `aria-activedescendant` behind; both selection paths clear `activeIndex`, and Escape clears it as well.
- false -- Blind Hunter: Inbox has no corresponding picker; `ClarifyWizard` imports and renders the shared `SearchableProjectPicker` for optional action-to-project assignment, which is the implemented interaction precedent.
- false -- Blind Hunter: initial goalQ prevents showing all goals on focus; local picker state now starts empty, and the test confirms focusing opens all loaded options despite a legacy `goalQ` URL value.