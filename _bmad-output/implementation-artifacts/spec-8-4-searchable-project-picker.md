---
title: 'Searchable Project Picker'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c296647f83db48d1a79f8f5c906c9997c4120db5'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-8-3-shared-search-and-pagination-for-long-lists.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Assigning a project in Inbox Clarify or goal detail requires scrolling a native dropdown, which becomes cumbersome as projects accumulate.

**Approach:** Replace both controls with a shared searchable project picker that filters the already-loaded options by project name and displays each project's parent goal. Preserve the existing selection, save, ownership, and move-confirmation behavior.

## Boundaries & Constraints

**Always:** Use an accessible combobox with case-insensitive filtering, Up/Down/Enter/Escape handling, Tab navigation, a polite match-count announcement, no-match feedback, and a 50-result display cap with a “Keep typing to narrow results” hint. Include project name and parent goal in each option. Exclude archived and completed projects from both pickers. Keep filtering client-side over already-loaded RLS-scoped options. Preserve optional/null assignment in Clarify, goal attach behavior, the move-from-another-goal confirmation, and current ownership validation on save.

**Never:** Add an API route or write path, change the existing mutation routes or ownership checks, or change unrelated project eligibility and assignment behavior beyond the resolved open question.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Search options | User types a project-name fragment | Matching options are filtered case-insensitively and include parent-goal context | Announce the match count politely |
| No matches | Query matches no loaded projects | Show “No projects match” and retain a usable way to edit or clear the query | No write occurs |
| Large option set | More than 50 options match | Render at most 50 options and show “Keep typing to narrow results” | N/A |
| Keyboard selection | Focus is in the combobox with results | Up/Down changes the active option, Enter selects, Escape closes, and Tab moves focus onward | N/A |
| Clarify assignment | No project is selected, or a project is selected | Save `project_id: null` or the selected project ID through the existing action flow | Existing API errors and retry behavior remain unchanged |
| Attach project | A project is selected from goal detail | Attach immediately if unlinked, or keep the existing confirmation before moving it from another goal | Existing inline API error remains; cancel performs no write |

</frozen-after-approval>

## Code Map

- `components/inbox/clarify/ClarifyWizard.tsx` -- Replace the optional native select; keep `projectId` and the existing action POST payload (`project_id` or `null`).
- `app/app/inbox/[id]/page.tsx` -- `loadClarifyData` loads RLS-scoped project options; read from the existing `project_search` view to provide name, parent-goal text, status, and goal relationship without adding an endpoint.
- `app/app/goals/[id]/AttachProjectControl.tsx` -- Replace the native select; preserve exclusion of projects already attached to this goal, immediate attach, confirmation when moving from another goal, PATCH payload, and refresh behavior.
- `app/app/goals/[id]/page.tsx` -- `loadAttachableProjects` loads goal-detail options; use the existing `project_search` view for picker display and eligibility fields.
- `components/shared/` -- Add a reusable searchable combobox and focused tests for filtering, ARIA state, keyboard behavior, announcements, no matches, and the result cap.
- `app/app/inbox/[id]/page.test.tsx` -- Add focused coverage that the Clarify loader supplies parent-goal and status fields from RLS-scoped project options.
- `components/inbox/clarify/ClarifyWizard.test.tsx`, `app/app/goals/[id]/AttachProjectControl.test.tsx`, `app/app/goals/[id]/page.test.tsx` -- Extend existing flow and loader coverage for status eligibility and unchanged assignment behavior.
- `app/api/actions/route.ts`, `app/api/projects/[id]/route.ts` -- Existing ownership checks remain authoritative and unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `components/shared/SearchableProjectPicker.tsx`, `components/shared/SearchableProjectPicker.test.tsx` -- Build and test the shared accessible picker, client-side matching, parent-goal labels, empty states, keyboard interactions, polite announcements, and 50-option cap.
- [x] `app/app/inbox/[id]/page.tsx`, `app/app/inbox/[id]/page.test.tsx`, `components/inbox/clarify/ClarifyWizard.tsx`, `components/inbox/clarify/ClarifyWizard.test.tsx` -- Supply enriched RLS-scoped options, test loader and eligibility behavior, and preserve optional project assignment through the existing action request.
- [x] `app/app/goals/[id]/page.tsx`, `app/app/goals/[id]/AttachProjectControl.tsx`, `app/app/goals/[id]/AttachProjectControl.test.tsx`, `app/app/goals/[id]/page.test.tsx` -- Supply enriched options and preserve filtering by current goal, move confirmation, mutation, and refresh behavior.

