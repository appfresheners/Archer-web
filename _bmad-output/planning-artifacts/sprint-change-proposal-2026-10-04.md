# Sprint Change Proposal - 2026-10-04

**Project:** Archer
**Status:** Approved for implementation (2026-10-04)
**Change trigger:** New projects currently start Active; user wants them Paused until ready to engage. User also wants GTD Horizon 4/5 context and Life Areas represented in Archer, including Projects that are not linked to Goals.

## 1. Issue Summary

Archer currently creates projects as Active across manual project creation, standalone AI Project Mode, and goal-generated breakdowns. An Active project with no committed next action is treated as stuck. This makes a newly created project appear immediately actionable, even when the user intends to pick it up later.

Archer also has no persisted model or input surface for Vision (Horizon 4), Purpose and Principles (Horizon 5), or ongoing Areas of Focus (Horizon 2). Its current Goal -> Project -> Action structure cannot place a standalone project under a Life Area.

This is a new stakeholder requirement and a GTD-model gap, not a production incident. The implementation paths implicated are Epic 2 Stories 2.3 and 2.7 (standalone AI and manual project creation), Epic 3 Story 3.6 (goal-generated projects), Epic 4 project/status management, and Epic 5 Get Creative review.

Evidence:

- The PRD defines project statuses but not a creation default; migration `supabase/migrations/0001_init_schema.sql` sets the project status default to `active`.
- `app/api/projects/route.ts` and `app/api/generate/route.ts` rely on the database default for new project rows.
- `lib/goals/generate-goal` persistence creates projects beneath a Goal and does not assign an Area.
- Archer's stuck-project rule is Active plus no committed next action.
- Online research of official David Allen Company material distinguishes ongoing Areas of Focus from finite projects and discusses reviewing Projects and Larger Outcomes. It does not prescribe a software page or a default project status. The research report records the evidence and timeframe caveat: [David Allen Horizons and Areas of Focus research](research/domain-david-allen-horizons-and-areas-of-focus-2026-10-04/research.md).

## 2. Impact Analysis

### Epic Impact

- **Epic 2 - Project Mode Generation:** New standalone AI and manual projects must default to Paused; standalone projects may optionally link directly to a Life Area.
- **Epic 3 - Goal Creation Wizard:** All projects generated beneath a Goal must default to Paused. The Goal may optionally belong to a Life Area; generated Projects inherit that Area through the Goal.
- **Epic 4 - Goal, Project & Action Management:** Add Story 4.7 for the Paused default. Goal and standalone Project Area relationships will be managed by the new Focus feature without changing existing Goal -> Project -> Action behavior.
- **Epic 5 - The GTD Loop:** Get Creative receives an optional Focus review entry point. It is not a completion gate.
- **Epic 7 - Focus Horizons & Areas of Focus:** Add a new epic after Epic 5 and before Epic 6. Epic 6 remains the data portability/vault epic and keeps its existing ID; only the planned sequence changes.
- **Epic 6 - Data Portability:** Keep its existing scope and ID. Clarify Story 6.1's export contents to include Focus profiles and Areas, including archived Areas, under the existing all-user-data export requirement.
- No existing epic becomes obsolete. No rollback or removal of shipped features is proposed.

### Story Impact

- Add **Story 4.7: New Projects Start Paused**. It covers manual, standalone AI, and goal-generated creation paths, a database-default migration, explicit insert values, and focused tests. Existing projects are not bulk-updated.
- Add **Epic 7: Focus Horizons & Areas of Focus**, with:
  - **Story 7.1:** Focus profile and Area persistence, RLS, ownership checks, nullable Area relationships, and generated schema types.
  - **Story 7.2:** Focus page and Area management.
  - **Story 7.3:** Assign Goals and standalone Projects to Areas, including create/edit flows and cross-owner protection.
  - **Story 7.4:** Optional Focus review entry in Get Creative; no weekly-review gate.
