---
title: "Approved Sprint Change Implementation"
type: "feature"
created: "2026-10-12"
status: "done"
route: "dispatch"
baseline_commit: "915832a7e9618e99bfafb5bbf94f2266eeac9e95"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-approved sprint-change scope">

## Intent

**Problem:** Projects cannot be filtered by status, project breadcrumbs lose the originating list context, Focus has no useful linked return path, and Engage omits the priority saved at weekly-review completion.

**Approach:** Extend the existing list, navigation, and weekly-snapshot flows. Amend their existing requirements and acceptance criteria; retain the current data model and action/review behavior.

## Boundaries & Constraints

**Always:** Filter status on the server before exact counts and pagination; preserve list URL state. Validate breadcrumb origins and render the correct trail in normal and read-error states. Read only the latest completed, user-scoped snapshot; show its intention and saved date independently of action filtering/empty states. Distinguish absent snapshot from read failure.

**Never:** Add migrations, write endpoints, privileged reads, duplicated commitment data, blocker display, or changes to review phase persistence, project-goal associations, or action semantics.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Combined project filters | Status, goal, query, page | Intersect server-side; preserve URL; filter changes reset page | Invalid status becomes All |
| Project origin | Valid/unsafe/missing `from` | Exact origin > project; otherwise parent/Area/Projects fallback | Error trail follows same rule |
| Focus return | Default or Weekly Review origin | Linked Engage/Review > Focus trail | Unsafe origin uses Engage |
| Engage commitment | Completed snapshot, none, or read failure | Latest priority/date; hide if absent; explicit unavailable state on failure | Snapshot failure does not block actions |

</frozen-after-approval>

## Code Map

