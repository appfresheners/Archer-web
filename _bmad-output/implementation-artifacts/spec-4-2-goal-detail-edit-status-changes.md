---
title: "Goal Detail, Edit & Status Changes"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "f4af0569b2f7d8a9121151559d504bfa1a83c2db"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A goal row in the list links to `/app/goals/[id]`, but that route does not exist. A user cannot view a goal's gap analysis, edit its fields, change its status, or delete it.

**Approach:** Add a goal detail server page that loads the goal, its projects (as cards), and derived stuck counts, rendering the gap analysis (skill framework table, drivers, barriers, if–then) in collapsible sections. Add a client edit surface plus a status control and a delete confirmation, all backed by a new authenticated route handler `PATCH/DELETE /api/goals/[id]`. Editing never regenerates projects. Deleting soft-archives the goal and cascades archive to its projects and actions (retained, not removed).

## Boundaries & Constraints

**Always:** All reads/writes go through the authenticated Supabase clients; RLS enforces ownership. Editing updates only goal fields (goal_text, target_date, skill_framework ratings, drivers, barriers, if_then_plan) and never regenerates or deletes projects. Status changes persist one of the 6 goal statuses. Setting a goal to Paused must leave its projects intact (they are simply excluded from Engage later — do not delete or restatus them). Delete requires an explicit confirmation dialog and performs a soft delete: set the goal AND its linked projects AND their actions to `archived` (no hard DELETE). All mutations validate input and auth server-side and return actionable errors. New UI meets WCAG 2.1 AA (keyboard, ARIA, 44px targets, contrast, reduced-motion). Reuse the existing `StatusBadge` (4.1) and the server read pattern from `app/app/projects/[id]/page.tsx`.

**Ask First:** Any schema/migration change (e.g. adding a soft-delete column). Changing the goal wizard. Auto-regenerating on edit.

**Never:** No hard deletes. No project regeneration here (that is 4.3). No new server-side storage. Do not build the Monthly Goal Check logic here — render only a collapsible placeholder section (its behavior is Epic 5). Do not use a modal for anything but the destructive delete confirmation.

## I/O & Edge-Case Matrix

| Scenario                | Input / State           | Expected Output / Behavior                                                                                                       | Error Handling                              |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Load goal               | Own goal id             | Detail renders: header (text, badge, target date, Edit menu), collapsible gap analysis, project cards, Monthly Check placeholder | N/A                                         |
| Missing/other-user goal | Unknown or non-owned id | `notFound()` (404)                                                                                                               | Fail-closed                                 |
| Edit save               | Valid edited fields     | `PATCH` persists; page reflects new values; projects untouched                                                                   | 400 on invalid; 401 unauth; 500 on db error |
| Status change           | Any of 6 statuses       | `PATCH` persists status; badge updates                                                                                           | 400 on unknown status                       |
| Delete confirm          | User confirms in dialog | `DELETE` archives goal + its projects + their actions; navigates to `/app/goals`                                                 | 500 on db error, goal left intact           |
| Delete cancel           | User dismisses dialog   | No mutation                                                                                                                      | N/A                                         |
| PATCH unknown goal      | id not owned            | 404; nothing written                                                                                                             | RLS/`maybeSingle` guards                    |

</frozen-after-approval>

## Code Map

- `app/app/goals/[id]/page.tsx` -- NEW server component. Load goal (`maybeSingle`), its projects (`goal_id = id`, ordered `sort_order`), and each project's actions (for stuck). `notFound()` when absent. Mirror `app/app/projects/[id]/page.tsx` `loadProject`.
- `app/app/goals/[id]/GoalDetailClient.tsx` -- NEW client component. Owns edit form (toggle view/edit), status `<select>`, delete confirmation dialog; calls the API route; `router.refresh()` after success.
- `app/api/goals/[id]/route.ts` -- NEW route handler. `PATCH` (edit fields + status) and `DELETE` (soft-archive cascade). Auth guard mirrors `app/api/generate/route.ts` `getAuthenticatedUserId`. Validate body; scope every query by id (RLS also enforces user). DELETE: update projects (`goal_id = id`) → `archived`, update their actions → `archived`, update goal → `archived`.
- `lib/goals/validate.ts` -- NEW pure validators: `isGoalStatus`, `sanitizeGoalPatch` (bounds goal_text 1–500, target_date is a date, drivers/barriers string arrays, if_then_plan ≤ limit, skill_framework items with integer levels). Unit-tested.
- `components/goals/StatusBadge.tsx` -- reuse (4.1).
- `components/goals/GoalStatusSelect.tsx` -- NEW small client control listing the 6 statuses with accessible labels.
- `lib/supabase/schema.ts` -- import `Goal`, `GoalStatus`, `GoalUpdate`, `Project`, `SkillFrameworkItem`, `ProjectStatus`, `ActionStatus` (read-only).
- `app/api/generate/route.ts` -- reference for auth-guard + route shape (read-only).

