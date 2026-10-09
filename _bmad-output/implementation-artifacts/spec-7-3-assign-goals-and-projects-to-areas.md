---
title: '7.3 Assign Goals and Projects to Areas'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '1746540d0ddb5575a0f724315bbdbecad6a9aa68'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Goals and standalone Projects cannot yet be assigned to Life Areas, so Focus cannot show all work belonging to an ongoing responsibility.

**Approach:** Let users optionally assign an Area when creating or editing a Goal or standalone Project, preserve the single-parent Project model, and show inherited Area context for Goal-linked Projects.

## Boundaries & Constraints

**Always:** Area assignment is optional. A Project may have a Goal or a direct Area, never both; Goal-linked Projects inherit the Goal's Area. Goal creation persists its selected Area in the same atomic save as the Goal and generated Projects; the Area ID is not sent to the AI prompt. Reject another user's Area ID before any write, and before provider calls for standalone AI Project creation. Archived Areas are hidden only in assignment selectors; routes and the database do not reject a user-owned archived Area ID submitted directly. Existing links remain attached and visible. Preserve Goal and Project status, date, and lifecycle semantics.

**Never:** Change the existing Focus schema/types without a demonstrated need; store a direct Area on a Goal-linked Project; add archive-state rejection to routes or the database; alter Goal generation content, project generation prompts, or unrelated Focus/review/export behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Optional Goal Area | Active owned Area or no selection | Goal saves the Area ID or null; Goal detail and Focus show the assignment | Invalid/foreign IDs cause no write |
| Standalone Project | Manual or AI creation with optional Area | Saves with `goal_id = null`; no selection remains valid | Invalid/foreign IDs rejected; AI path rejects before provider call |
| Parent change | Area-linked Project is assigned a Goal | Clear direct `area_id`; show the Goal's inherited Area | Reject foreign Goal; failed update preserves prior parent |
| Archived Area | Archived Area ID submitted through the UI or directly to a route | Selector omits it; a direct request with a user-owned ID is accepted | Existing links remain intact |

</frozen-after-approval>

## Code Map

- `app/app/goals/new/GoalWizard.tsx`, `components/goals/WizardStep4.tsx`, and `app/api/generate/route.ts` - transient wizard state, Pattern C request, and atomic `save_goal_breakdown` persistence; current RPC omits `area_id`.
- `app/app/goals/[id]/page.tsx`, `GoalDetailClient.tsx`, `app/api/goals/[id]/route.ts`, and `lib/goals/validate.ts` - Goal detail read/edit and PATCH validation.
- `app/app/projects/new/page.tsx`, `NewProjectClient.tsx`, `components/projects/ProjectModeInput.tsx`, and `load-goals.ts` - active assignment options and manual/AI create payloads.
- `app/app/projects/[id]/page.tsx`, `ProjectDetailClient.tsx`, `app/api/projects/route.ts`, and `app/api/projects/[id]/route.ts` - parent display, manual create, and parent changes.
- `lib/projects/create.ts` and `lib/projects/validate.ts` - pure create/PATCH validators; preserve nullable UUID validation and reject dual parents.
- `lib/supabase/schema.ts` and `supabase/migrations/20261004082751_focus_profile_areas.sql` - `area_id` types, owner-matched foreign keys, and `project_has_one_direct_parent` already exist.
- `app/app/focus/page.tsx` - existing Area roll-ups query Goals by `area_id` and only standalone Projects; populated links will appear without changing this contract.
- Extend the existing validator, route, wizard, project input, and detail tests alongside their implementation; use `app/api/generate/route.test.ts` and `supabase/tests/` for persistence and database enforcement.

## Tasks & Acceptance

**Execution:**
- [x] `app/app/goals/new/page.tsx`, `GoalWizard.tsx`, `WizardStep4.tsx`, and their tests -- load active Area options and carry the optional selection through Goal creation; keep it out of AI prompt content.
- [x] `app/api/generate/route.ts` and `save_goal_breakdown` migration/test -- validate an optional Goal Area before provider use and persist it atomically with the Goal and generated Projects.
- [x] `app/app/goals/[id]/page.tsx`, `GoalDetailClient.tsx`, `app/api/goals/[id]/route.ts`, `lib/goals/validate.ts`, and their tests -- display/edit nullable Area assignment; validate UUID shape and owner before PATCH.
- [x] `app/app/projects/new/page.tsx`, `load-goals.ts`, `NewProjectClient.tsx`, `ProjectModeInput.tsx`, and their tests -- load active Areas and include an optional exclusive Area in manual and standalone AI creation payloads.
- [x] `app/api/projects/route.ts`, `app/api/generate/route.ts`, `lib/projects/create.ts`, and their tests -- validate Area ownership before insert or provider call; reject simultaneous Goal and direct Area parents. Do not reject a user-owned Area based on archive state.
- [x] `app/app/projects/[id]/page.tsx`, `ProjectDetailClient.tsx`, `app/api/projects/[id]/route.ts`, `lib/projects/validate.ts`, and their tests -- show inherited Area for Goal-linked Projects, offer direct Area editing only without a Goal, and clear `area_id` atomically when setting a Goal.
- [x] `AreaSelect`, the active-Area loader, and route/page tests -- omit archived Areas from new selectors, keep existing archived links visible and selected, and verify direct owned archived IDs remain accepted by routes.