- Story 7.3 preserves the accepted single-parent model: a Goal may have one Area; a Project may belong to a Goal or directly to an Area when it has no Goal. Goal-linked Projects derive their Area from the Goal and cannot carry a conflicting direct Area.
- Existing story specs remain unchanged; these are new stories added through this course correction.

### Artifact Conflicts and Updates

- **PRD:** Amend FR49 so new projects default to Paused across all creation paths, without changing existing project statuses. Add FR96-FR101 for a per-user Vision/Purpose/Principles profile, ongoing archivable Life Areas, Goal/Project Area associations, the Focus view, and optional Get Creative review. Clarify FR78/FR80/FR81 so persistence and exports include Focus profiles and Areas, including archived Areas. Existing FR93-FR95 from the 2026-10-01 proposal remain unchanged.
- **Architecture:** Update the project schema default from Active to Paused. The migration changes the column default only and does not update existing rows. Add a per-user focus-profile record (Vision, Purpose, Principles), an owner-scoped Areas table, and nullable Area references on Goals and goal-less Projects. Add RLS/ownership validation, the Goal/Area exclusivity constraint, and updated TypeScript schema types. Goal-linked Projects inherit Area through the Goal. Standalone Project Mode may accept an optional Area ID and must validate ownership before making an AI call or writing data.
- **UX Design / Experience:** Add `/app/focus` and a Focus navigation item; profile editing; Area create/edit/reorder/archive; roll-ups of linked Goals and Projects; optional Area selectors on Goal create/edit and standalone Project create/detail; inherited Area display for Goal-linked Projects; and a non-blocking Get Creative link. Keep H4/H5 inputs editable and avoid imposing a weekly edit cadence.
- **Goal semantics:** Do not infer a Goal's horizon from its target date or change the existing Goal meaning/date behavior in this proposal. The research source labels H3 as one-to-two-year goals/objectives but uses differing example ranges within the same article; treat horizon bands as perspective, not validation rules.
- **Project context:** No `AGENTS.md` is present. Epic 4 and Epic 5 context documents will need corresponding pointers/constraints when implementation stories are authored.
- **Secondary artifacts:** Add a Supabase migration, update `lib/supabase/schema.ts`, add route and component tests, update epic contexts and implementation specs, then sync `sprint-status.yaml` after final approval. No hosting, deployment, or AI-provider change is needed. The AI generation request contract changes only to accept an optional Area ID for standalone Project Mode; Goal generation uses the Goal's Area. Existing Story 6.1 exports Focus profiles, Areas, and archived Areas under FR80.

### Technical Impact and Risks

- The project default migration must use `ALTER COLUMN ... SET DEFAULT 'paused'` (or equivalent) without an `UPDATE`; existing Active/Paused/Completed/Archived rows retain their status.
- Composite owner-matched foreign keys must reject cross-user Area references even on direct Data API writes; authenticated routes also validate Area ownership. Project Mode validates a supplied Area before spending an AI request.
- The database and API must prevent a Project from having both a Goal and a direct Area. Goal-linked Project views resolve Area through the Goal.
- Area archival hides an Area from new assignment choices but preserves existing references. Areas are never Completed.
- Supabase route/component tests currently mock the database. Add migration validation where the existing test infrastructure permits; otherwise record real-Postgres RLS/constraint execution as a verification limitation rather than claiming it is covered by mocked tests.

## 3. Recommended Approach

**Selected path: Direct adjustment plus one new feature epic.**

Keep the existing Goal -> Project -> Action hierarchy and add Area as an optional higher-level relationship. Store H4/H5 context once per user rather than copying it onto each Goal or Project. Support direct Area assignment only for standalone Projects; Goal-linked Projects inherit Area, avoiding duplicate associations. Keep the Focus review optional.

