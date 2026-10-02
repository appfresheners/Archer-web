# Epic 4 Context: Goal, Project & Action Management

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 4 turns the AI-generated breakdowns produced in Epics 2–3 into a living, editable system of record over the Goal → Project → Action hierarchy. A signed-in user can browse all their goals at a glance with status badges, open and edit a goal (statement, target date, gap analysis) and change its status, open and edit a single project or regenerate just that project without disturbing the rest, and fully manage a project's actions — add, edit, delete, reorder, and tag with context. The centerpiece is the GTD "one next action" discipline: exactly one committed next action per project (enforced at the database layer), with any project that is Active but has no committed action surfaced everywhere as visibly "stuck." This is the first epic where the user manages and mutates persisted data rather than only generating and reading it.

## Stories

- Story 4.1: Goals List & Status Badges
- Story 4.2: Goal Detail, Edit & Status Changes
- Story 4.3: Project Detail, Edit & Regeneration
- Story 4.4: Action Management & Context Tags
- Story 4.5: Commit a Single Next Action & Stuck Detection
- Story 4.6: Project-Goal Linking and Project Filtering

## Requirements & Constraints

Users must be able to create, view, edit, and delete goals. Editing goal fields must never auto-regenerate projects — regeneration is always a separate, explicit, confirmed action. Deleting a goal is a soft delete: linked projects and actions are archived and retained (still present in exports), never hard-deleted. Goals carry seven statuses (Active, Paused, Not now, Someday, Completed, Archived); setting a goal to Paused must remove its linked projects from the Engage view without deleting them.

Projects expose their name, parent-goal breadcrumb, purpose, and successful outcome, and a narrower status set (Active, Paused, Completed, Archived). Completing all of a project's actions must not auto-complete the project — completion is always explicit. Regenerating a project must show a confirmation modal before overwriting and, on confirm, replace only that one project's AI content while leaving sibling projects untouched.

Project-goal relationships are user-manageable from both project detail (set/change/clear the parent) and goal detail (attach an existing project). A project has at most one parent goal; moving between goals requires confirmation. The Projects index filters by all projects, a selected goal, or no-goal projects. Any server-side `goal_id` mutation must verify goal ownership in addition to project ownership.

Actions have text, a status (available / committed / done), and optional context tags. Users can add (inline), edit, delete, and reorder actions within a project. Context tags are optional `@energy` / `@location` / `@tool` values; an untagged action is valid.

The GTD invariant: at most one committed next action per project. Committing an available action decommits any previously committed action on that project, and this single-committed rule must be enforced by the database (the `fn_commit_action` trigger), not only in the UI. Completing a committed action prompts the user to pick the next committed action from the remaining available actions. A project that is Active with zero committed actions is "stuck" and must be surfaced with an amber indicator (`role="alert"`) everywhere it appears — the goals list shows an inline amber stuck count, project cards show a stuck band, and it is never hidden or rendered quietly.

All new UI meets WCAG 2.1 AA: full keyboard operation, ARIA roles/live regions, minimum 44×44px targets, 4.5:1 body / 3:1 large-text contrast, and respect for `prefers-reduced-motion`. No cookies beyond the Supabase Auth session; no analytics or tracking. Destructive actions (delete goal, regenerate project) sit behind explicit confirmation dialogs.

## Technical Decisions

The app is Next.js App Router with a Node runtime and a Supabase (Postgres) backend; all data is per-user and RLS-scoped (default-deny, `user_id = auth.uid()`). Data is fully structured — there is no stored markdown; goals, projects, and actions are normalized rows read and rendered directly.

The single-committed-action rule is a hard database invariant, not UI-only: a `BEFORE UPDATE` trigger on actions auto-decommits sibling committed actions when one transitions to committed. Epic 4 code should rely on this — committing is just an update to `status = 'committed'`, and the trigger handles the rest. Note the trigger fires on UPDATE only.

Goal status has six/seven values while project status is deliberately narrower (Active/Paused/Completed/Archived) — do not offer Someday/Not now on projects. Soft-delete/archive means flipping status to `archived`, not issuing SQL deletes; archived rows stay queryable for exports. Context tags are stored as a Postgres text array of `@key:value` strings (default empty), not JSONB.

Stuck detection has no database trigger or column — it is derived in application code as "project is Active and has zero committed actions" and must be computed wherever projects are rendered (goals list, project cards, and later the Engage view).

Project regeneration reuses the existing structured generation core rather than the markdown path: call the shared `generateProject(input, depth)` logic, then update the existing project row in place and replace its action rows, scoped to the one project id — this is an update-in-place flow, distinct from the insert-new-project flow the generation endpoint currently implements.

Conventions to follow: shared DB types are hand-authored and kept in lockstep with the migration (import types from the shared schema module, don't inline them); non-UI/browser logic and data access live in a `lib/` layer while components orchestrate; status-badge and warning color tokens already exist as design tokens and should be consumed rather than redefined. Simple CRUD mutations (status change, edit, reorder, tag, commit) have no established pattern yet in the codebase — Epic 4 establishes it; keep every mutation behind the authenticated, RLS-scoped client.

## UX & Interaction Patterns

Goals list: rows sorted Active-first (creation desc), then Paused, then Someday/Not now, then Completed/Archived; each row shows goal text (truncated ~2 lines), a status badge, target date, project count, a chevron, and an inline amber stuck count when the goal has stuck projects. Empty state is plain and directive ("No goals yet. Start one.") with a control that opens the Goal Creation Wizard.

Status Badge is a reusable inline pill with a distinct treatment per status (Active blue, Paused amber-on-subtle, Someday gray outline, Completed emerald-on-subtle, Archived gray, Not now red-on-subtle). No shared badge component exists yet — create one.

Action Item Row (also used later in Engage): checkbox — action text — optional context-tag chips. Available uses a default border; Committed uses a primary border + primary-subtle background so the single next action is unmistakable; Done uses line-through + muted text + checked checkbox.

Stuck Indicator: an amber warning band at the top of a project card (or inline in Engage) reading "No committed next action — this project is stuck." with a direct "Commit one now" CTA — amber signals attention, not destruction, and is never hidden. Modals are reserved for binary/destructive confirmations only (delete goal, regenerate project). Copy stays plain and non-celebratory — no streaks, confetti, or congratulatory metrics.

## Cross-Story Dependencies

4.1 (goals list) needs the status-badge treatment and the stuck-count derivation that 4.5 formalizes; build the shared StatusBadge and the "stuck = Active + zero committed" helper early since 4.1, 4.3, and 4.5 all consume them. 4.2 (goal detail) hosts the project cards that 4.3 (project detail/edit/regen) drills into, and its Paused-goal rule ("remove linked projects from Engage") is consumed by Epic 5's Engage view. 4.4 (action management) establishes the ActionItem row and context-tag shape that 4.5 (commit/stuck) and Epic 5 (Engage, filtering by context tag) both reuse — the `context_tags` shape must stay aligned with Epic 5. 4.5's commit behavior depends on the database trigger being relied upon rather than reimplemented, and its stuck indicator must be reused verbatim by Epic 5's Engage view.

Story 4.6 extends the 4.2/4.3 surfaces and reuses the existing project PATCH `goal_id` contract. The goal selector, attach flow, and list filter must preserve single-parent semantics and owner checks; no schema change is expected.
