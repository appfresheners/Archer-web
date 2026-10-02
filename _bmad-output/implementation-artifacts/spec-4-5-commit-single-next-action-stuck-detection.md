---
title: "Commit a Single Next Action & Stuck Detection"
type: "feature"
created: "2026-09-28"
status: "done"
baseline_commit: "5940764a8d7b7cdb328039f22defc7dc7e58a49e"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The action list styles a committed state but has no way to commit an action, no enforcement of a single committed next action, no next-action prompt on completion, and the project detail page shows no stuck indicator. A user can't tell (or set) the one thing to do next.

**Approach:** Add a "Commit" affordance on available actions that PATCHes the action to `committed`; the `fn_commit_action` DB trigger decommits any prior committed action, so the single-committed rule is enforced at the database, not just the UI. When a committed action is completed, prompt the user to pick the next committed action from the project's remaining available actions. Surface an amber, `role="alert"` stuck indicator (Active project with zero committed actions) on the project detail page and reuse it wherever projects appear.

## Boundaries & Constraints

**Always:** Committing an available action sets its status to `committed`; rely on the `fn_commit_action` trigger to decommit siblings (do not reimplement decommit in the UI). All mutations are authenticated and RLS-scoped. Stuck = Active project with zero committed actions, computed via the existing `isProjectStuck` helper. The stuck indicator uses the warning tokens, `role="alert"`, the exact copy "No committed next action — this project is stuck." with a "Commit one now" affordance, and is never hidden. Completing a committed action marks it done and prompts selecting the next committed action from remaining available actions; if none remain, offer to mark the project complete. WCAG 2.1 AA on all new UI.

**Ask First:** Any schema/migration change (the `fn_commit_action` trigger already exists — do not alter it). Changing the committed/stuck copy or tokens.

**Never:** Do not reimplement single-committed enforcement in application code as the source of truth — the DB trigger is authoritative. No new server-side storage. No auto-committing. Do not hide or soften the stuck indicator.

## I/O & Edge-Case Matrix

| Scenario                        | Input / State                        | Expected Output / Behavior                                                                          | Error Handling                  |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------- |
| Commit available                | Available action                     | PATCH → `committed`; row shows committed treatment; prior committed becomes available (via trigger) | 400 invalid; 401; 404 non-owned |
| Commit already-committed        | Committed action                     | No commit affordance shown (or no-op)                                                               | N/A                             |
| Complete committed              | Committed action marked done         | Action → done; prompt to pick next committed from remaining available                               | N/A                             |
| Complete committed, none remain | Last available/committed done        | Prompt offers "mark project complete?"                                                              | N/A                             |
| Select next in prompt           | Choose an available action           | That action is committed (trigger decommits none — prior is already done)                           | 400/404                         |
| Stuck project                   | Active project, 0 committed          | Amber `role="alert"` band: "No committed next action — this project is stuck." + "Commit one now"   | N/A                             |
| Not stuck                       | Active w/ 1 committed, OR non-active | No stuck band                                                                                       | N/A                             |

</frozen-after-approval>

## Code Map

- `app/api/actions/[id]/commit/route.ts` -- NEW `POST`: auth guard; set the owned action's status to `committed` (`.eq(id).eq(user_id)`); the `fn_commit_action` BEFORE UPDATE trigger decommits siblings. 404 when not owned.
- `lib/actions/validate.ts` -- reuse; the generic action PATCH still rejects `committed` (commit has its own route). No change required unless the reviewer finds one.
- `components/projects/ActionItem.tsx` -- EDIT: add a "Commit" control shown only for `available` actions (calls `onCommit`); keep the committed visual state. Add an optional `onCommit` prop.
- `components/projects/ActionList.tsx` -- EDIT: add `handleCommit` (POST `/api/actions/[id]/commit`); when a committed action is toggled done, open a "next action" prompt listing remaining available actions (commit one) or, if none, offer "mark project complete?" (PATCH the project status via `/api/projects/[id]`). Pass `onCommit` to rows.
- `components/projects/StuckIndicator.tsx` -- NEW shared amber `role="alert"` band with the exact copy + a "Commit one now" affordance (link/scroll to the action list). Reused by the project detail page (and available to Engage in Epic 5).
- `app/app/projects/[id]/page.tsx` -- EDIT: compute `stuck` (Active + zero committed) from the loaded actions + project status and render `StuckIndicator` above the action list when stuck.
- `app/app/goals/[id]/page.tsx` -- OPTIONAL: the ProjectCards stuck band already exists (4.2); ensure it uses the shared `StuckIndicator` copy (align if trivial).
- `lib/goals/stuck.ts` -- reuse `isProjectStuck` (read-only).
- `app/api/actions/[id]/route.ts` -- reference for the per-action route shape (read-only).

