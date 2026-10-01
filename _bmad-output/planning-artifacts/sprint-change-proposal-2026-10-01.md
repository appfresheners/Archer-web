# Sprint Change Proposal - 2026-10-01

**Project:** Archer  
**Status:** Approved for implementation (2026-10-01)  
**Change trigger:** User-requested course correction incorporating the deferred-work entry from Story 5.2.

## 1. Issue Summary

The Story 5.2 review recorded a deferred usability gap: the project `goal_id` PATCH exists, but users cannot discoverably attach existing projects to a goal or change a project's goal from project detail. On 2026-10-01, the user asked to add that deferred work and also requested project filtering by goal, manual project creation with an AI/no-AI choice, and pointer cursors on clickable items.

Current implementation evidence:

- Project detail renders a parent-goal breadcrumb, but its edit surface has no goal selector.
- Goal detail lists projects already linked to that goal, with no attach-existing-project control.
- `/app/projects` loads and lists projects without goal data or a goal filter.
- `/app/projects/new` submits only to `/api/generate`; no authenticated project-creation POST route exists.
- Only the goal and project detail disclosure summaries declare `cursor-pointer` in app pages; there is no app-wide cursor affordance rule.

This is an emergent stakeholder requirement and a deferred usability item, not a production incident. The user approved each detailed change proposal individually and approved the complete proposal on 2026-10-01. The user directed that the remaining deferred-work ledger stays with the existing Epic H scope; this proposal adds only the agreed H-4 cursor story.

## 2. Impact Analysis

### Epic Impact

- **Epic 2 - Project Mode Generation:** Add a manual project creation path beside the existing AI flow. AI remains the default and its behavior is unchanged.
- **Epic 4 - Goal, Project & Action Management:** Add two-way goal/project linking controls and filtering on the existing Projects index. Epic 4 remains viable and in progress.
- **Epic H - Hardening:** Add an app-wide clickable-cursor consistency story. This extends the existing cross-cutting hardening work; no new epic is required.
- **Epic 5 - The GTD Loop:** No new implementation scope. Its Story 5.2 deferred-work item is tracked through the approved Story 4.6.
- No planned epic becomes obsolete and no resequencing is required.

### Story Impact

- Add **Story 2.7: Manual Project Creation** to Epic 2.
- Add **Story 4.6: Project-Goal Linking and Project List Filtering** to Epic 4.
- Add **Story H-4: App-wide Clickable Cursor Affordance** to Epic H.
- Preserve the approved/frozen Story 4.3 and Story 5.2 specifications. Story 4.6 carries the deferred UI work rather than amending those frozen intents.

### Artifact Conflicts and Updates

- **PRD:** Existing FR49 establishes a parent goal, but not reassignment, attaching existing projects, or goal filtering. Project Mode assumes AI generation. Add FR93 for manual project creation, FR94 for filtering projects by goal (including no-goal projects), and FR95 for changing/clearing a project's parent goal and attaching it from goal detail. Keep the existing goal/project model and MVP thesis.
- **Architecture:** The nullable `projects.goal_id`, authenticated project PATCH, and RLS already support linking. Add an authenticated, validated `POST /api/projects` for manual creation. No schema, migration, provider, or deployment change is needed.
- **UX Design and Experience:** Specify a goal selector on project detail, an attach-existing-project control on goal detail, All/goal/No goal filtering on the Projects index, and a Generate with AI/Create manually choice. Add UX-DR26 for pointer cursors on enabled clickable controls while preserving disabled-state cursors and keyboard/focus affordances.
- **Project context:** No `AGENTS.md` is present. No whole or sharded specification was found under planning artifacts; the relevant Epic 4, Epic 5, and implementation specs were reviewed.
- **Secondary artifacts:** Update epic/story documentation, tests, and sprint tracking after final approval. No deployment, infrastructure, or Supabase migration change is identified.

### Technical Impact

The linking flow reuses the existing authenticated `PATCH /api/projects/[id]` `goal_id` support. The new manual path adds a small collection route with server-side validation and user-scoped Supabase writes. The Projects list needs goal names/IDs and a filter state. The cursor change is a shared UI styling rule plus an audit of custom clickable controls. RLS remains the data boundary; no cross-user linking is permitted.

## 3. Recommended Approach

**Selected path: Direct adjustment, with focused backlog additions.**

The existing data model and project routes already support the core relationship. Adding scoped UI and one validated create route is less risky than rollback and does not justify reducing or redefining the MVP. Preserve current AI generation behavior, add the manual path alongside it, and track goal organization and cursor consistency in separate stories.

- **Effort:** Medium; approximately 3-5 focused engineering days, including tests. This is a planning estimate, not a release commitment.
- **Risk:** Low to moderate. No migration is required; the main correctness risk is preserving owner scoping when selecting or moving projects between goals.
- **Timeline:** Add approximately 3-5 engineering days to the current plan, plus story/spec authoring and review.
- **Alternatives considered:** Rollback is not viable because it removes no complexity needed for these additions. MVP review is unnecessary because the capabilities fit the existing goal-project-action model.
- **Scope classification:** Moderate; backlog additions span Epics 2, 4, and H.

## 4. Detailed Change Proposals

All three proposals below were approved individually during incremental review. The complete proposal still requires final approval.

### Stories: Epic 4

**Story 4.6: Project-Goal Linking and Project List Filtering**

