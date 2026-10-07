---
title: 'Someday Project Status'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9d38f3cdda208b253b3dae7cbc2953840727f76f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-07.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Projects cannot be parked as Someday/Maybe, so users cannot move deferred projects out of active and paused work without archiving them. They also do not appear in the existing Get Creative review.

**Approach:** Add Someday as a project status and make it available in project detail and Get Current. Keep Someday projects out of active-work and stuck calculations, and surface them separately from parked inbox items in Get Creative, where activation returns a project to Paused.

## Boundaries & Constraints

**Always:** Add the database enum value without changing existing rows. Preserve current ownership/RLS and PATCH validation behavior. Keep Someday projects out of active-only Engage and stuck calculations. Reuse the existing project PATCH path and status badge. Keep the export shape unchanged.

**Never:** Do not rewrite existing project statuses, add a new mutation route, change goal statuses, or redesign unrelated weekly-review phases. Do not add a project field to the export contract; the existing status value is included when export is implemented.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set a project to Someday | Owned project; PATCH status is `someday` | Status persists and the existing project detail/list surfaces show Someday | Invalid status remains rejected; existing route error behavior is preserved |
| Review a Someday project | Project status is `someday` during Get Creative | Project appears separately from Someday inbox items; Activate changes it to `paused` | PATCH failure is shown through the existing inline error state; item remains Someday |
| Active-work calculations | Someday project has actions, including no committed action | Project is absent from Engage and is not counted or flagged as stuck | N/A |
| Apply the migration | Existing projects have any valid status | Enum gains `someday`; all existing rows remain unchanged | Migration failure stops deployment; do not rewrite existing project rows |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- add an imperative migration after the current latest migration; the current project enum is defined in `0001_init_schema.sql`.
- `lib/supabase/schema.ts` -- authoritative `ProjectStatus` union mirrors the database enum.
- `lib/projects/validate.ts` and `lib/projects/validate.test.ts` -- `isProjectStatus` gates `sanitizeProjectPatch`; tests currently reject `someday`.
- `components/projects/ProjectStatusSelect.tsx` -- shared project-detail selector; `ProjectDetailClient` uses it. `components/review/phase-panels/GetCurrentPanel.tsx` has its own status options for the same PATCH route.
- `lib/engage/model.ts` and `lib/engage/model.test.ts` -- project groups already include only active projects; add Someday to the non-active regression matrix.
- `lib/goals/stuck.ts` and `lib/goals/stuck.test.ts` -- stuckness is active-only; add Someday to the non-active test matrix. Goal counts reuse this helper.
- `lib/review/reviewData.ts` and `.test.ts` -- `buildReviewData` receives all loaded projects but currently derives only active current projects and Someday inbox items. Add a Someday-project projection without changing goal-alignment counts.
- `app/app/review/page.tsx`, `components/review/phase-panels/GetCreativePanel.tsx`, and `components/review/ReviewShell.test.tsx` -- review loader already passes all project rows; render Someday projects in a distinct section, with Activate using the existing project PATCH flow.
- `components/goals/StatusBadge.tsx` already defines Someday styling and is used by the Projects list and detail; reuse without changing its palette. Story 6.1 export is not implemented yet, so no export code is in scope.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261007071629_add_someday_project_status.sql`, `supabase/tests/project_status_someday_test.sql` -- add the additive enum migration and pgTAP coverage; existing rows are not rewritten.
- [x] `lib/supabase/schema.ts`, `lib/projects/validate.ts`, `lib/projects/validate.test.ts`, `app/api/projects/[id]/route.test.ts` -- add Someday to the type and accepted project statuses; retain rejection of `not_now` and unknown values.
- [x] `components/projects/ProjectStatusSelect.tsx`, `components/review/phase-panels/GetCurrentPanel.tsx` -- offer Someday/Maybe and retain the existing PATCH route.
- [x] `lib/engage/model.test.ts`, `lib/goals/stuck.test.ts` -- cover Someday in the existing non-active project regression matrices; keep current active-only logic.
- [x] `lib/review/reviewData.ts`, `lib/review/reviewData.test.ts`, `components/review/phase-panels/GetCreativePanel.tsx`, `components/review/ReviewShell.test.tsx` -- derive and display Someday projects separately; activate through the existing project PATCH flow to Paused while preserving inbox actions.
- [x] `components/goals/StatusBadge.test.tsx` -- verified existing Someday styling; badge styling and the future export shape remain unchanged.

**Acceptance Criteria:**
- Given the database schema, when the migration is applied, then `project_status` accepts `someday` and existing rows are unchanged.
- Given a project PATCH with `status = someday`, when validation runs, then it is accepted; invalid statuses remain rejected.
- Given the project detail or Get Current status selector, when opened, then Someday/Maybe is offered and selecting it persists through the existing PATCH route.
- Given Engage, stuck detection, or goal stuck counts, when calculated, then Someday projects are excluded and are never flagged as stuck.
- Given Get Creative, when Someday items are listed, then Someday projects appear separately from inbox items; activating a project changes its status to Paused.
- Given the Projects list, when a Someday project renders, then the existing StatusBadge displays its Someday styling.
- Given a future data export, when a Someday project is exported, then its status is included without changing the export shape.

## Implementation Notes

- Applied the enum migration to the local Supabase database only. Verified the enum labels and confirmed the local `projects` table had no rows to rewrite; no remote migration was run.
- Updated the project PATCH route test to reject `not_now` now that `someday` is valid.
- Added direct PATCH acceptance coverage, exposed the pending activation state to assistive technology, and supplied the `#actions` target used by Get Current navigation.
- The worktree also contains a separate breadcrumb/Get Current change proposal and related navigation edits. They were preserved and were not included as Story 8.2 tasks.