## Tasks & Acceptance

**Execution:**

- [x] `app/api/actions/[id]/commit/route.ts` -- add authenticated `POST` that sets the action to `committed` (trigger decommits siblings) -- the commit surface.
- [x] `components/projects/StuckIndicator.tsx` -- add the shared amber alert band (exact copy + "Commit one now") -- one reusable indicator.
- [x] `components/projects/ActionItem.tsx` -- add a Commit control for available actions (`onCommit`) -- commit affordance.
- [x] `components/projects/ActionList.tsx` -- add commit wiring + the complete-committed → next-action prompt (and "mark project complete?" when none remain) -- the flow.
- [x] `app/app/projects/[id]/page.tsx` -- compute stuck and render `StuckIndicator` when Active + zero committed -- surface stuck.
- [x] `app/api/actions/[id]/commit/route.test.ts` -- test commit (200 owned, 401, 404 non-owned) with mocked Supabase -- lock the commit route.
- [x] `components/projects/StuckIndicator.test.tsx` -- test copy, role="alert", and CTA -- lock the indicator.
- [x] `components/projects/ActionList.test.tsx` -- extend: commit posts to the commit route; completing a committed action opens the next-action prompt; committing from the prompt posts commit -- lock the flow.
- [x] `app/app/projects/[id]/page.test.tsx` -- extend: stuck band shows for Active + zero committed; hidden otherwise -- lock the surface.

**Acceptance Criteria:**

- Given an available action, when I commit it, then it becomes the project's committed action and any previously committed action on that project is decommitted, enforced by the `fn_commit_action` database trigger (not only the UI).
- Given I complete a committed action, when I mark it done, then I am prompted to select the next committed action from the project's remaining available actions.
- Given a project that is Active with zero committed actions, when it is rendered, then it shows the amber stuck indicator ("No committed next action — this project is stuck." + "Commit one now") using `role="alert"`, never hidden.
- Given a project that is not Active, or has a committed action, when rendered, then no stuck indicator appears.

## Design Notes

Commit is a dedicated `POST /api/actions/[id]/commit` (not the generic PATCH, which deliberately rejects `committed`). It simply updates status to `committed`; the DB trigger `fn_commit_action` decommits any other committed action on the same project, so the single-committed invariant holds even outside the UI. This keeps 4.4's plain available↔done toggle semantics intact.

Next-action prompt: `ActionList` tracks a "just completed a committed action" state. On completing a committed action (checkbox on a `committed` row), it marks it done, then shows an inline prompt listing the project's still-`available` actions; choosing one commits it. If no available actions remain, the prompt offers "Mark project complete?" which PATCHes the project to `completed` via the existing `/api/projects/[id]` route.

StuckIndicator is presentational: amber warning band, `role="alert"`, exact copy, and a "Commit one now" button/link. The project detail page computes `stuck = isProjectStuck({status}, actions)` from already-loaded data — no extra query.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `npm test -- --run app/api/actions components/projects "app/app/projects/[id]"` -- expected: new commit/indicator/flow tests pass.

## Suggested Review Order

**Commit (DB-trigger-backed invariant)**

- Entry point — dedicated commit route; sets status=committed, trigger decommits siblings.
  [`commit/route.ts:33`](../../app/api/actions/[id]/commit/route.ts#L33)

**Stuck surfacing**

- Shared amber alert band (exact copy + CTA), reused across surfaces.
  [`StuckIndicator.tsx:26`](../../components/projects/StuckIndicator.tsx#L26)
- Project detail computes stuck (Active + zero committed) and renders the band.
  [`page.tsx:160`](../../app/app/projects/[id]/page.tsx#L160)

**Commit + next-action flow**

- Commit wiring + complete-committed → next-action prompt (focus/Escape) → commit-next or mark-complete.
  [`ActionList.tsx:87`](../../components/projects/ActionList.tsx#L87)
- Commit affordance on available actions.
  [`ActionItem.tsx:57`](../../components/projects/ActionItem.tsx#L57)

**Tests (peripheral)**

- Commit route auth/ownership + status transition.
  [`commit/route.test.ts:1`](../../app/api/actions/[id]/commit/route.test.ts#L1)
- Commit, next-action prompt, mark-complete, dismiss, and stuck-skip flows.
  [`ActionList.test.tsx:1`](../../components/projects/ActionList.test.tsx#L1)
- Stuck band shown/hidden across project statuses.
  [`page.test.tsx:1`](../../app/app/projects/[id]/page.test.tsx#L1)
