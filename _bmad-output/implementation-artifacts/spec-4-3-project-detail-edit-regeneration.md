---
title: "Project Detail, Edit & Regeneration"
type: "feature"
created: "2026-09-28"
status: "done"
baseline_commit: "6f9fb7a517c02d7492878b4a5a8736c1acdd47c9"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail page (`/app/projects/[id]`) is read-only. A user cannot see the parent-goal breadcrumb or status, cannot edit the project's name/purpose/outcome, cannot change its status, and cannot regenerate a single project without disturbing the others.

**Approach:** Extend the project detail page with a parent-goal breadcrumb, a status badge, and collapsible Purpose / Successful Outcome sections. Add a client edit surface (name, purpose, successful outcome), a project status control, and a "Regenerate project" action guarded by a confirmation modal. Back these with a new authenticated `PATCH /api/projects/[id]` (edit + status) and `POST /api/projects/[id]/regenerate` that reuses the existing structured `generateProject` and replaces ONLY this project's AI content and its actions.

## Boundaries & Constraints

**Always:** All reads/writes go through the authenticated Supabase clients; RLS enforces ownership. Status changes persist one of the 4 project statuses (active/paused/completed/archived). Completing all actions must NOT auto-complete the project — completion is an explicit status change. Regeneration shows a confirmation modal before overwriting; on confirm it replaces only THIS project's `name`/`purpose`/`successful_outcome`/`planning_detail` and its `actions` (delete-then-insert), reusing the project's existing `planning_depth`; sibling projects are never touched. Reuse `StatusBadge` (4.1), the mutation-route pattern and dialog/focus approach (4.2), and `generateProject` (Epic 2). WCAG 2.1 AA on all new UI.

**Ask First:** Any schema/migration change. Changing the generation prompt or `generateProject` contract. Auto-completing a project from action state.

**Never:** No hard deletes of the project. No regeneration of other projects. No new server-side storage. Do not implement granular action management (add/edit/delete/reorder/tags) here — that is Story 4.4; 4.3 only replaces the action list wholesale via regeneration. No markdown.

## I/O & Edge-Case Matrix

| Scenario                   | Input / State                             | Expected Output / Behavior                                                                                         | Error Handling                                                 |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Load project               | Own project id                            | Detail renders: name, parent-goal breadcrumb, status badge, collapsible Purpose + Successful Outcome, actions list | N/A                                                            |
| Goal-less project          | `goal_id` null                            | Renders without a breadcrumb link (no crash)                                                                       | N/A                                                            |
| Missing/other-user project | Unknown/non-owned id                      | `notFound()` (404)                                                                                                 | Fail-closed                                                    |
| Edit save                  | Valid name/purpose/outcome                | PATCH persists; page reflects new values                                                                           | 400 invalid; 401 unauth; 404 non-owned; 500 db                 |
| Status change              | active/paused/completed/archived          | PATCH persists status; badge updates                                                                               | 400 unknown status                                             |
| Regenerate confirm         | User confirms                             | `generateProject` runs; project AI fields + actions replaced; siblings untouched                                   | 504 timeout; 500 generate/save; project left intact on failure |
| Regenerate cancel          | User dismisses modal                      | No mutation                                                                                                        | N/A                                                            |
| Regenerate save failure    | actions insert fails after project update | Return 500; do not leave the project without actions (restore prior actions or report failure)                     | 500                                                            |

</frozen-after-approval>

## Code Map

- `app/app/projects/[id]/page.tsx` -- EXTEND existing read-only page: also select `goal_id`, `status`; load parent goal text (for breadcrumb); render breadcrumb + `StatusBadge`; move Purpose/Successful Outcome into collapsibles; render the client edit/status/regenerate header. Keep the existing structured rendering.
- `app/app/projects/[id]/ProjectDetailClient.tsx` -- NEW client component: edit toggle (name/purpose/successful_outcome), `ProjectStatusSelect`, and "Regenerate project" with a confirmation modal (reuse the 4.2 dialog/focus pattern). Calls the routes; `router.refresh()` on success.
- `app/api/projects/[id]/route.ts` -- NEW `PATCH` (edit fields + status) mirroring `app/api/goals/[id]/route.ts`.
- `app/api/projects/[id]/regenerate/route.ts` -- NEW `POST`: auth guard; load the project (own) → 404; call `generateProject(input, project.planning_depth)` where input is the project name (+ purpose if present); update the project's AI fields; replace actions (delete existing, insert the new 12). Map errors with the same 504/500 shape as `/api/generate` (reuse or mirror `mapGenerateError`).
- `lib/projects/validate.ts` -- NEW pure validators: `isProjectStatus`, `sanitizeProjectPatch` (name 1–200, purpose/successful_outcome nullable strings, status). Unit-tested.
- `components/goals/ProjectStatusSelect.tsx` -- NEW small client control (4 project statuses); mirror `GoalStatusSelect`.
- `lib/supabase/schema.ts` -- import `Project`, `ProjectStatus`, `ProjectUpdate`, `ActionInsert`, `PlanningDetail` (read-only).
- `lib/projects/generate-project.ts` -- reuse `generateProject` (read-only).
- `app/api/generate/route.ts` -- reference for `mapGenerateError` shape (read-only).