## Spec Change Log

## Review Triage Log

- false -- Blind: origin paths are passed through `safeFrom` before breadcrumb labels and hrefs are created.
- false -- Blind: `StuckIndicator` documents and supports both callback buttons and internal-link CTAs for distinct callers.
- false -- Blind: the duplicate-parent case is not generated by current origin-link callers; the supplied origins are `/app/engage` and `/app/review`.
- low / patch -- Blind: project activation disabled the control while pending but exposed no busy state; added `aria-busy` for the in-flight project.
- false -- Blind: the required `Activate` label and transition back to Paused are specified behavior, not an implementation mismatch.
- false -- Blind: breadcrumb helper behavior and the changed navigation call sites have focused coverage; a full navigation E2E is outside this story's acceptance.
- false -- Blind: absent or rejected origins are safely omitted by the conditional breadcrumb construction.
- false -- Blind: `Link` is imported in the changed project-detail module and used for breadcrumb navigation.
- false -- Blind: `withFrom` edge cases named by the reviewer are not used by current call sites and do not affect the supported origin paths.
- false -- Blind: the status roundtrip is covered at data-builder, UI, activation, and PATCH boundaries; no separate E2E is required by this story.
- false -- Edge: an empty goal label fails the truthy check and falls back to Projects; it is not rendered as an empty breadcrumb.
- false -- Edge: monthly-check goal IDs are selected from a required database ID and the page returns not-found before rendering when the goal is absent.
- false -- Edge: `labelForPath` is a local pure function receiving a string already accepted by `safeFrom`; no throwing path was demonstrated.
- false -- Edge: same as above; the project page also guards origin rendering when `safeFrom` returns null.
- false -- Edge: `commitHref` is built from a server-loaded project ID and fixed internal route, not user-provided URL input.
- false -- Edge: Engage project IDs are required model IDs from loaded records; no reachable undefined-ID path was shown.
- false -- Edge: the reviewer supplied no reachable rejected `searchParams` promise path; Next provides the promised route params on this server page.
- low / patch -- Edge: the changed invalid-status test alone did not prove PATCH accepts Someday; added a route test asserting a Someday PATCH updates and returns 200.
- false -- Edge: the removed inline-commit test reflects the approved move to project detail; `ActionList.test.tsx` covers committing there, and the new review link now targets the action list.
- false -- Edge: `ReviewData` adds `somedayProjects` in both its interface and builder return value.
- false -- Edge: Get Creative tests assert Someday project rendering, successful activation to Paused, and failed-activation retention/error.
- false -- Verification gap: reviewed state is owned by `ReviewShell` (`reviewedProjectIds`) and passed back through `reviewedIds`; the confirmed state is rendered from that prop.
- medium / patch -- Diff audit: Get Current and Engage linked to `#actions`, but no element had that ID; added the target to `ActionList` and asserted it in its test.
- low / patch -- Diff audit: the project PATCH route comment listed only the original four statuses; updated it to include Someday.

## Design Notes

The approved Epic 8 change proposal intentionally supersedes Story 5.6's earlier decision that projects had no Someday status. Get Creative should keep inbox items and projects in distinct sections because their records and activation transitions differ: inbox items return to unprocessed, while projects return to Paused.

The enum addition is additive and existing data is untouched, but enum removal is not a straightforward rollback. Story 6.1 export is still backlog; the status must be available to that future implementation without expanding its serialized shape.

## Verification

**Commands:**
- `npm test -- 'app/api/projects/[id]/route.test.ts' components/projects/ActionList.test.tsx components/review/ReviewShell.test.tsx` -- 68 tests passed after review fixes.
- `npm test -- lib/projects/validate.test.ts lib/goals/stuck.test.ts lib/engage/model.test.ts lib/review/reviewData.test.ts components/review/ReviewShell.test.tsx 'app/app/projects/[id]/ProjectDetailClient.test.tsx'` -- 104 tests passed.
- `npm test` -- 976 tests passed across 92 files after review fixes.
- `npx tsc --noEmit && npm run lint` -- passed.
- `npm run build` -- passed.
- `npx --no-install supabase test db --local` -- 64 pgTAP assertions passed across 4 files.