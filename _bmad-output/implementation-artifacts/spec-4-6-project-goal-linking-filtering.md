---
title: "Project-Goal Linking and Project Filtering"
type: "feature"
created: "2026-10-01"
status: "ready-for-dev"
review_loop_iteration: 0
context:
  - "Deferred-work item from Story 5.2: expose goal-project linking from both goal and project detail."
---

<frozen-after-approval reason="human-approved course correction">

## Intent

**Problem:** Story 5.2 added `goal_id` mutation support, but users cannot manage the relationship from project/goal detail, and the Projects index cannot filter by goal.

**Approach:** Add a parent-goal selector to project detail, an attach-existing-project control to goal detail, and an All/goal/No goal filter to `/app/projects`. A project has one optional parent goal; moving it changes that association and never duplicates the project. This story resolves the corresponding deferred-work ledger item.

## Boundaries & Constraints

**Always:** Reuse the authenticated `PATCH /api/projects/[id]` route and the existing nullable `projects.goal_id`; no migration. Verify a supplied goal belongs to the acting user before updating, because RLS on the project row alone does not protect the referenced goal's ownership. Goal detail may attach only a project owned by the acting user. Moving a project from another goal requires confirmation. Keep project and goal RLS scoping and existing status/stuck behavior.

**Ask First:** Any schema/migration change, allowing multiple parent goals, or changing goal deletion semantics.

**Never:** Duplicate project rows to attach; allow cross-user links; alter action ownership or archive behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
| --- | --- | --- | --- |
| Change goal | Own project and own goal | PATCH updates `goal_id`; breadcrumb refreshes | 400 invalid; 404 missing/non-owned project or goal |
| Clear goal | Own project, `goal_id = null` | Project becomes goal-less | N/A |
| Attach unlinked project | Own goal and goal-less project | Project appears in goal's project list | 404/400 for non-owned records |
| Move between goals | Project linked to another goal | Confirm, then update its single `goal_id` | Cancel performs no write |
| Filter by goal | Goal UUID selected | List shows only projects linked to it | Invalid filter falls back to All or returns validation state |
| Filter no goal | `goal = none` | List shows projects with null `goal_id` | N/A |
| Filter all | Missing/`all` query parameter | Preserve current all-projects view | N/A |

## Code Map

- `app/app/projects/page.tsx` -- load projects with goal names/IDs and implement URL-backed filter options.
- `app/app/projects/[id]/page.tsx` -- load the user's goals and pass them to the project detail client.
- `app/app/projects/[id]/ProjectDetailClient.tsx` -- add parent-goal selector, clear option, and save/error states.
- `app/app/goals/[id]/page.tsx` -- load eligible owned projects and render attach-existing control.
- Goal detail client/component -- submit attach/move through the authenticated project PATCH; confirm moves.
- `app/api/projects/[id]/route.ts` -- verify any non-null `goal_id` belongs to the authenticated user before update.
- Related page/component/route tests -- cover filters, link/move/clear, and foreign-goal rejection.

## Acceptance Criteria

- Given a project detail view, when I select a goal or "No goal", then the single parent-goal association is saved and the breadcrumb reflects the new state.
- Given a goal detail view, when I attach an existing project, then the existing project is linked and appears in that goal's project list.
- Given a project linked to another goal, when I attach it to a different goal, then I must confirm the move; cancelling leaves its prior relationship unchanged.
- Given a crafted request containing another user's goal ID, when PATCH is called, then the route rejects it and writes nothing.
- Given the Projects index, when I choose All projects, a specific goal, or No goal, then the visible project set matches that filter and the selection is URL-backed.
- Given project status/actions, when these relationship controls are used, then status, action ordering, and stuck detection remain unchanged.

## Verification

- Extend project PATCH route tests for owned goal, foreign goal, clear, and missing goal.
- Test project detail selector, goal detail attach/move/cancel, and Projects index filters.
- Run `npx tsc --noEmit`, `npm run lint`, focused project/goal tests, and `npm run build`.