**Acceptance Criteria:**
- Given Goal creation or editing, when an active Area or no Area is selected, then the owned Goal persists that optional association and Goal detail and Focus show it.
- Given manual or AI standalone Project creation, when an active Area or no Area is selected, then the Project saves with no parent Goal; a foreign Area is rejected, and AI validation occurs before provider use.
- Given a Goal-linked Project, when shown or edited, then its Area is derived from its Goal and no direct Area selector is offered.
- Given an Area-linked Project is assigned to a Goal, when the update succeeds, then `area_id` is cleared atomically and the Goal's Area is inherited.
- Given a project parent selector or Focus roll-up, when a Project has one direct parent, then its detail breadcrumb and Area roll-up identify the correct parent without duplicate links.
- Given an Area is archived, when a user starts or changes an assignment through the UI, then the Area is absent from selectable options; a direct request with that user's Area ID remains permitted, and existing associations remain visible and attached.
- Given a Goal or standalone Project is already linked to an archived Area, when its detail is displayed or edited, then that association remains visible and is preserved unless the user explicitly changes it.

## Implementation Notes

- Added an active-Area loader shared by Goal and Project creation. The shared selector keeps current archived links visible as disabled values but never lists archived Areas as new choices.
- Goal creation keeps Area assignment outside the AI inputs and persists it with the Goal and generated Projects through `save_goal_breakdown`; the migration preserves `SECURITY INVOKER` and grants execution only to `authenticated`.
- Goal and standalone Project routes validate Area UUID/ownership before writes; standalone AI flows do so before provider use. Direct owned archived IDs remain accepted by routes, as approved.
- Project Goal reassignment sends `goal_id` and `area_id: null` in one update. Goal-linked Project detail reads and displays the inherited Area; standalone Area breadcrumbs link to Focus.

## Spec Change Log

## Review Triage Log

- **medium / patch:** `ProjectDetailClient` originally derived the controlled Area selection only from server props, so a pending selection reverted until refresh and a failed save could leave stale UI. It now keeps the pending value and rolls back on failure; focused test covers both.
- **false:** Goal-to-Area roll-up coverage exists at both boundaries: the new pgTAP test verifies atomic generation persists `goals.area_id`, and the existing Focus page suite verifies Goals with an Area render in that Area's roll-up. No Focus-page implementation changed.
- **low / patch:** Goal detail page props for active/assigned Areas were not asserted. Added active and archived assigned-Area page cases and assertions that archived Areas are excluded from picker options.
- **low / patch:** Project parent reassignment lacked a test starting from a direct Area. Added route coverage proving `goal_id` and `area_id: null` are written together, plus client coverage for clearing stale local Area state.
- **low / patch:** Goal and Project detail clients lacked tests for explicitly clearing an existing Area. Added both null-PATCH interaction tests.
- **low / patch:** Archived-ID acceptance was not pinned for every API flow. Added owned archived fixtures across manual Project creation, Goal PATCH, Project PATCH, standalone AI Project generation, and Goal generation; selectors continue to omit archived options.
- **low / patch:** Goal PATCH Area ownership-query failures lacked coverage. Added a 500/no-update test.
- **low / patch:** Project PATCH Area ownership-query failures lacked coverage. Added a 500/no-update test.
- **low / patch:** AI Area ownership-query failures lacked coverage in both flows. Added tests proving neither provider nor save runs when the lookup fails.
- **low / patch:** Malformed Area IDs lacked pre-provider coverage for standalone AI Project and Goal generation. Added tests for both.
- **low / patch:** `save_goal_breakdown` generated argument types omitted `p_goal.area_id`; updated the typed function contract to match the migration and route payload.
- **low / patch:** Creation-page tests did not assert active options reached their clients. Added Goal and Project page-level forwarding tests.
- **low / patch:** Goal and Project detail clients lacked tests for clearing an Area. Recorded with the shared clear-flow finding above; both clients now assert `area_id: null`.

## Verification

**Commands:**
- `npx tsc --noEmit` -- passed.
- Focused Vitest suites covering Area selector/loaders, Goal/Project validators, routes, creation flows, and details -- passed (272 tests across 19 files).
- `npx --yes supabase@latest test db` -- passed (62 pgTAP assertions).
- `npm run lint` -- passed.
- `npm run build` -- passed.