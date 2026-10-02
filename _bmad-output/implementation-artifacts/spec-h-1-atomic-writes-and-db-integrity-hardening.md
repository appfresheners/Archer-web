---
title: "Atomic Writes & DB Integrity Hardening"
type: "hardening"
created: "2026-10-02"
status: "done"
route: "dispatch"
review_loop_iteration: 0
context: []
baseline_commit: "6c11789c24ada9e5219d303fb0027dfdf11668d8"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four multi-row write flows — generate-and-save (goals→projects→actions), goal soft-delete cascade, project regeneration, and action reorder — execute as sequences of independent Supabase calls with manual, best-effort rollback, so a mid-sequence failure can leave the database half-written. The database also trusts the app for invariants it should enforce itself: at most one committed action per project, child rows owned by their parent's owner, impossible rows, and immutable weekly snapshots.

**Approach:** Move each multi-row write into a single Postgres function executed as one atomic RPC. Harden the commit-action path with an INSERT guard, row locking, and a partial unique-index backstop. Add schema-level integrity — cross-owner ownership guards, CHECK constraints, a snapshot immutability guard, and the missing FK indexes — so the DB enforces what the app currently only promises.

## Boundaries & Constraints

**Always:** Preserve the external HTTP API contract (same routes, request/response JSON, status codes). Keep all writes RLS-scoped (`user_id = auth.uid()`). Add only new dated migrations under `supabase/migrations/`; never edit existing ones. Existing valid rows remain valid. The single-committed-action invariant must hold at the DB layer, not just the UI. Standalone actions (`project_id IS NULL`) stay independent (no cross-action decommit). Existing rows that would violate a new constraint stop the migration loudly (a pre-check reports the violating rows and aborts) — never silently mutate data.

**Never:** No UI/component changes (H-2 and H-4 own the a11y and cursor work). No enum or column-type changes. No replacement of existing FKs with composite FKs — use additive triggers. No whole-table locks. No changes to read paths or client query-builder reads.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Generate-save success | goal + projects + actions | All rows persisted; goal returned | N/A |
| Generate-save mid-failure | projects insert fails after goal insert | Nothing persisted | RPC rolls back; 500 with friendly message |
| Goal delete | active goal with projects/actions | Goal archived; its projects archived atomically | N/A |
| Regenerate | project with existing actions | Project row updated, actions replaced atomically | N/A |
| Reorder | N action ids | All sort_order values updated atomically | 400 on id-set mismatch; no partial order on failure |
| Concurrent commits | two updates to `committed` on one project | Exactly one committed action remains | loser gets friendly 409 |
| Direct INSERT of committed action | INSERT status=`committed` | Rejected or decommitted per invariant | trigger/constraint |
| Cross-owner child | child row user_id ≠ parent owner | Rejected | trigger raise |
| Impossible row | week_number 0, or week_end_date < week_start_date | Rejected | CHECK violation |
| Snapshot UPDATE/DELETE | existing weekly_snapshot row | Rejected | trigger raise |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0001_init_schema.sql` — authoritative schema: tables, enums, `fn_commit_action` (BEFORE UPDATE only, no lock), `set_updated_at`, `commit_action_trigger`, per-table RLS. Do not edit; new work goes in dated migrations.
- `supabase/migrations/0003_gtd_clarify.sql` — made `actions.project_id` nullable and added `waiting` status; informs standalone-action independence.
- `lib/supabase/schema.ts` — hand-authored `Database` type; `Functions: Record<string, never>` (line 353) needs RPC signatures.
- `lib/supabase/server.ts` — `createClient()` server client used by all API routes.
- `app/api/generate/route.ts` — `saveGoalBreakdown` (~465-560) inserts goal→projects→actions sequentially with manual rollback; project-save path (~230-285).
- `app/api/goals/[id]/route.ts` — DELETE archives projects then goal sequentially.
- `app/api/projects/[id]/regenerate/route.ts` — POST updates project, deletes actions, inserts new; best-effort restore.
- `app/api/projects/[id]/actions/route.ts` — PATCH reorder (~215-230) row-by-row `.update` loop.
- `app/api/actions/[id]/commit/route.ts` — POST sets committed; must surface the new backstop violation.
- `lib/actions/validate.ts` (`sanitizeActionPatch`) / `lib/actions/create.ts` (`sanitizeActionCreate`) — client-side guards; leave as-is.
- `app/api/**/route.test.ts` — colocated Vitest tests mocking `@/lib/supabase/server` with a query-builder mock; update mocks for `.rpc`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261002120000_atomic_writes.sql` — add `save_goal_breakdown`, `archive_goal_cascade`, `regenerate_project_actions`, `reorder_project_actions` functions (each `SECURITY INVOKER`, one transaction), grant to `authenticated` — single-call atomicity for the four multi-row flows
- [x] `supabase/migrations/20261002120100_commit_action_hardening.sql` — rewrite `fn_commit_action` (INSERT + UPDATE branches, `SELECT ... FOR UPDATE` on the project row) and add partial unique index `actions(project_id) WHERE status='committed'` — DB backstop for the single-committed invariant
- [x] `supabase/migrations/20261002120200_integrity_constraints.sql` — add cross-owner ownership triggers (goals→projects, projects→actions, projects→inbox `resolved_project_id`, review_sessions→weekly_snapshots), CHECK constraints (week_number 1..53, week_end_date >= week_start_date, completed_at >= started_at, inbox processed consistency), weekly_snapshots immutability trigger (block UPDATE/DELETE), and indexes on `inbox_items.resolved_project_id` and `weekly_snapshots.review_session_id` — declarative/triggered integrity
- [x] `lib/supabase/schema.ts` — add typed `Functions` entries for the four RPCs — typed `.rpc()` calls
- [x] `app/api/generate/route.ts` — replace `saveGoalBreakdown` sequential inserts with one `save_goal_breakdown` RPC; keep response shape — atomic generate-save
- [x] `app/api/goals/[id]/route.ts` — replace sequential archive with `archive_goal_cascade` RPC — atomic soft-delete cascade
- [x] `app/api/projects/[id]/regenerate/route.ts` — replace update+delete+insert with `regenerate_project_actions` RPC — atomic regeneration
- [x] `app/api/projects/[id]/actions/route.ts` — replace reorder loop with `reorder_project_actions` RPC — atomic reorder
- [x] `app/api/actions/[id]/commit/route.ts` — map the new unique-index/raise violation to a friendly 409 — graceful concurrency handling
- [x] `app/api/{generate,goals/[id],projects/[id]/regenerate,projects/[id]/actions,actions/[id]/commit}/route.test.ts` — update `@/lib/supabase/server` mocks to `.rpc` and add atomic-failure/edge cases from the I/O matrix — regression coverage