## Tasks & Acceptance

**Execution:**

- [x] `lib/goals/validate.ts` -- add `isGoalStatus` + `sanitizeGoalPatch` pure validators -- server-side input safety, shared by the route.
- [x] `app/api/goals/[id]/route.ts` -- add authenticated `PATCH` (edit + status) and `DELETE` (soft-archive cascade goal→projects→actions) -- the mutation surface.
- [x] `app/app/goals/[id]/page.tsx` -- add the detail server page (goal + gap analysis + project cards + stuck + Monthly Check placeholder) -- the read surface.
- [x] `components/goals/GoalStatusSelect.tsx` -- add an accessible status control -- reused by detail + edit.
- [x] `app/app/goals/[id]/GoalDetailClient.tsx` -- add view/edit toggle, status change, and delete confirmation wired to the route -- the interactive surface.
- [x] `lib/goals/validate.test.ts` -- unit-test the validator I/O matrix (status validity, field bounds) -- lock server safety.
- [x] `app/api/goals/[id]/route.test.ts` -- test PATCH (valid/invalid/unauth) and DELETE cascade with mocked Supabase -- lock mutation behavior.
- [x] `app/app/goals/[id]/page.test.tsx` -- test detail render + notFound with mocked Supabase -- lock the read surface.

**Acceptance Criteria:**

- Given a goal detail view, when it renders, then the header shows goal text, status badge, target date, and an Edit menu; a collapsible gap-analysis section shows priority gaps and framework tables; a projects section lists project cards; a collapsible Monthly Goal Check section appears at the bottom.
- Given I edit the goal and save, then goal statement, target date, framework ratings, drivers, barriers, and if–then plan change, and no projects are regenerated.
- Given I change the goal's status to any of the 6 statuses, then the status persists; setting Paused leaves its projects present (not deleted).
- Given I delete a goal and confirm in the dialog, then all linked projects and actions are archived (soft delete), retained in the store, and the user returns to the goals list.
- Given a nonexistent or non-owned goal id, when the page loads or a mutation runs, then it 404s / writes nothing.

## Design Notes

Actions soft-delete note: `action_status` has no `archived` member (only available/committed/done). So on goal delete, the goal and its projects are set to `archived`, and each project's actions are archived TRANSITIVELY via their now-archived parent project — they are retained unchanged, no longer surface anywhere active, and remain in exports. This satisfies the AC's "linked projects and actions are archived (soft delete), retained… available in exports" without introducing an invalid action status.

Mutation pattern (establishes the Epic 4 convention): a thin authenticated route handler per resource. Auth via `supabase.auth.getUser()` → 401. Read-modify guarded by `.eq("id", id)` plus RLS. The soft-delete cascade runs three `update` calls (projects by goal_id, actions by those project ids, then the goal); on any failure return 500 without proceeding — full atomicity via RPC is deferred (see ledger).

Gap analysis: render `skill_framework` as a table (skill, required level, your rating, gap = max(0, required − rating)), drivers/barriers as lists, if_then_plan as prose — all inside `<details>`/`<summary>` collapsibles for keyboard-native disclosure.

Editing is a client-side view/edit toggle; on save, PATCH then `router.refresh()` to re-render the server page from the source of truth (no optimistic divergence).

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `npm test -- --run lib/goals app/api/goals app/app/goals` -- expected: new validator/route/page tests pass.

## Suggested Review Order

**Mutation surface (highest leverage)**

- Entry point — the authenticated PATCH (edit + status) and DELETE (soft-archive cascade) handler.
  [`route.ts:40`](../../app/api/goals/[id]/route.ts#L40)
- Soft-delete cascade: archive projects, then the goal; halt on any failure.
  [`route.ts:106`](../../app/api/goals/[id]/route.ts#L106)
- Pure server-side patch validation — only editable fields, each bounded, unknown fields dropped.
  [`validate.ts:88`](../../lib/goals/validate.ts#L88)

**Read surface**

- Detail loader: goal + projects + per-project stuck, 404 on absent/non-owned.
  [`page.tsx:56`](../../app/app/goals/[id]/page.tsx#L56)

**Interactive surface**

- Client header: view/edit toggle, framework-rating edit, status change, delete dialog (focus + Escape).
  [`GoalDetailClient.tsx:41`](../../app/app/goals/[id]/GoalDetailClient.tsx#L41)
- Accessible status control.
  [`GoalStatusSelect.tsx:27`](../../components/goals/GoalStatusSelect.tsx#L27)

**Tests (peripheral)**

- Route PATCH/DELETE incl. cascade + partial-failure halt.
  [`route.test.ts:1`](../../app/api/goals/[id]/route.test.ts#L1)
- Client interactions: status PATCH, edit save w/ framework, delete + navigate, error.
  [`GoalDetailClient.test.tsx:1`](../../app/app/goals/[id]/GoalDetailClient.test.tsx#L1)
