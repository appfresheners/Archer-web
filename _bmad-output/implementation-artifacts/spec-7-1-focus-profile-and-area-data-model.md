---
title: '7.1 Focus Profile and Area Data Model'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'bc3c2873a988efa2f4ca7233eafa16f6bd084b85'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer has no persisted model for a user's Vision, Purpose, Principles, or ongoing Life Areas. Goals and standalone Projects cannot yet reference those Areas securely.

**Approach:** Add the owner-scoped Focus profile and Areas schema, nullable Area relationships on Goals and standalone Projects, database-enforced ownership and parent exclusivity, least-privilege access, and matching TypeScript database types.

## Boundaries & Constraints

**Always:** Keep Focus data user-owned. Principles are a list; Vision and Purpose are optional text. Areas are ordered and archivable, never completed or hard-deleted. Enforce Area ownership and Project parent exclusivity in Postgres, including direct Data API writes. Preserve existing Goal and Project lifecycle, status, and date semantics.

**Never:** Implement the Focus page, navigation, assignment UI/routes, AI request changes, Get Creative review, exports, or unrelated schema cleanup. Do not add a direct Area relationship to a Goal-linked Project.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Profile uniqueness | Insert a second Focus profile for one user | Database permits at most one profile per user | Unique constraint rejects duplicate |
| Cross-owner Area link | Write another user's Area ID to a Goal or Project, including via Data API | No row is written | Composite owner-matched FK rejects the write |
| Conflicting Project parents | Project has both `goal_id` and direct `area_id` | No row is written | Check constraint rejects the write |
| Optional relationships | Goal has no Area; standalone Project has no Area | Both remain valid | N/A |

</frozen-after-approval>

## Code Map

- `supabase/config.toml` -- `schema_paths` is empty; this project uses imperative migrations. Generate the migration filename through the Supabase CLI.
- `supabase/migrations/0001_init_schema.sql` -- existing Goal/Project DDL, RLS policies, shared timestamps, and indexes to extend consistently.
- `supabase/migrations/20261002120200_integrity_constraints.sql` -- existing database integrity conventions; its trigger-only owner checks do not replace the required composite Area foreign keys.
- `_bmad-output/planning-artifacts/architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md` -- Focus table shapes, ownership keys, grants, indexes, and nullable Goal/Project Area references.
- `_bmad-output/planning-artifacts/epics.md` -- Story 7.1 acceptance criteria; keep all later Epic 7 story behavior out of this change.
- `lib/supabase/schema.ts` -- hand-authored authoritative `Database` Row/Insert/Update types; update in lockstep with the migration and preserve existing aliases.
- `supabase/tests/` -- no database tests exist yet. Supabase's pgTAP harness can verify grants, RLS, and database constraints; mocked route tests cannot prove these behaviors.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261004082751_focus_profile_areas.sql` -- create the Focus tables, RLS, grants, owner-matched foreign keys, nullable Goal/Project Area links, direct-parent check, and supporting indexes.
- [x] `lib/supabase/schema.ts` -- add Focus profile/Area Row, Insert, and Update shapes and reflect nullable `area_id` on Goals and Projects.
- [x] `supabase/tests/focus_profile_areas_test.sql` -- add pgTAP coverage for profile uniqueness, optional Area links, cross-owner Goal/Project links, parent exclusivity, owner-scoped RLS, and anon/hard-delete grants.

**Acceptance Criteria:**
- Given the migration is applied, when the Focus schema is inspected, then one profile per user supports optional Vision and Purpose plus a Principles list, and each user's named, optionally described Areas have ordering and archive state but no completion status.
- Given Goal and Project rows, when the migration is applied, then Goal `area_id` is nullable and Project `area_id` is nullable and valid only when `goal_id` is null; existing records remain valid without bulk data changes.
- Given any Focus read or mutation, when performed as `authenticated`, then RLS restricts access to the owner; `anon` has no access, and `authenticated` receives only required select/insert/update privileges with no hard-delete privilege.
- Given a Goal or Project references an Area, when its owner differs from the referencing row's owner, then the composite foreign key rejects the write, including direct Data API writes.
- Given a Project has both `goal_id` and direct `area_id`, when inserted or updated, then the database rejects it.
- Given generated database types are consumed, when `lib/supabase/schema.ts` is type-checked, then its Focus tables and nullable Goal/Project Area fields match the migration.
- Given the database test suite runs, when the Focus pgTAP tests execute, then every I/O matrix case and grant/RLS requirement is exercised and passes.

## Implementation Notes

- Added the Focus tables with explicit authenticated `SELECT`/`INSERT`/`UPDATE` grants and no client `DELETE` grant; RLS uses owner checks on each operation.
- Added composite `(user_id, area_id)` foreign keys for Goal and Project Area references and a check that prevents a Project from having both direct parents.
- Applied the complete migration chain to the local database with `npx --yes supabase@latest migration up --local`; no reset or remote operation was used.
- Added 33 pgTAP assertions covering profile uniqueness, nullable links, cross-owner rejects, Project parent exclusivity, owner isolation, and exact grants.

## Verification

**Commands:**
- `npx --yes supabase@latest migration up --local` -- passed: all pending migrations applied, including `20261004082751_focus_profile_areas.sql`.
- `npx --yes supabase@latest test db` -- passed: all 33 Focus pgTAP assertions.
- `npx tsc --noEmit` -- passed: database types and all consumers type-check.
- `npm run lint` -- passed.
- `npx vitest run` -- passed: 82 files, 869 tests.
- `npm run build` -- passed: production build completed.

**Manual checks (if no CLI):**
- If the Supabase CLI or local Postgres is unavailable, report database migration and pgTAP execution as unverified; do not treat manual SQL inspection or mocked tests as equivalent.

## Spec Change Log

## Review Triage Log

- **medium — defer:** `.vscode/settings.json` adds broad `test` and `printf` terminal auto-approvals. This is a separate editor-security concern, not part of the Focus schema change; left untouched and recorded in the deferred-work ledger.
- **false:** The finding that `supabase/.temp/start-secrets/.../docker.env` is included in reviewer content is disproved: that local secret file was excluded from the diff. The included `_current_branch` file is generated Supabase CLI metadata and demonstrates no application defect.
- **medium — defer:** The migration permits direct writes that attach an already-archived Area. The epic-level restriction concerns new assignment; no assignment flow is in this story, so the database-versus-selector enforcement decision is recorded for Story 7.3.
- **low — reject:** `areas_of_focus.name` rejects NULL but accepts blank text. No database-level nonblank rule is stated in the approved intent, and the future Area-entry flow can validate names; adding a new constraint here would expand the agreed data-model requirements.
- **low — reject:** Focus and Goal/Project type entries have empty `Relationships` arrays. This matches the established hand-authored schema convention across existing tables, and no typed embedded relationship query consumes these relations in this story.
- **medium — patch:** Project parent exclusivity and owner-matched Area foreign keys are enforced on update as well as insert, but the tests only covered inserts. Added update assertions for both cases to `supabase/tests/focus_profile_areas_test.sql`.
- **medium — defer:** The archived-Area direct-write finding from edge-case review has the same root cause and disposition as the blind-review finding above; recorded once in deferred work.
- **medium — patch:** RLS prevents changing an owned Focus profile or Area to another `user_id`, but no regression assertions covered that attempted transfer. Added both pgTAP checks.
- **low — patch:** The timestamp triggers are installed, but their refresh behavior was unasserted. Added profile and Area `updated_at` checks to pgTAP.