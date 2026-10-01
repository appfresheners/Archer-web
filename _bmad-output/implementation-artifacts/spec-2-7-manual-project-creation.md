---
title: "Manual Project Creation"
type: "feature"
created: "2026-10-01"
status: "ready-for-dev"
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
