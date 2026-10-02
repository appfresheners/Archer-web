---
title: "Engage View — Committed Actions & Next-Action Prompting"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "6432aa3d10ca3a24f39157199f62e4625d442245"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/app/engage` is a placeholder `<h1>`. A signed-in user has no single "what do I do now" surface — the committed next actions committed in Epic 4 / clarified in 5.2 are scattered across project detail pages.

**Approach:** Build the Engage view: a read-only-first server page that loads only **committed** next actions across **active, non-paused** goals/projects, groups them by goal in collapsible groups, and renders each row (action text, context-tag chips, parent project name, Done). Completing an action prompts "What's next for [project]?" (reusing the Epic 4 next-action-prompt pattern). Stuck active projects (zero committed) surface at the bottom of their goal group with the amber `StuckIndicator`. Standalone committed/available actions (from 5.2) appear under an "Anytime / No project" group. An optional context-tag filter narrows the list. Honest empty state, no confetti.

## Boundaries & Constraints

**Always:**

- Show ONLY `committed` next actions in the main lists — never the full action list, a Kanban board, or a project tree.
- Scope to `active` goals and `active` projects (a `paused`/`someday`/`not_now`/`completed`/`archived` goal or `paused`/`completed`/`archived` project is excluded).
- Group by goal; each committed row shows: action text, context-tag chips (if present, reuse the chip styling from `ActionItem`), the parent project name, and a Done button.
- Completing (Done) marks the action `done` then prompts "What's next for [project]?" with the remaining `available` actions of THAT project to commit; if none remain, offer "mark project complete?". Reuse the exact prompt idiom from `components/projects/ActionList.tsx` (the `nextPrompt` modal + `handleCommitNext`/`handleCompleteProject`).
- Commit uses the existing `POST /api/actions/[id]/commit`; complete/done uses `PATCH /api/actions/[id]` (status), project-complete uses `PATCH /api/projects/[id]`. Do NOT add new mutation routes — all exist.
- Stuck projects (`isProjectStuck` from `lib/goals/stuck.ts`: active + zero committed) appear at the BOTTOM of their goal group with the amber `StuckIndicator` band and a "Commit one →" affordance that links to the project detail (`/app/projects/[id]#actions`).
- **Standalone actions (project_id = null, from Story 5.2):** committed standalone actions render under a final "Anytime / No project" group. EXCLUDE `waiting` actions and actions whose `scheduled_for` is a FUTURE date from the do-now lists (they are not "do now"). A standalone committed action has no project, so its Done does not trigger a per-project next-action prompt (there is no project to prompt for) — just mark it done and refresh.
- Optional filter bar: filter the visible committed rows by a chosen context tag (@energy / @location / @tool families). Filtering is client-side over already-loaded rows.
- The page degrades to a safe state on read failure (mirror the goals-list `loadGoals` try/catch → empty).

**Ask First:**

