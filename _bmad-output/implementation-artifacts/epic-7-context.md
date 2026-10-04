# Epic 7 Context: Focus Horizons & Areas of Focus

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal
Give signed-in users a persistent home for Vision, Purpose, Principles, and ongoing Life Areas, with optional links from Goals and standalone Projects so work can be understood in its broader context. The feature extends the existing GTD hierarchy without changing Goal meaning, lifecycle, or target-date behavior; Area roll-up during Get Creative remains optional.

## Stories
- Story 7.1: Focus Profile and Area Data Model
- Story 7.2: Focus Page and Area Management
- Story 7.3: Assign Goals and Projects to Areas
- Story 7.4: Optional Focus Review in Get Creative

## Requirements & Constraints
Maintain one personal Focus profile with optional Vision and Purpose text and a Principles list. Users can create, view, edit, reorder, and archive named Life Areas with optional descriptions. Areas represent ongoing responsibilities: they are never completed. Persist profile and Area data across sessions and protect it as user-owned data.

A Goal may belong to at most one Area. A Project may belong to a Goal or, only when it has no Goal, directly to an Area; Goal-linked Projects inherit their Area and must not store a second direct Area. Existing Goal and Project status, meaning, and date semantics remain unchanged. Get Creative may offer a Focus review, but skipping it must not block the phase or weekly review. Focus profile fields do not require weekly editing. Meet the app's responsive and WCAG 2.1 AA requirements.

## Technical Decisions
Use the authenticated Supabase-backed model. Store one `focus_profiles` row per user (`vision`, `purpose`, `principles`) and owner-scoped `areas_of_focus` rows with `name`, optional `description`, `sort_order`, and `archived_at`. Areas are archived, not completed or hard-deleted. Add nullable `area_id` references to Goals and standalone Projects.

Enable RLS and owner-scoped access for every Focus table. Enforce Area ownership in the database with owner-matched foreign keys and in authenticated mutation routes. Enforce Project parent exclusivity in the database (`goal_id` and direct `area_id` cannot both be set). When a Project becomes Goal-linked, clear its direct Area and derive the Area through the Goal. For standalone AI Project Mode, validate an optional Area ID against the signed-in user before calling the provider or writing data. Keep generated TypeScript database types aligned with the migration. Archived Areas remain attached to existing records but cannot be newly selected.

## UX & Interaction Patterns
Expose `/app/focus` in authenticated desktop and mobile navigation, using the established unframed section and form patterns. Present editable Vision, Purpose and Principles, followed by Life Areas with linked Goal and standalone Project rows, statuses, and links to existing detail pages. Provide keyboard-operable reordering and archive controls. Hide archived Areas from assignment selectors while continuing to show them on existing linked records.

Offer optional Area selection in Goal create/edit and standalone Project create/detail flows. For Goal-linked Projects, show the inherited Area and do not offer a direct Area selector. In Get Creative, show an optional Focus review entry with a link to `/app/focus`; leaving for Focus and returning must preserve the in-progress review. Keep the review skippable and do not ask users to revise Vision or Purpose weekly.

## Cross-Story Dependencies
Story 7.1 provides the schema, ownership protections, and types required by the page, assignment flows, and roll-ups. Story 7.2 and 7.3 integrate with Goal creation/editing and standalone Project creation/detail paths established in Epics 2–4. Story 7.4 extends the Get Creative phase from Epic 5 without changing its completion rules. Epic 6's existing export scope includes Focus profiles, Areas, associations, and archived Areas. Epic 7 is scheduled after Epic 5 and before Epic 6; Epic 6 retains its ID.