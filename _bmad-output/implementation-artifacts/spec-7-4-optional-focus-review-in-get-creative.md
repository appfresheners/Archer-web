---
title: '7.4 Optional Focus Review in Get Creative'
type: 'feature'
created: '2026-10-05'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Get Creative has no optional way to review Life Areas and the Goals and Projects associated with them, so users can miss an Area that needs attention during their weekly review.

**Approach:** Add a read-only Focus review entry to Get Creative showing the existing Focus Area roll-up and a "Review Focus" link to `/app/focus`. Keep it optional: skipping it must not change phase navigation or weekly-review completion, navigating away and returning must restore the persisted review phase, and Vision, Purpose, and Principles remain outside weekly editing.

</frozen-after-approval>

## Implementation Notes

- Extended `lib/review/reviewData.ts` and `app/app/review/page.tsx` to load ordered Areas for resumable reviews and build the same roll-up shown by Focus: assigned Goals plus direct standalone Projects, sorted by name with status. Archived Areas and their linked records remain visible; Goal-linked Projects are not duplicated because they inherit the Goal's Area.
- Added the optional read-only roll-up and `/app/focus` link in `components/review/phase-panels/GetCreativePanel.tsx`. Vision, Purpose, and Principles are not shown or edited, and the existing Get Creative advance and completion gates are unchanged. Area query failures display an alert rather than the empty-Area state.
- Added builder, panel, loader, persisted-phase, and query-failure coverage. Focused review tests passed (51); `npx tsc --noEmit`, `npm run lint`, and the full Vitest suite passed (964 tests).

## Review Triage Log

- **medium / patch:** Area query failures previously appeared as “No Areas yet”; the loader now passes an error state to Get Creative, which displays an alert and retains the Focus link.
- **low / patch:** Updated the review-loader test note from four to five reads and added explicit Area-query failure coverage.
- **false:** The one-shot route intentionally keeps the spec to frozen Intent and Implementation Notes; observable behavior is grounded in the Epic 7 acceptance criteria and documented/tested in the implementation notes.
- **false:** The Focus link remains a normal route link, and the phase is already persisted before Get Creative is rendered; tests cover the persisted `get_creative` PATCH and a reloaded page seeded at that phase with the Focus link.
- **false:** Area descriptions are not part of the approved Story 7.4 acceptance criteria; the optional roll-up surfaces the requested Areas and their linked Goals and Projects.
