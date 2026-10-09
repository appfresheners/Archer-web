---
title: 'Live Project Goal Search'
type: 'bugfix'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Projects goal search still requires a Search-button submit, so matching goals do not appear as the user types as requested.

**Approach:** Filter the already-loaded goal options on every input change, with no Search button. Keep matching goal links as the direct selection action and preserve the existing All/No goal filter, selected-goal behavior, clear-search behavior, and project-list query state.

</frozen-after-approval>

## Implementation Notes

Projects goal matches now update on each keystroke; the Search submit button is removed, and selecting a matching goal remains the filter action. Verified with `npm test -- app/app/projects/ProjectFilterSelect.test.tsx` (3 tests passed).

## Review Triage Log

- false -- Blind Hunter: acceptance criteria are intentionally absent because the one-shot workflow requires only frontmatter, Intent, and Implementation Notes; the required implementation notes are now populated with the change and verification.
- false -- Blind Hunter: `supabase/.temp/cli-latest` was a pre-existing unrelated user modification, remains untouched, and is excluded from this fix.