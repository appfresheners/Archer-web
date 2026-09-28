---
title: "Goals List & Status Badges"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "24fd5bd745f0cf84028de687d45cef9dc5a01d5b"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/app/goals` is a bare placeholder. A signed-in user has no way to see all their goals, their statuses, or which goals have stuck projects, and no entry point to start a new goal.

**Approach:** Replace the placeholder with a server-rendered goals list that loads the user's goals (RLS-scoped), sorts them Active-first, and renders one row per goal with goal text, a reusable status badge, target date, project count, an inline amber stuck count, and a chevron. Add a shared `StatusBadge` component and a shared stuck-detection helper (both consumed by later Epic 4 stories). Show a plain empty state that links to the wizard, and a "New goal" control that opens the wizard.

## Boundaries & Constraints

**Always:** Read goals/projects/actions only through the authenticated server Supabase client (RLS enforces ownership). Use the existing `--color-status-*` and `--color-warning*` design tokens — do not hardcode hex. Stuck = a project that is `active` with zero `committed` actions; compute in app code. Sort order: Active first (created_at desc), then Paused, then Not now, then Someday, then Completed, then Archived. Meet WCAG 2.1 AA: 44×44px touch targets, keyboard operable, visible focus ring, 4.5:1 contrast. New goal + empty-state controls route to the existing goal wizard at `/app/goals/new`.

**Ask First:** Adding any new DB column, migration, or RPC. Changing the goal wizard route or the nav.

**Never:** No client-side data fetching for the list (server component). No markdown. No new server-side storage. Do not build goal detail/edit here (that is 4.2) — the row chevron links to `/app/goals/[id]` which 4.2 fills in. Do not add celebratory UI (streaks, progress bars, confetti).

## I/O & Edge-Case Matrix

| Scenario                 | Input / State                                       | Expected Output / Behavior                                                                                                                         | Error Handling      |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Has goals                | User owns goals across statuses                     | Rows sorted Active-first; each shows text (2-line clamp), status badge, target date, project count, chevron                                        | N/A                 |
| Goal with stuck projects | Goal has ≥1 active project with 0 committed actions | Row shows inline amber "N stuck" count                                                                                                             | N/A                 |
| No goals                 | User owns zero goals                                | Empty state: "No goals yet. Start one." + control opening the wizard                                                                               | N/A                 |
| Query error              | Supabase read fails                                 | Render empty list gracefully (treat as no goals); never crash the page                                                                             | Catch; log; degrade |
| Status badge             | Any of the 7 goal statuses                          | Correct label + token colors (Active blue, Paused amber-subtle, Someday gray outline, Completed emerald-subtle, Archived gray, Not now red-subtle) | N/A                 |

</frozen-after-approval>

## Code Map

- `app/app/goals/page.tsx` -- REPLACE placeholder. Server component: load goals + per-goal project count + stuck count, render list or empty state. Mirror read pattern in `app/app/projects/[id]/page.tsx` (`loadProject`).
- `components/goals/StatusBadge.tsx` -- NEW reusable pill. Props `{ status: GoalStatus | ProjectStatus }`. Maps status → label + token classes. Consumed by 4.1/4.2/4.3.
- `components/goals/GoalRow.tsx` -- NEW row: goal text (line-clamp-2), StatusBadge, target date, project count, inline stuck count, chevron; whole row is a link to `/app/goals/[id]` (min-h 44px, focus ring).
- `lib/goals/stuck.ts` -- NEW helper `isProjectStuck(project, actions)` / `countStuckProjects(...)`: `active` project with zero `committed` actions. Shared by 4.1/4.5.
- `lib/goals/sort.ts` -- NEW helper `sortGoals(goals)` implementing the status precedence + created_at desc. Pure + unit-testable.
- `lib/supabase/schema.ts` -- import `Goal`, `GoalStatus`, `ProjectStatus`, `ActionStatus` types (read-only).
- `app/globals.css` -- existing `--color-status-*`, `--color-warning`, `--color-warning-subtle` tokens (read-only reference).
- `app/app/projects/[id]/page.tsx` -- read-pattern + test-pattern reference (co-located `page.test.tsx`).

## Tasks & Acceptance

**Execution:**

- [x] `lib/goals/stuck.ts` -- add `isProjectStuck` + `countStuckProjects` pure helpers -- single source of stuck logic reused by 4.5/Engage.
- [x] `lib/goals/sort.ts` -- add `sortGoals` pure helper with the 6-tier status precedence + created_at desc tiebreak -- deterministic list order.
- [x] `components/goals/StatusBadge.tsx` -- add reusable badge mapping each status to label + token classes -- shared across Epic 4.
- [x] `components/goals/GoalRow.tsx` -- add a goal list row (link to `/app/goals/[id]`, 44px target, focus ring, 2-line clamp, stuck count) -- one accessible row.
- [x] `app/app/goals/page.tsx` -- replace placeholder: load goals + counts, sort, render list/empty state + "New goal" link to `/app/goals/new` -- the feature.
- [x] `lib/goals/stuck.test.ts`, `lib/goals/sort.test.ts` -- unit-test the I/O matrix edge cases (stuck detection, sort precedence) -- lock the pure logic.
- [x] `components/goals/StatusBadge.test.tsx`, `app/app/goals/page.test.tsx` -- test badge labels + list/empty rendering with mocked Supabase -- lock behavior.

**Acceptance Criteria:**

- Given a user with goals of mixed status, when the list renders, then rows appear Active→Paused→Not now→Someday→Completed→Archived, each with text (2-line clamp), a status badge, target date, project count, and a chevron.
- Given a goal with ≥1 stuck project, when its row renders, then an amber stuck count is shown inline.
- Given a user with no goals, when the page renders, then it shows "No goals yet. Start one." with a control that navigates to `/app/goals/new`.
- Given the "New goal" control, when activated by keyboard or click, then it navigates to `/app/goals/new`.
- Given any of the seven statuses, when a badge renders, then it uses the mapped status token colors and correct label.

## Design Notes

Project count and stuck count need per-goal aggregation. Fetch the user's goals, then fetch their projects (`id, goal_id, status`) and the actions needed to compute stuck (`project_id, status`), and aggregate in memory — avoids N+1 and keeps the query count fixed (goals + projects + committed-actions). Only `active` projects can be stuck; only `committed` action status matters, so select minimally.

StatusBadge maps status→`{label, className}`. Example labels: `active→"Active"`, `not_now→"Not now"`, `someday→"Someday"`. Use subtle-background tokens per DESIGN.md (Paused amber-on-subtle, Completed emerald-on-subtle, Not now red-on-subtle; Someday gray outline; Active blue; Archived gray).

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `npm test -- --run` -- expected: new stuck/sort/badge/page tests pass.

## Suggested Review Order

**Page composition & data loading**

- Entry point — the server component that loads, aggregates, sorts, and renders the list (or empty state).
  [`page.tsx:64`](../../app/app/goals/page.tsx#L64)

- In-memory aggregation of project + stuck counts per goal (fixed query count, no N+1).
  [`page.tsx:80`](../../app/app/goals/page.tsx#L80)

**Shared, reusable pieces (consumed by 4.2–4.5)**

- Pure stuck-detection rule: Active project with zero committed actions.
  [`stuck.ts:29`](../../lib/goals/stuck.ts#L29)

- Pure list ordering: status precedence then created_at desc.
  [`sort.ts:34`](../../lib/goals/sort.ts#L34)

- Reusable status pill mapping every status → label + design tokens.
  [`StatusBadge.tsx:66`](../../components/goals/StatusBadge.tsx#L66)

- Accessible row: full-row link, 44px target, focus ring, clamp, stuck pill.
  [`GoalRow.tsx:61`](../../components/goals/GoalRow.tsx#L61)

**Tests (peripheral)**

- Stuck + sort pure-logic edge cases.
  [`stuck.test.ts:1`](../../lib/goals/stuck.test.ts#L1)

- List rendering, sort order, empty/error states with mocked Supabase.
  [`page.test.tsx:1`](../../app/app/goals/page.test.tsx#L1)