**Acceptance Criteria:**
- Given a generate-save whose projects insert fails, when the request completes, then no goal, project, or action rows were persisted
- Given a goal delete, when it completes, then the goal and all its projects are archived in one operation (no orphaned or partially-archived state on failure)
- Given a regenerate or reorder, when it fails partway, then the project/actions are unchanged
- Given two concurrent commits on the same project, when both complete, then at most one action is `committed`
- Given a direct INSERT with status=`committed`, when it runs, then the single-committed invariant still holds
- Given a child row whose `user_id` differs from its parent's owner, when inserted or updated, then it is rejected
- Given impossible rows (week_number out of 1..53, week_end_date before week_start_date), when inserted or updated, then they are rejected
- Given a weekly_snapshot row, when updated or deleted, then it is rejected
- Given the changed API routes, when `npm run test` and `npm run lint` run, then all tests pass and lint is clean

## Implementation Notes

- Implemented 3 dated migrations (atomic-write RPCs, commit-action hardening, integrity constraints), typed `Functions` in `lib/supabase/schema.ts`, converted 5 API routes to `.rpc`, and updated their colocated tests.
- Verification: `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds, and all 5 changed route test files pass (75 tests).
- `npm run test` overall: 31 pre-existing failures in `components/goals/WizardStep2.test.tsx` / `WizardStep3.test.tsx` — files H-1 does not touch and whose failures are unrelated to this change (present at baseline commit).
- Matrix audit: 6 app-level rows are covered by passing route tests. 4 DB-level rows (direct INSERT committed, cross-owner child, impossible row, snapshot immutability) are enforced by migration triggers/constraints; this repo has no SQL test harness, so those are verified by the migration pre-checks + manual migration apply (see Verification), not by an executable test — flagged for step-04 review.
## Spec Change Log

## Review Triage Log

- blind-hunter · "all tests pass" AC vs 31 pre-existing failures · false: Implementation Notes already reconcile this — the 31 failures are in `WizardStep2/3.test.tsx`, files H-1 does not touch, present at baseline.
- blind-hunter · 4 DB-level ACs have no executable test · defer: merged into the no-DB-harness entry below (user accepted migration-verified).
- blind-hunter · `regenerate_project_actions` lacks a project-row lock · defer: pre-existing interleave race (the old sequential delete/insert had it too); not introduced by this change.
- blind-hunter · `fn_check_snapshot_session_owner` missing `IS NOT NULL` guard · false: `weekly_snapshots.review_session_id` is `not null` (0001:204).
- blind-hunter · reorder uses SQLSTATE 22000 as mismatch sentinel · patch: merged into the malformed/non-UUID reorder 400 entry.
- blind-hunter · RPC `P0002` not mapped to 404 · patch: map P0002→404 in goals DELETE, regenerate, reorder.
- blind-hunter · `save_goal_breakdown` returns `{ id: data }` without a null guard · patch: add `!data` to the failure guard.
- blind-hunter · trigger/`do $$` blocks lack `set search_path` · low: rejected (unlikely everyday use; adds code to every trigger).
- blind-hunter · `drop index actions_committed_idx` name dependency · false: 0001 creates `actions_committed_idx` (0001:235), so the drop matches.
- blind-hunter · RPCs don't validate arguments · low: rejected (routes pre-validate; direct PostgREST abuse unlikely).
- blind-hunter · spec traceability fields empty · false: Review Triage Log is populated by this step; Spec Change Log fills only on a bad_spec loopback.
- blind-hunter · parent `user_id` change not re-validated against children · low: rejected (no code path mutates a parent's `user_id`).
- blind-hunter · archived goal re-archive / archived project regenerate · low: rejected (unlikely + would add status guards).
- edge-case-hunter · reorder non-UUID id now 500 instead of 400 · patch: validate UUIDs up front and return 400.
- edge-case-hunter · goals DELETE `P0002` → 500 instead of 404 · patch: merged into the P0002→404 entry.
- edge-case-hunter · regenerate `P0002` → 500 instead of 404 · patch: merged into the P0002→404 entry.
- edge-case-hunter · reorder `P0002` → 500 instead of 404 · patch: merged into the P0002→404 entry.
- edge-case-hunter · save RPC null data → 200 `{ id: null }` · patch: merged into the null-guard entry.
- edge-case-hunter · CHECK `ADD CONSTRAINT` takes an ACCESS EXCLUSIVE lock at migration · low: rejected (migration-time only; prod note, not a runtime defect).
- edge-case-hunter · reorder API contract drift for malformed requests · patch: merged into the non-UUID entry.
- verification-gap · four RPC functions' atomicity is never executed by a test · defer: no DB test harness exists; user accepted migration-verified (see deferred-work).
- verification-gap · `fn_commit_action` + partial unique index never executed · defer: merged into the no-DB-harness entry.
- verification-gap · reorder set-mismatch detection moved into SQL and only mocked · defer: merged into the no-DB-harness entry.
- verification-gap · integrity constraints/triggers never executed · defer: merged into the no-DB-harness entry.
- verification-gap · `planning_detail` stores JSON null instead of SQL NULL · patch: `nullif(..., 'null'::jsonb)` in the regenerate RPC.
- verification-gap · reorder 400 contract narrowed · patch: merged into the non-UUID entry.

## Design Notes

- **Cross-owner guard via triggers, not composite FKs.** Composite FKs (`(user_id, goal_id) REFERENCES goals(user_id, id)`) would require adding `UNIQUE (user_id, id)` to every parent and replacing existing FKs — more migration risk for the same guarantee. Additive `BEFORE INSERT OR UPDATE` triggers that raise when a child's `user_id` does not match its parent's owner keep existing FKs intact.
- **Commit backstop = partial unique index + trigger.** `CREATE UNIQUE INDEX ... ON actions(project_id) WHERE status='committed'` enforces at most one committed action per project even under concurrency (Postgres unique indexes serialize); the trigger's decommit keeps siblings clean in the normal path, and the `FOR UPDATE` lock on the project row serializes the commit transaction. `project_id IS NULL` rows are unaffected (NULLs are distinct in a unique index), preserving standalone-action independence.

## Verification

**Commands:**
- `npx tsc --noEmit` — expected: no type errors
- `npm run test` — expected: all tests pass, including updated route tests
- `npm run lint` — expected: clean
- `npm run build` — expected: successful build

**Manual checks (if no CLI):**
- Review each new migration applies cleanly to a fresh `supabase db reset` and to the existing dev DB (no constraint-violation aborts).