## Tasks & Acceptance

**Execution:**

- [x] `lib/projects/validate.ts` -- add `isProjectStatus` + `sanitizeProjectPatch` pure validators -- server-side edit safety.
- [x] `app/api/projects/[id]/route.ts` -- add authenticated `PATCH` (edit + status) -- project mutation surface.
- [x] `app/api/projects/[id]/regenerate/route.ts` -- add authenticated `POST` reusing `generateProject`; update project AI fields + replace actions (only this project) -- regeneration surface.
- [x] `components/goals/ProjectStatusSelect.tsx` -- add accessible 4-status control -- reused by detail.
- [x] `app/app/projects/[id]/page.tsx` -- extend: breadcrumb, status badge, collapsible Purpose/Outcome, mount the client header -- read surface.
- [x] `app/app/projects/[id]/ProjectDetailClient.tsx` -- add edit/status/regenerate-with-confirmation wired to the routes -- interactive surface.
- [x] `lib/projects/validate.test.ts` -- unit-test the validator I/O matrix -- lock server safety.
- [x] `app/api/projects/[id]/route.test.ts`, `app/api/projects/[id]/regenerate/route.test.ts` -- test PATCH + regenerate (confirm success, siblings untouched, failure paths) with mocked Supabase + generateProject -- lock mutations.
- [x] `app/app/projects/[id]/page.test.tsx` -- extend/keep: breadcrumb + status render + notFound -- lock the read surface.
- [x] `app/app/projects/[id]/ProjectDetailClient.test.tsx` -- test edit save, status change, regenerate confirm/cancel -- lock interactivity.

**Acceptance Criteria:**

- Given a project detail view, when it renders, then it shows the project name, parent-goal breadcrumb, and status badge, with Purpose and Successful Outcome as collapsible sections.
- Given an AI-generated project, when I edit it, then I can change the name, purpose, and successful outcome (and the action list is replaced by regeneration).
- Given a project status, when I change it, then I can set active/paused/completed/archived, and completing all actions does not auto-complete the project.
- Given I trigger "Regenerate project", then a confirmation modal appears before overwriting, and on confirm only this project's AI content and actions are replaced — other projects in the goal are untouched.
- Given a nonexistent or non-owned project id, when the page loads or a mutation runs, then it 404s / writes nothing.

## Design Notes

Regeneration reuses `generateProject(input, depth)` (which owns prompt selection, provider call, 30s timeout, and JSON validation). Input is the project's own `name` (plus `purpose` when present) so the regenerated content stays about the same project. On success: `update` the project's `name`/`purpose`/`successful_outcome`/`planning_detail`, then replace actions by deleting the project's existing action rows and inserting the new 12 (sort_order = index). To avoid leaving a project with no actions on a partial failure, read the existing actions first; if the insert of new actions fails after delete, re-insert the saved originals and return 500. Scope every query to `id` + `user_id` (RLS also enforces).

Breadcrumb: select `goal_id`; when non-null, fetch the parent goal's `goal_text` and render a link to `/app/goals/[goal_id]`; when null (Project Mode), render just the project name with no crash.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `npm test -- --run lib/projects app/api/projects "app/app/projects/[id]"` -- expected: new validator/route/page/client tests pass.

## Suggested Review Order

**Regeneration (highest leverage / most risk)**

- Entry point — reuse `generateProject`, update project AI fields, replace actions (delete-then-insert) with best-effort restore.
  [`regenerate/route.ts:63`](../../app/api/projects/[id]/regenerate/route.ts#L63)

**Edit + status mutation**

- Authenticated project PATCH (edit + status), scoped by id + user_id.
  [`route.ts:33`](../../app/api/projects/[id]/route.ts#L33)
- Pure project-patch validation (name bounds, nullable purpose/outcome, 4 statuses).
  [`validate.ts:31`](../../lib/projects/validate.ts#L31)

**Read surface**

- Extended detail loader: project + parent-goal breadcrumb + actions; 404 on absent.
  [`page.tsx:50`](../../app/app/projects/[id]/page.tsx#L50)

**Interactive surface**

- Client header: edit toggle, status change, regenerate confirmation modal.
  [`ProjectDetailClient.tsx:37`](../../app/app/projects/[id]/ProjectDetailClient.tsx#L37)
- Accessible 4-status control.
  [`ProjectStatusSelect.tsx:27`](../../components/projects/ProjectStatusSelect.tsx#L27)

**Tests (peripheral)**

- Regenerate incl. timeout, partial-failure branches, and action restore.
  [`regenerate/route.test.ts:1`](../../app/api/projects/[id]/regenerate/route.test.ts#L1)
- Client interactions: edit save, status PATCH, regenerate confirm/cancel/timeout.
  [`ProjectDetailClient.test.tsx:1`](../../app/app/projects/[id]/ProjectDetailClient.test.tsx#L1)