- **Effort:** Medium; estimate 7-10 focused engineering days, including migration, UI, route changes, and focused tests. This is a planning estimate, not a release commitment.
- **Risk:** Medium. Main risks are RLS/owner validation, keeping Goal/Area relationships consistent, and touching three project-creation paths. Nullable fields, an additive migration, explicit ownership checks, and no existing-row status updates limit migration risk.
- **Timeline:** Approximately 7-10 engineering days plus story-spec and review time. Schedule Epic 7 after the current GTD review work and before lower-priority data portability Epic 6. Keep current Epic 6 numbering.
- **Potential rollback:** Not recommended. Reverting the default would reintroduce the unwanted Active/stuck behavior; rollback is not required to implement Areas.
- **MVP review:** The product scope expands, but no core goal-generation or Goal meaning change is needed. This is an additive extension of Archer's GTD model, not a reason to reduce the MVP.
- **Scope classification:** Moderate - backlog additions span existing create/status paths plus a new schema-backed feature epic; no fundamental product replan is required.

## 4. Detailed Change Proposals

All proposals below were presented individually in Incremental mode and approved by the user. The complete Sprint Change Proposal was approved on 2026-10-04.

### PRD

**Project creation status / FR49**

**OLD:** FR49 lists Active, Paused, Completed, and Archived, but does not set the creation default. The schema default is Active.

**NEW:** Amend FR49: each newly created project defaults to Paused across manual creation, standalone AI Project Mode, and goal-generated creation. The user activates a project when ready. Existing project statuses are unchanged.

**Rationale:** New work should not appear in Engage or be flagged as stuck before the user is ready to pick it up.

**Focus profile and Areas / proposed FR96-FR99**

**OLD:** No persistent Vision, Purpose, Principles, or Areas of Focus; no Area relationship for Goals or standalone Projects.

**NEW:** A user can edit one personal Vision/Purpose/Principles profile; create and manage ongoing Life Areas; optionally assign a Goal to one Area; and assign a standalone Project directly to one Area. Goal-linked Projects inherit the Area through the Goal. Areas can be archived but not completed. Add the Focus view and non-blocking Get Creative entry point. Include these records in the existing all-data persistence and export requirements.

**Rationale:** Captures the missing H4/H5 context and H2 ongoing responsibilities without redefining Goals as Projects or Areas.

### Architecture

**Project status default**

**OLD:** `projects.status` defaults to `active`; create paths rely on the database default.

**NEW:** The default becomes `paused`; creation paths explicitly write `paused`; the migration changes only the default and leaves existing rows unchanged. The Active + no committed action stuck rule remains.

**Rationale:** Aligns persistence and endpoint behavior with FR49 and Story 4.7.

**Focus and Area model**

**OLD:** No Focus profile or Areas table; Goal/Project relationships contain no Area references.

**NEW:** Add one owner-scoped profile per user with Vision, Purpose, and Principles; add owner-scoped Areas with name, description, ordering, and archive state; add nullable Area references on Goals and standalone Projects; enforce that a Project is linked to a Goal or directly to an Area, not both. Composite owner-matched foreign keys prevent cross-user Area links; Goal-linked Projects inherit Area through the Goal. Enforce authenticated-only least-privilege grants, owner-scoped RLS, route validation, and schema types; do not grant hard-delete access for Focus records.

**Rationale:** Keeps user-level direction separate from ongoing Areas and finite outcomes.

### Stories and Epics

**Story 4.7: New Projects Start Paused**

**OLD:** The manual, standalone AI, and goal-generated project inserts use the Active database default.

**NEW:** A focused story changes the schema default and all three insertion paths to Paused, adds tests, and explicitly prevents a data backfill.

**Rationale:** A single cross-path acceptance story prevents creation flows from diverging.

**Epic 7: Focus Horizons & Areas of Focus**

**OLD:** No modeled H4/H5 context or H2 Areas; Epic 6 data portability follows Epic 5.

**NEW:** Add Epic 7 after Epic 5 and before Epic 6, without renumbering Epic 6. Stories 7.1-7.4 cover persistence, the Focus page, Goal/Project Area assignment, and optional Get Creative review.

**Rationale:** Groups a related schema/UI/review feature into an actionable backlog unit and gives the core GTD model priority over portability work.

### UX Design and Experience

**Focus surface and assignments**

