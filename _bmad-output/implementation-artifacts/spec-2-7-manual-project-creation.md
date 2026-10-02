---
title: "Manual Project Creation"
type: "feature"
created: "2026-10-01"
status: "done"
baseline_commit: "32039893824e106e5ecb262000edb2e8c400cae7"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-approved course correction">

## Intent

**Problem:** Project Mode currently requires an AI request for every new project, even when the user already knows the project name and outcome.

**Approach:** Add an explicit "Generate with AI" / "Create manually" choice to `/app/projects/new`, keeping AI selected by default. Manual mode collects a name, optional purpose and successful outcome, and an optional parent goal. It saves through a new authenticated project collection route and navigates to the saved detail page without calling the AI endpoint.

## Boundaries & Constraints

**Always:** Preserve the existing AI flow as the default and keep its request payload, loading, retry, and navigation behavior unchanged. Manual project creation is authenticated and uses the session user ID. A supplied goal ID must resolve to a goal owned by that user before insert. Use existing columns and defaults; no schema migration. If started from Inbox Clarify, preserve the seed text and mark the inbox item processed with `resolved_project_id` after successful creation, matching the current AI-created-project handoff. Keep the existing project detail ActionList and stuck indicator behavior.

**Ask First:** Any schema/migration change or changing AI as the default path.

**Never:** Call `/api/generate` in manual mode; create actions implicitly; accept a cross-user goal association; hard-delete projects.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
| --- | --- | --- | --- |
| AI default | New project form | Existing AI mode selected and unchanged | Existing generation errors remain |
| Manual valid | Name, optional fields, optional owned goal | Insert project and navigate to detail; no AI call | 400 invalid; 401 unauth; 500 database |
| Empty name | Blank/whitespace name | No request or insert | Inline validation |
| Goal-less | Goal omitted or null | Save with `goal_id = null` | N/A |
| Foreign goal | Goal ID not owned by user | Reject without insert | 400 |
| Inbox handoff | `from_inbox` seed present | Save, link inbox item, mark processed, then navigate | Preserve current retry-safe behavior; do not duplicate project |

## Code Map

- `app/app/projects/new/page.tsx` -- load the signed-in user's goals for the optional picker.
- `app/app/projects/new/NewProjectClient.tsx` -- preserve AI behavior and coordinate mode selection/manual save and Inbox handoff.
- `components/projects/ProjectModeInput.tsx` -- expose the AI/manual selection and the appropriate form controls.
- `app/api/projects/route.ts` -- NEW authenticated `POST`; validate fields, verify selected goal ownership, insert project, return `{ id }`.
- `lib/projects/create.ts` -- NEW pure request validator, following the existing project validator conventions.
- `app/app/projects/[id]/page.tsx` -- existing detail surface and ActionList; no behavior change required.

## Acceptance Criteria

- Given `/app/projects/new`, when it loads, then "Generate with AI" is selected by default and the current AI flow behaves as before.
- Given manual mode, when the form renders, then project name is required and purpose, successful outcome, and parent goal are optional.
- Given valid manual input, when saved, then an authenticated request creates one project row owned by the signed-in user, no AI provider is called, and the client navigates to `/app/projects/{id}`.
- Given a selected goal, when the manual-create request is processed, then the route verifies that goal belongs to the signed-in user; a foreign or missing goal is rejected without a project insert.
- Given an Inbox Clarify handoff, when manual creation succeeds, then the originating inbox item is linked and marked processed using the existing handoff contract.
- Given the newly created Active project has no committed action, when detail renders, then the existing stuck indicator remains visible until resolved.

## Verification

- Unit-test manual-create validation for name, nullable fields, and optional UUID.
- Route-test auth, successful insert, goal ownership, invalid data, and database errors.
- Component-test mode selection, AI-default preservation, manual submission, and Inbox handoff.
- Run `npx tsc --noEmit`, `npm run lint`, focused project tests, and `npm run build`.

## Review Triage Log

- `app/api/projects/route.test.ts` — ownership `eq` filter args mocked away, never asserted — `patch`. Verified: the mock's `eq` calls discard arguments, so a wrong `.eq("user_id", …)` passes silently; the sibling inbox route test asserts the filter args. Fix: record and assert the `goals` chain `eq` calls.
- `app/app/projects/new/page.tsx` — `loadGoalsForPicker` has no coverage and degrades silently — `patch`. Verified: no test references it; a dropped `goal_text` or `.map` leaves a broken picker with no failing test. Fix: extract to a testable module and unit-test success mapping and `[]` degradation.
- `app/app/projects/new/NewProjectClient.tsx` — manual "Try again" retry untested — `patch`. Verified: the AI retry test covers only `/api/generate`; no test clicks retry after a manual failure. Fix: add a manual-retry case.
- `app/api/projects/route.test.ts` — present-but-invalid optional field (non-string `purpose`/`outcome`, malformed `goal_id`) untested at the route level — `patch`. Verified: only the pure validator covers these. Fix: add route-level 400 cases.
- `app/api/projects/[id]/route.ts` — `PATCH` accepts `goal_id` with no ownership check — `defer`. Verified: `sanitizeProjectPatch` passes a uuid `goal_id` straight into `.update`; FK + RLS alone do not prevent cross-user goal linking. Pre-existing route, outside Story 2.7.
- `lib/projects/create.ts` — `purpose`/`successful_outcome` have no length bound — `defer`. Verified: `optionalText` only type-checks; the existing `sanitizeProjectPatch` has the same unbounded convention, so a bound belongs to a shared change, not this story alone.
- `components/projects/ProjectModeInput.tsx` — submit buttons set `aria-disabled` true on an empty field while still clickable — `defer`. Verified: the AI button already had this pre-existing pattern; changing it would touch the AI path the spec forbids altering.
- `app/api/projects/route.ts` — auth-check errors collapse to 401 — `low`/reject. Verified: identical `getAuthenticatedUserId` convention on every sibling route; `createClient`/`getUser` does not throw in normal operation, and distinguishing would add branching.
- `app/api/projects/route.ts` — 400 message "A valid project name is required" also returned for non-name validation failures — `low`/reject. Verified: only craftable requests reach those branches; the client always sends well-typed fields; a precise message needs the validator to report a reason.
- `components/projects/ProjectModeInput.tsx` — manual mode has no Enter-to-submit — `low`/reject. Verified: multi-field manual form; Enter parity was never required by the intent; adding a form/submit plumbing is more than a direct fix.
- `app/app/projects/new/NewProjectClient.tsx` — stale error/retry across a mode switch — `low`/reject. Verified: requires a failed submit followed by a mode switch then a retry click; the fix needs a new mode-change callback, which is disproportionate.
- `app/app/projects/new/page.tsx` — goals picker has no order/limit/filter — `low`/reject. Verified: tolerable for the typical user; ordering/filtering rules are not settled by the spec.
- `components/projects/ProjectModeInput.tsx` — local validation errors not cleared on mode switch — `low`/reject. Verified: the persisted error stays accurate (the underlying field is still empty/invalid), so no bad outcome occurs.
- `_bmad-output/implementation-artifacts/epic-2-context.md` — rewrite dropped story-level specifics — `false`. Verified: the compile instructions mandate aggressive scoping and no story-level details; those specifics live in Story 2.3's spec.
- `_bmad-output/implementation-artifacts/spec-2-7-manual-project-creation.md` — body "does not reflect" the implemented toggle/route — `false`. Verified: the frozen spec already describes the toggle and route; editing the spec to match code is prohibited.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story `in-progress` while spec is `in-review` — `false`. Verified: transient within the workflow; final status sync happens at completion.