- `app/app/projects/page.tsx` -- server query/count/paging, empty/error states, row links; reuse `parseListQuery` and ranged `project_search` query.
- `app/app/projects/ProjectFilterSelect.tsx` -- existing goal control and URL-preserving form; reuse `buildListHref`.
- `app/app/projects/[id]/page.tsx` -- current validated origin and parent breadcrumb logic; reuse `safeFrom`, `labelForPath`, `Breadcrumbs`.
- `app/app/focus/page.tsx`, `components/review/phase-panels/GetCreativePanel.tsx` -- Focus trail and review entry link; preserve review phase.
- `app/app/engage/page.tsx` -- RLS-scoped loader and model; snapshots join by `review_session_id`, order via completed session, display date from snapshot `created_at`.
- Nearby page/component tests cover all four surfaces; add to those existing files. Do not change snapshot writes/schema, `buildEngageModel`, or project ownership data.
- Canonical requirements: `_bmad-output/planning-artifacts/prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md`, `epics.md`, architecture `ARCHITECTURE-SPINE.md`, UX `EXPERIENCE.md` and `DESIGN.md`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` already has four open proposal action items and user edits. Preserve its timestamp and historical story statuses; close only these action items after verification.

## Tasks & Acceptance

**Execution:**
- [x] `app/app/projects/page.tsx`, `ProjectFilterSelect.tsx`, and neighboring tests -- add the five-state status selector and combined server predicate; preserve status/goal/query in search, goal selection, pagination, and project origins.
- [x] `app/app/projects/[id]/page.tsx` and tests -- valid origin takes precedence and links to the exact list URL; retain relationship fallback without an origin, including read errors.
- [x] `app/app/focus/page.tsx`, `components/review/phase-panels/GetCreativePanel.tsx`, and tests -- add linked Engage default and validated Weekly Review return path without changing persisted review phase.
- [x] `app/app/engage/page.tsx` and neighboring tests/components -- show latest completed priority and snapshot saved date; isolate snapshot absence/failure/stall from actions and omit blocker.
- [x] `components/projects/ActionItem.tsx` and `components/projects/ActionList.test.tsx` -- move Commit below the action content and align it to the lower right so narrow layouts do not overlap text.
- [x] `components/engage/EngageBoard.tsx` and `components/engage/EngageBoard.test.tsx` -- bound the next-action dialog to the viewport, scroll its choices internally, and keep dismissal controls reachable.
- [x] PRD, existing epic criteria, architecture spine, and UX docs -- record P1-P4 requirements and design constraints without new stories or schema changes.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark the four existing proposal action items complete only after tests pass; retain unrelated content and historical statuses.
- [x] Projects list status default -- user clarified on 2026-10-13 that Active, not All, is the default project-status filter; keep new project records Paused and the separate action filter unchanged.

**Acceptance Criteria:**
- Given more than 20 projects, when status, goal, and search are combined, then server results/counts/pagination intersect correctly, filter changes reset page, invalid status normalizes to All, and empty/no-match/error states remain distinct.
- Given a project opened from a filtered Projects URL, when detail succeeds or fails to load, then its breadcrumb returns to that exact URL ahead of parent hierarchy; direct visits keep the existing parent fallback and unsafe origins are rejected.
- Given Focus opened directly or from Get Creative, when its page succeeds or fails, then a working Engage or Weekly Review link precedes Focus; returning preserves review phase.
- Given completed reviews, when Engage loads, then the latest by `completed_at` (stable ID tie-break) supplies the intention and `created_at` date; drafts do not replace it, it persists across week boundaries and action-empty/filter states, and blocker is never rendered.
- Given no completed session/snapshot or a failure or stall reading either one, then Engage distinguishes absence from an explicit non-blocking unavailable state after at most three seconds; usable actions still render. All reads remain user-scoped and no schema/write contract changes.
- Given a subsequent review completes, when Engage reloads across a week or year boundary, then the new completed review's intention and saved date replace the previous commitment.
- Given a narrow viewport and an available project action, when its row renders, then Commit is in a separate lower-right row beneath the content and does not overlap the action text.
- Given a long list of next actions after marking an Engage action done, then the dialog stays within the viewport, choices scroll inside it, and the Not now/Escape dismissal remains reachable.

## Implementation Notes

- Implemented all four behaviors using the existing authenticated Supabase client, navigation helpers, and list-state utilities; no schema or mutation contract changed.
- Updated the PRD, existing Epic 4/5/7/8 criteria, architecture spine, UX experience/design docs, and the four proposal action-item statuses. The worktree already contained `last_updated: 10-12-2026 00:00` before implementation; that value and existing story histories were preserved.
- Focused regressions cover status intersection/URL state/pagination, valid and unsafe origin behavior, Focus error navigation, and completed snapshot ordering, display, absence, and non-blocking failures.
- Full suite (before the four later UI/Engage regression tests): 1,076/1,077 tests passed. The unrelated existing `components/authenticated/Sidebar.test.tsx` expectation omits the current Someday navigation item; no sidebar source or test was changed. The later regression tests pass in their focused suites.
- Acceptance coverage: focused tests cover invalid status, combined filters and URL/page state, true-empty/no-match/read-error states, valid/unsafe breadcrumb origins, Focus error return paths, latest-review ordering, absent/read-error states, blocker omission, and replacement across a year boundary. User scoping remains enforced by the existing RLS policies and authenticated SSR client; no live cross-user integration test was run.
- Sprint-status utility reports no open action items and no illegal keys; it still reports the pre-existing unrecognized Epic H tracking keys.
- Follow-up UI request added 2026-10-12: moved project Commit to its own lower-right row and constrained the Engage next-action dialog with an internally scrollable choice list and persistent dismissal footer.
- Follow-up clarification added 2026-10-13: default the Projects list's project-status filter to Active; keep All statuses selectable, new records Paused, and the ActionList action-status default unchanged.
- Review fix: bound the completed-session/snapshot read to three seconds; a stalled query now produces the existing unavailable state without delaying the action board. Fake-timer test verifies action availability.
- Browser smoke attempted at `/app/projects`; auth middleware redirected to `/sign-in`. Authenticated desktop/mobile layout and real scrolling were not browser-verified because no signed-in session was available.

## Verification

**Commands:**
- `npm test -- app/app/projects/page.test.tsx app/app/projects/ProjectFilterSelect.test.tsx 'app/app/projects/[id]/page.test.tsx' app/app/focus/page.test.tsx app/app/review/page.test.tsx components/review/ReviewShell.test.tsx app/app/engage/page.test.tsx components/engage/EngageBoard.test.tsx components/projects/ActionList.test.tsx lib/navigation/from.test.ts` -- all focused behavior tests pass, including the year-boundary replacement case.
- `npm run lint -- <touched source paths>` and `npx tsc --noEmit` -- no new lint or type errors.
- `uv run .agents/skills/bmad-sprint-planning/scripts/sprint_plan.py status --status-file _bmad-output/implementation-artifacts/sprint-status.yaml` -- no open action items; existing unrecognized Epic H keys remain.

## Review Triage Log

- `false` — The proposal's Developer handoff and “not started by Correct Course” lines describe the Correct Course handoff state. Implementation proceeded in the separately invoked build workflow after the user redirected to direct implementation; the original proposal remains untouched by request.
- `false` — “No source or canonical planning artifact has been modified by this proposal” is scoped to what the proposal itself changed when authored, not a claim about this later implementation.
- `false` — The Commit-row and dialog changes were added by the user's later explicit request and are recorded as separate follow-up scope in this spec; they were not silently attributed to the earlier proposal.
- `false` — The changed `last_updated` value was already present in the worktree before implementation and was retained exactly; the baseline diff alone does not include that initial dirty-state context.
- `false` — The Epic 9 research brief/report are separate user work marked `in-progress`; their unfinished deliverables are unrelated to this feature request and were not modified.
- `false` — The research report explicitly says findings are pending; this implementation does not claim that research deliverable is complete.
- `false` — Missing research citations/digests belong to the same unrelated, explicitly in-progress analytics research task; they are not a defect in this implementation.
- `low` — The original failure criterion could be read as covering only the snapshot-row read. It now explicitly covers both completed-session and snapshot lookups, and a focused test verifies the former failure remains non-blocking.
- `medium (unverified)` — Real browser verification of the mobile row and scrollable dialog was not possible because unauthenticated navigation redirects to sign-in. Component tests verify structure and scroll styles but cannot establish actual viewport clipping; defer until an authenticated browser session is available.
- `false` — Invalid status, empty/no-match/error, and newer-review replacement cases have focused tests. User isolation continues through the existing RLS policies for both tables and the authenticated server Supabase client; no policy or privileged-read path changed.
- `medium (unverified)` — Edge-case review independently identified the same missing authenticated browser viewport check; grouped with the browser-verification gap above because it has the same cause and evidence.
- `medium (unverified)` — Verification-gap review confirmed the component tests cannot prove browser scroll/clipping behavior; grouped with the same deferred authenticated browser check.
- `medium` — A stalled completed-session/snapshot query could keep `Promise.all` waiting despite usable actions. Added a three-second timeout and a fake-timer regression proving the action board renders with the unavailable state; fixed in this review pass.