**OLD:** No Focus route/navigation, no Area CRUD, and no Area selectors in Goal or standalone Project flows.

**NEW:** Add `/app/focus` with profile editing and Area create/edit/reorder/archive plus Goal/Project roll-ups. Add optional Area selection to Goal create/edit and standalone Project create/detail. Goal-linked Projects show inherited Area and cannot select a second Area.

**Rationale:** Makes the data discoverable and connected to current work without introducing a second project hierarchy.

**Get Creative**

**OLD:** No Areas or higher-level Focus entry in Get Creative.

**NEW:** Add an optional Focus review entry that displays Areas and their linked work, with a path to `/app/focus`. It does not block phase or review completion and imposes no weekly Vision/Purpose editing cadence.

**Rationale:** Supports reflection without adding a mandatory weekly questionnaire.

## 5. Implementation Handoff

**Scope:** Moderate.

**Recipients and responsibilities:**

- **Product Owner (Mthizo):** Confirm priority and sequencing; retain the accepted Goal semantics, Paused default, Area inheritance, and non-blocking review behavior.
- **Developer:** Author implementation specs; implement the migration, types, ownership checks, project defaults, Focus page, selectors, and review entry; add focused tests and update sprint tracking after approval.
- **Architecture/schema reviewer:** Verify migration ordering, RLS policies, Goal/Area consistency constraints, and the no-backfill guarantee.

**Success criteria:**

- Manual, standalone AI, and goal-generated new Projects persist as Paused; existing project statuses are unchanged.
- A user can save Vision, Purpose, and Principles and manage Areas without completion status.
- Goals can link to an Area; standalone Projects can link directly to an Area; Goal-linked Projects inherit it and cannot have conflicting direct assignments.
- Cross-user Area assignment is rejected before writes; standalone AI requests validate ownership before provider calls.
- Database composite foreign keys independently reject forged cross-owner Area references.
- The Focus page shows Area roll-ups and links to existing Goal/Project detail pages.
- The existing all-data export includes Focus profiles, Areas, and archived Areas with their associations.
- Get Creative offers Focus review without blocking completion or requiring weekly H4/H5 edits.
- Typecheck, lint, focused tests, full test suite, and build pass. Migration/RLS claims are validated against a real database where available; mocked route tests are not described as DB integration coverage.

## Checklist Progress

- [x] 1.1 Triggering issue identified: new Projects are Active immediately; no input/model for H2/H4/H5.
- [x] 1.2 Problem categorized as a new stakeholder requirement and missing GTD focus model.
- [x] 1.3 Evidence gathered from PRD, architecture, migration, creation routes, GTD references, and official online research.
- [x] 2.1-2.5 Epic impact assessed; no existing epic is invalidated; Epic 7 is proposed before Epic 6.
- [x] 3.1-3.4 PRD, architecture, UX, project context, tests, and migration implications assessed.
- [x] 4.1 Direct adjustment plus Epic 7 selected; rollback and MVP reduction not recommended.
- [x] 5.1-5.5 Issue, artifact changes, MVP impact, implementation actions, and handoff drafted.
- [x] 6.1-6.2 Proposal checked for scope and consistency.
- [x] 6.3 Complete proposal approved by the user on 2026-10-04.
- [x] 6.4 `sprint-status.yaml` updated: Story 4.7 and Epic 7 Stories 7.1-7.4 added with backlog status; existing story statuses retained.
- [x] 6.5 Handoff roles and success criteria defined.

## Approval Gate

The complete proposal and its individual changes were approved by the user on 2026-10-04. The PRD, architecture spine, epic breakdown, UX Experience/Design contracts, and sprint tracker now reflect the approved changes. Implementation code and implementation story-spec files have not been changed. **Handoff:** Product Owner / Developer coordination prioritizes the Moderate-scope stories; the Developer authors implementation specs, implements the migration and UI/API changes, and verifies the success criteria. The architecture/schema reviewer checks RLS, Area ownership, relationship constraints, and the no-backfill guarantee.