**OLD:** Project detail displays a parent-goal breadcrumb but cannot change or clear the association. Goal detail lists linked projects but cannot attach an existing project. The Projects index has no goal filter. Story 5.2's deferred-work ledger records the missing two-way linking UI.

**NEW:** From project detail, the user can select, change, or clear the parent goal. From goal detail, the user can attach an existing project; attaching a project linked elsewhere moves its single `goal_id` association rather than duplicating it. The Projects index filters by All projects, one goal, or No goal. Use the existing authenticated `goal_id` PATCH and RLS; add tests for attaching, moving, clearing, filtering, and empty results. No schema change.

**Rationale:** Resolves the exact deferred-work item and makes existing relationships manageable from both sides.

### Stories: Epic 2

**Story 2.7: Manual Project Creation**

**OLD:** `/app/projects/new` offers only AI generation, and there is no authenticated collection POST route for direct project creation.

**NEW:** Add a Generate with AI / Create manually choice, with AI selected by default. Manual mode collects a required project name and optional purpose, successful outcome, and parent goal. Save through a validated, authenticated `POST /api/projects`, make no AI request, then navigate to project detail where the existing ActionList can add actions. An Active project without a committed action continues to show the existing stuck indicator. Add route, validation, and UI tests. No schema migration.

**Rationale:** Offers a non-AI route without changing the current generation path or duplicating the existing action editor. The tradeoff is that an initially actionless Active project is visibly stuck until the user adds and commits an action.

### UX: Epic H

**Story H-4: App-wide Clickable Cursor Affordance (UX-DR26)**

**OLD:** Cursor behavior is inconsistent and assigned locally; no app-wide requirement exists.

**NEW:** Enabled links, buttons, selects, checkboxes/radios, disclosure summaries, and custom button-like controls use a pointer cursor throughout the app. Disabled controls retain `not-allowed`. Keep semantic interactive elements and visible focus/hover cues; pointer shape is not the only interaction signal. Audit the app and verify representative enabled and disabled controls in a browser.

**Rationale:** Standardizes mouse affordance on existing and new screens without changing control behavior or weakening accessibility.

### Proposed PRD and UX Text

- **FR93:** A signed-in user may create a project manually without an AI request, providing a project name and optionally purpose, successful outcome, and parent goal; on save the project is persisted and the user is taken to its detail view.
- **FR94:** The Projects view allows filtering by all projects, a selected goal, or projects with no goal.
- **FR95:** A user may set, change, or clear a project's parent goal from project detail and may attach an existing project from goal detail; each project has at most one parent goal.
- **UX-DR26:** All enabled clickable elements provide a pointer cursor; disabled controls retain a not-allowed cursor. Keyboard operation, focus visibility, and semantic roles remain required.

## 5. Implementation Handoff

**Recipient:** Product Owner / Developer coordination, then Developer for implementation. The scope is Moderate because approved work spans multiple epics and requires backlog updates before coding.

**Responsibilities:**

- Product Owner: confirm priority and sequence for Stories 2.7, 4.6, and H-4; retain the default AI path and the approved manual-create behavior.
- Developer: write implementation specs, implement the authenticated create route and UI, add goal-link/filter controls, apply the shared cursor affordance, and add focused tests.
- Developer / backlog owner: carry the Story 5.2 deferred-work entry into Story 4.6 without marking it resolved before implementation is complete.

**Sprint tracking updated:** Stories 2.7, 4.6, and H-4 are `ready-for-dev`. Epic 2 was reopened as `in-progress`; Epic 4 remains `in-progress`; Epic H remains `backlog` until a hardening story starts.

**Success criteria:**

- A project can be linked, moved, or unlinked from either the project or goal detail surface, with the relationship persisted for the signed-in owner only.
- The Projects index returns correct results for All, a selected goal, and No goal.
- Manual mode saves and opens a project without calling `/api/generate`; the AI path remains unchanged.
- Enabled clickable controls show a pointer cursor and disabled controls retain `not-allowed` across the app.
- Focused tests, typecheck, lint, and build pass; no schema migration is introduced.

## Checklist Progress

- [x] 1.1 Trigger identified: Story 5.2 deferred-work item, plus user-requested scope.
- [x] 1.2 Problem categorized as deferred usability work and new stakeholder requirements.
- [x] 1.3 Evidence recorded from the request, deferred ledger, and current UI/routes.
- [x] 2.1-2.5 Epic impact assessed; no epic is obsolete and no resequencing is needed.
- [x] 3.1-3.4 PRD, architecture, UX, and secondary artifacts assessed.
- [x] 4.1-4.4 Direct adjustment selected; rollback and MVP review not recommended.
- [x] 5.1-5.5 Issue, impacts, recommendation, MVP effect, and handoff drafted.
- [x] 6.1-6.2 Proposal checked for scope and consistency.
- [x] 6.3 Complete proposal approved by the user on 2026-10-01.
- [x] 6.4 `sprint-status.yaml` updated for Stories 2.7, 4.6, and H-4; the Story 5.2 deferred item points to Story 4.6 and remains open until implementation.
- [x] 6.5 Handoff responsibilities and success criteria documented for Product Owner / Developer coordination.

## Approval Gate

The complete proposal is approved. The PRD, architecture, UX documents, epic breakdown, implementation contexts, three story specifications, sprint tracker, and deferred-work tracking note have been updated. Product implementation code has not been changed. **Handoff:** Product Owner / Developer coordination prioritizes the three ready-for-dev stories; Developer owns implementation and verification against the story acceptance criteria.