- Any new mutation endpoint (none should be needed).
- Any schema change (none needed — 5.2's migration already added the fields).

**Never:**

- No confetti/celebration anywhere, including the empty state.
- Do NOT show available (uncommitted) actions in the main list — only committed. (Available actions appear only inside the "what's next" prompt and the stuck CTA.)
- Do NOT build the weekly review or monthly check here.
- Do NOT re-implement stuck detection — reuse `lib/goals/stuck.ts`.

## I/O & Edge-Case Matrix

| Scenario                           | Input / State                                | Expected Output / Behavior                                                              | Error Handling                                                 |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Render committed actions           | active goals/projects with committed actions | grouped by goal; each row: text, tag chips, project name, Done                          | read fail → empty state                                        |
| Complete an action (project)       | click Done on a project-committed row        | PATCH status=done; prompt "What's next for [project]?" with remaining available actions | 500 → inline error                                             |
| Commit next from prompt            | pick an action in the prompt                 | POST /commit; refresh                                                                   | 404/500 → inline error                                         |
| No actions remain                  | complete the last available action           | prompt offers "mark project complete?"                                                  | 500 → inline error                                             |
| Complete a standalone action       | Done on an "Anytime" row (project_id null)   | PATCH status=done; NO project prompt; refresh                                           | 500 → inline error                                             |
| Stuck project in a goal group      | active project, zero committed               | amber StuckIndicator at bottom of the goal group + "Commit one →" to project detail     | N/A                                                            |
| Context filter                     | choose @location:home                        | only rows with a matching tag remain visible                                            | empty filtered set → "No committed actions match this filter." |
| Exclude waiting / future scheduled | standalone waiting or future scheduled_for   | NOT shown in the do-now lists                                                           | N/A                                                            |
| Empty (all caught up)              | no committed actions anywhere                | "No committed actions. Open a project and commit one." — no confetti                    | N/A                                                            |

</frozen-after-approval>

## Code Map

- `app/app/engage/page.tsx` -- REPLACE the placeholder. NEW server component: load active goals; their active projects; the projects' actions (committed for display + available for the prompt + stuck detection); standalone actions (project_id null). Build a view model grouped by goal (+ "Anytime / No project" group + per-goal stuck projects). Mirror the `loadGoals` try/catch→[] + in-memory grouping idiom from `app/app/goals/page.tsx`. Keep `metadata`.
- `app/app/goals/page.tsx` -- REFERENCE loader/grouping pattern (goals + projects + actions in parallel, group in Maps, `countStuckProjects`).
- `lib/goals/stuck.ts` -- REUSE `isProjectStuck` for the per-goal-group stuck list. Do not reimplement.
- `lib/engage/model.ts` -- NEW pure builder `buildEngageModel(goals, projects, actions)` → `{ goalGroups: [{ goal, committed: Row[], stuckProjects: [] }], anytime: Row[], isEmpty }`. Applies the filters (committed-only, active-only, exclude waiting/future-scheduled, standalone→anytime). Pure + unit-tested for the matrix rows.
- `components/engage/EngageBoard.tsx` -- NEW `"use client"`. Renders the collapsible goal groups, the "Anytime / No project" group, the optional context-tag filter bar, and the empty state. Owns the Done→prompt→commit/complete flow (adapt `ActionList`'s `nextPrompt` modal + `handleToggleDone`/`handleCommitNext`/`handleCompleteProject`, but here Done is on a committed row and the prompt lists the SAME project's remaining available actions passed in the model). `router.refresh()` after mutations. Inline `role="alert"` errors.
- `components/engage/EngageActionRow.tsx` -- NEW `"use client"` (or a subcomponent of EngageBoard). One committed row: text, tag chips (reuse `ActionItem`'s chip markup: `rounded-[var(--radius-xs)] bg-surface px-2 py-0.5 text-[length:var(--font-size-caption)] text-text-secondary`), parent project name, Done button (min-h-44).
- `components/projects/ActionList.tsx` -- REFERENCE for the next-action prompt modal (`nextPrompt` dialog, "What's next for this project?", "mark project complete?") and the `call()`+`router.refresh()` mutation idiom to adapt.
- `components/projects/StuckIndicator.tsx` -- REUSE for the stuck-project band. `onCommitNow` optional; here use the anchor fallback to `/app/projects/[id]#actions` (or pass a handler that routes there).
- `app/api/actions/[id]/commit/route.ts` -- REUSE (commit). `app/api/actions/[id]/route.ts` PATCH -- REUSE (status done). `app/api/projects/[id]/route.ts` PATCH -- REUSE (status completed). No changes.
- `lib/supabase/schema.ts` -- types: `Action` now has nullable `project_id`, `status` incl. `waiting`, `scheduled_for`. Use these.

## Tasks & Acceptance

**Execution:**

- [x] `lib/engage/model.ts` (+ `.test.ts`) -- `buildEngageModel`: filter to committed + active goal/project for the grouped lists; per-goal stuck projects via `isProjectStuck`; standalone committed → "Anytime" group; EXCLUDE `waiting` and future `scheduled_for`; `isEmpty` when no committed rows and no stuck projects. Unit-test every matrix row (grouping, stuck placement, anytime, exclusions, empty).
- [x] `app/app/engage/page.tsx` -- REPLACE placeholder with a server component that loads goals/projects/actions + standalone actions (RLS-scoped, try/catch→safe empty), calls `buildEngageModel`, renders `EngageBoard`. Keep `metadata`.
- [x] `components/engage/EngageBoard.tsx` (+ `.test.tsx`) -- collapsible goal groups; committed rows; per-goal stuck band (StuckIndicator); "Anytime / No project" group; optional context-tag filter bar (client-side over loaded rows); empty state "No committed actions. Open a project and commit one." (no confetti); Done→prompt→commit/complete via existing routes + `router.refresh()`; inline `role="alert"` errors. Standalone Done: mark done + refresh, no prompt. Test: renders grouped committed rows, filter narrows, stuck band shows, Done fires PATCH + shows prompt, commit-next fires /commit, standalone Done fires PATCH with no prompt, empty state copy.
- [x] `components/engage/EngageActionRow.tsx` -- committed row markup (text, tag chips, project name, Done). (May be inlined in EngageBoard; if so, drop this file.)
- [x] `components/projects/StuckIndicator.tsx` -- reuse as-is; if a route-to-detail handler is cleaner than the `#actions` anchor, pass `onCommitNow`. No behavior change to existing callers.

**Acceptance Criteria:**

- Given the Engage view, when it renders, then it shows only committed next actions across active non-paused goals/projects, grouped by goal, each row showing action text, context-tag chips (if present), the parent project name, and a Done button — and never the full action list, a Kanban, or a project tree.
- Given I click Done on a project action, when it succeeds, then the action is marked done and I am prompted "What's next for [project]?" with the project's remaining available actions to commit; if none remain, I'm offered "mark project complete?".
- Given context tags exist, when I use the filter bar, then only rows with a matching @energy/@location/@tool tag remain visible.
- Given an active project with zero committed actions, when its goal group renders, then the stuck project appears at the bottom of the group with an amber band and a "Commit one →" CTA to the project.
- Given a standalone committed action (no project), when it renders, then it appears under "Anytime / No project"; and waiting or future-scheduled actions do NOT appear in the do-now lists.
- Given everything is caught up, when Engage renders, then it shows "No committed actions. Open a project and commit one." with no celebration or confetti.

## Spec Change Log

### 2026-09-28 — review loop (patch, no re-derivation)

- **Triggering findings:** (1) A stale context-tag filter could strand the user on a "No committed actions match this filter." dead-end after a refresh removed the filtered tag. (2) `handleDone`/`handleCommitNext`/`handleCompleteProject` guarded double-submit only via the `disabled` attribute, not a function-entry `busy` check. (3) The Engage server-component loader (`app/app/engage/page.tsx`) had no executed test, unlike its three sibling loader pages — its parallel fetch shape, `?? []` coalescing, and try/catch→empty degradation were unverified.
- **Amended (code patches):** Added a lint-safe render-time reconcile that clears `activeTag` when it is no longer present in the loaded rows (auto-recover instead of dead-end); this made the `filteredEmpty` "No match" branch unreachable, so it was removed as dead code and its test rewritten to assert the auto-clear behavior. Added `if (busy) return;` guards at the entry of the three mutation handlers. Added `app/app/engage/page.test.tsx` (mirrors goals/page.test.tsx): empty state, read-error→empty-state (no throw), and loaded-rows→grouped-board flow.
- **Known-bad state avoided:** A filter dead-end requiring a manual "All" click; double-mutation from rapid/programmatic clicks; an unverified loader whose fetch shape / error-degradation / date cutoff could regress with the suite green.
- **KEEP:** The pure `buildEngageModel` (committed-only, active-only, standalone→anytime, waiting/future exclusion, `today` injected) and the ActionList-derived Done→prompt→commit/complete flow. Timezone-correct `today`, prompt focus-restore/trap, and collapse-persistence are intentionally DEFERRED (ledgered), not fixed here.

## Design Notes

**All work is a view over existing data + existing mutations.** No new routes, no schema change. The only genuinely new logic is `buildEngageModel` (pure, testable) and the board's interaction wiring, which is a near-clone of `ActionList`'s Done→prompt→commit flow — the key difference is the prompt lists a specific project's remaining `available` actions carried in the model, rather than filtering local props.

**Standalone Done semantics.** A standalone committed action has no project, so completing it cannot prompt a project's next action. Mark it `done` and `router.refresh()`. (A future story may add a global "what's next" for standalone actions; out of scope here.)

**Filter families.** Context tags look like `@energy:high`, `@location:home`, `@tool:laptop` (see ActionItem/ContextTagEditor). The filter bar offers the distinct tag values present in the loaded committed rows; selecting one keeps rows whose `context_tags` include it. Keep it simple — a set of toggle chips derived from the data, client-side only.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: clean.
- `npm run lint` -- expected: clean (watch react-hooks/set-state-in-effect + purity in EngageBoard).
- `npm test -- --run` -- expected: ALL new tests pass and are executed — `buildEngageModel` unit tests (every matrix row) and the `EngageBoard` component test (grouping, filter, stuck band, Done→prompt→commit, standalone Done, empty state). Each I/O matrix row covered by an executed test.
- `npm run build` -- expected: succeeds; `/app/engage` renders the board.

**Manual checks:**

- With committed actions across two active goals, Engage groups them; completing one prompts the next; a stuck project shows the amber band; the filter narrows rows; clearing everything shows the honest empty state.

## Suggested Review Order

**The view model (highest leverage)**

- Entry point: the pure builder — committed-only, active-only, standalone→anytime, waiting/future excluded.
  [`model.ts:150`](../../lib/engage/model.ts#L150)

- The do-now predicate (waiting + future-scheduled exclusion) and stuck reuse.
  [`model.ts:118`](../../lib/engage/model.ts#L118)

**The board (interaction)**

- Done→prompt→commit/complete flow + busy guards + stale-filter reconcile.
  [`EngageBoard.tsx:107`](../../components/engage/EngageBoard.tsx#L107)

- Server loader: parallel RLS reads → buildEngageModel; degrades to empty.
  [`page.tsx:53`](../../app/app/engage/page.tsx#L53)

- Committed row (text, tag chips, project name, Done).
  [`EngageActionRow.tsx:1`](../../components/engage/EngageActionRow.tsx#L1)

**Tests (supporting)**

- Model matrix rows (grouping, exclusions, stuck, anytime, empty).
  [`model.test.ts:1`](../../lib/engage/model.test.ts#L1)

- Board: Done→prompt→commit, standalone Done, filter, stale-filter clear, empty.
  [`EngageBoard.test.tsx:1`](../../components/engage/EngageBoard.test.tsx#L1)

- Loader: empty, read-error→empty, rows→grouped output.
  [`page.test.tsx:1`](../../app/app/engage/page.test.tsx#L1)