**Acceptance Criteria:**
- Given either assignment control, when opened, then its combobox filters loaded projects case-insensitively by name and shows each project with its parent goal.
- Given keyboard focus in the picker, when Up, Down, Enter, Escape, or Tab is used, then active-option, selection, close, and focus behavior follow the combobox contract.
- Given matches or no matches, when the result set changes, then a polite live region announces the count and the UI shows the specified no-match or over-50 hint; no more than 50 options render.
- Given Clarify assignment, when no project or a project is selected, then the existing action flow sends `null` or that project ID respectively.
- Given goal-detail attachment, when a current-goal project is ineligible or a different-goal project is chosen, then existing exclusion and move-confirmation behavior remains intact.
- Given any selection, when the existing mutation route validates it, then ownership checks and save behavior are unchanged; no new route or write path is introduced.

## Implementation Notes

Both loaders now read project name, status, goal relationship, and parent-goal text from the existing RLS-scoped `project_search` view. The shared picker performs name filtering in the browser, caps visible results at 50, excludes archived/completed options, and provides keyboard, ARIA, announcement, and empty states. Clarify selection/clear continues through the existing action POST (`project_id` or `null`); goal attachment retains its PATCH, move confirmation, cancel, error, and refresh behavior.

## Spec Change Log

## Review Triage Log

- medium / patch -- Blind Hunter: typing a replacement Clarify query retained the previous `projectId`, so submission could silently send an assignment no longer shown in the input. Confirmed the parent value was untouched by picker edits and consumed by the action payload; editing now clears it and an integration test verifies `null` is sent.
- low / patch -- Blind Hunter: a selected option had `aria-selected="true"` but no distinct visual styling when the list opened. Confirmed its class depended only on active keyboard index; selected options now receive a visible marker and a component test asserts it.
- medium / patch -- Blind Hunter: moving focus away by click left the list open and combobox expanded. Confirmed there was no blur dismissal; the input now closes and clears active descendant on blur.
- medium / patch -- Edge Case Hunter: clicking another focusable control while options were open left the list visible and `aria-expanded` true. This is the same blur-dismissal defect above; fixed once by the same handler.
- medium / patch -- Blind Hunter: keyboard navigation changed `aria-activedescendant` without scrolling the active option into view in a long list. Confirmed no scroll behavior existed; the active option now scrolls into view and a component test covers it.
- low / patch -- Blind Hunter: the clear button claimed it cleared a project selection even when only a search query existed. Confirmed the action only cleared the query in that state; its accessible name now reflects whether a value is selected.
- false -- Blind Hunter: the singular announcement “1 project matches” was claimed to be ungrammatical. The singular subject “project” correctly takes the singular verb “matches”; the announcement was independently improved to include the query so equal-count result changes are announced.
- medium / patch -- Blind Hunter: a live region containing only the count did not change when different query results had the same count. Confirmed React rendered identical text for such changes; the announcement now includes the trimmed query.

## Design Notes

The existing `project_search` view already exposes project name, status, goal ID, and parent-goal text through an RLS-invoker view; it can enrich both option lists while leaving search and selection in the browser.

## Verification

**Commands:**
- `npm test -- components/shared/SearchableProjectPicker.test.tsx components/inbox/clarify/ClarifyWizard.test.tsx app/app/inbox/[id]/page.test.tsx app/app/goals/[id]/AttachProjectControl.test.tsx app/app/goals/[id]/page.test.tsx` -- passed: 33 tests across picker interactions, both assignment flows, and both loaders.
- `npx tsc --noEmit` -- passed: no TypeScript errors.
- `npm run lint` -- passed: no lint errors.