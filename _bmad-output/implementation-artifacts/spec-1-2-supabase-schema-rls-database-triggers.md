---
title: "Supabase Schema, RLS & Database Triggers"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "93a63168bf214bd617b455f75dd4034f187076ee"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
  - "{project-root}/_bmad-output/planning-artifacts/architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer's v1-full data layer does not exist yet. Every later feature (goals, projects, actions, inbox, reviews) needs a fully provisioned Supabase schema with per-user row-level security, enum-typed statuses, the GTD invariants enforced at the database layer, and an authoritative TypeScript type source. There is no `supabase/` directory, no migration, and no `lib/supabase/schema.ts`.

**Approach:** Author a single idempotent SQL migration encoding the six-table schema exactly as defined in the Architecture Spine (goals, projects, actions, inbox_items, review_sessions, weekly_snapshots) plus the five enum types, RLS default-deny policies on every table, the `fn_set_updated_at` and `fn_commit_action` functions with their triggers, and the two spine additions (`goals.last_checked_at`, `projects.planning_depth`). Hand-author `lib/supabase/schema.ts` as the authoritative TypeScript type source matching the DDL. Set up minimal Supabase CLI project structure so the migration is runnable via `supabase db`.

## Boundaries & Constraints

**Always:**

- Encode the schema verbatim from the Architecture Spine Schema section: six tables with the exact columns, checks, FK on-delete rules, indexes, enum types, RLS policies, and the two triggers/functions.
- Apply the two spine additions: `goals.last_checked_at timestamptz` (nullable) and `projects.planning_depth` — a new enum `planning_depth` (`minimal | full_gtd`) column, `not null default 'minimal'`.
- FK rules: `actions.project_id` → projects `on delete cascade`; `projects.goal_id` → goals nullable `on delete set null`; every user-owned table has `user_id uuid not null references auth.users(id) on delete cascade`.
- RLS: `enable row level security` on all six tables + a `user_id = auth.uid()` policy (using + with check) on each. A table without RLS or without a user_id policy is a defect.
- `fn_set_updated_at` maintains `updated_at BEFORE UPDATE` on all six tables (spine lists five triggers; also add the trigger to `weekly_snapshots` only if it has `updated_at` — it does not, so it is excluded; keep the spine's five).
- `fn_commit_action` runs `BEFORE UPDATE` on `actions` and decommits any other committed action on the same project when one becomes committed.
- The migration must be idempotent-safe to re-read (use `create type ... ` guarded appropriately, or document run-once ordering); enums created before tables that use them.
- `lib/supabase/schema.ts` reflects the DDL exactly (enum unions, Row/Insert/Update per table) and is the authoritative type source.

**Ask First:**

- Any deviation from the spine's column names, types, checks, or FK on-delete behavior.
- Adding a Supabase dependency version — pin exact versions.

**Never:**

- Do not create `lib/supabase/client.ts`, `server.ts`, `middleware.ts`, or `middleware.ts` route guard — those belong to Story 1.3.
- Do not build auth pages, app shell, or any UI.
- Do not weaken RLS (no permissive/public policies, no disabling RLS).
- Do not hard-delete semantics for goals/projects/actions (soft delete via status is the model).

## I/O & Edge-Case Matrix

| Scenario              | Input / State                                                                                      | Expected Output / Behavior                                                                     | Error Handling                     |
| --------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| Commit an action      | An action on project P set `status = 'committed'` while another action on P is already `committed` | The previously committed action on P is set back to `available`; only the new one is committed | Trigger no-ops if status unchanged |
| Row update            | Any row on a table with `updated_at` is updated                                                    | `updated_at` is set to `now()` by `fn_set_updated_at`                                          | N/A                                |
| Cross-user read       | User A queries a row owned by user B                                                               | Zero rows returned (RLS default-deny)                                                          | N/A                                |
| Project depth default | Insert a project without `planning_depth`                                                          | Row stored with `planning_depth = 'minimal'`                                                   | N/A                                |
| Goal delete           | A goal with linked projects is deleted                                                             | Linked `projects.goal_id` set to NULL (projects survive, per `on delete set null`)             | N/A                                |
| Project delete        | A project with actions is deleted                                                                  | Its actions are cascade-deleted                                                                | N/A                                |

## Code Map

- `supabase/migrations/0001_init_schema.sql` -- **new.** The full DDL: enums → tables (goals, projects, actions, inbox_items, review_sessions, weekly_snapshots) → indexes → RLS enable+policies → functions (`fn_set_updated_at`, `fn_commit_action`) → triggers. Source of truth is the Architecture Spine "## Schema" section (enums, six `create table` blocks, functions/triggers), extended with `goals.last_checked_at` and the `planning_depth` enum + `projects.planning_depth`.
- `supabase/config.toml` -- **new.** Minimal Supabase CLI project config so `supabase db` commands can target the migration. Keep default local ports.
- `lib/supabase/schema.ts` -- **new.** Hand-authored TypeScript types mirroring the DDL: enum string-union types (`GoalStatus`, `ProjectStatus`, `ActionStatus`, `InboxProcessingStatus`, `ReviewPhase`, `PlanningDepth`), and a `Database` shape with Row/Insert/Update per table. Authoritative type source consumed by later stories.
- `.env.example` (root) -- reference only; Supabase env vars are owned by Story 1.3. Do not edit here unless a schema-run var is strictly required.
- Architecture Spine `## Schema` (context file) -- canonical DDL. Spine lists `fn_set_updated_at` triggers on goals/projects/actions/inbox_items/review_sessions (5 tables — weekly_snapshots has no `updated_at`).

## Tasks & Acceptance

**Execution:**

- [x] `supabase/migrations/0001_init_schema.sql` -- Author the complete schema DDL from the spine (5 enums + `planning_depth` enum; 6 tables with exact columns/checks/FKs/indexes incl. `goals.last_checked_at` and `projects.planning_depth`; RLS enable + `user_id = auth.uid()` policy per table; `fn_set_updated_at` + 5 triggers; `fn_commit_action` + trigger) -- the persistence backbone every later story depends on.
- [x] `supabase/config.toml` -- Add minimal Supabase CLI project config so the migration is runnable via `supabase db reset` / `supabase db push` -- makes the migration applicable and testable.
- [x] `lib/supabase/schema.ts` -- Hand-author enum union types and the `Database` Row/Insert/Update types mirroring the DDL exactly -- authoritative TypeScript type source for all data access.

**Acceptance Criteria:**

- Given the migration, when the schema is applied, then the six tables (goals, projects, actions, inbox_items, review_sessions, weekly_snapshots) exist; the goal_status, project_status, action_status, inbox_processing_status, review_phase enum types are created; `goals` has `last_checked_at timestamptz`; and `projects` has `planning_depth` (enum `minimal | full_gtd`, default `minimal`).
- Given the FK constraints, when inspected, then an action references a project `on delete cascade`, a project references a goal (`goal_id` nullable, `on delete set null`), and every user-owned table carries `user_id uuid not null references auth.users(id) on delete cascade`.
- Given RLS is enabled on every table, when a user queries any table, then they can read and write only rows where `user_id = auth.uid()`; a table without RLS or without a user_id policy is a defect.
- Given the database functions, when inspected, then `fn_set_updated_at` maintains `updated_at` on update, and `fn_commit_action` runs `BEFORE UPDATE` on `actions` and decommits any other committed action on the same project when one becomes committed.
- Given the DDL, when TypeScript types are generated, then `lib/supabase/schema.ts` reflects the schema and is the authoritative type source (type-checks under `tsc`).

## Design Notes

The spine's Schema section is the exact source — copy column definitions, checks, and indexes verbatim rather than paraphrasing. Two additions only: `goals.last_checked_at timestamptz` (nullable) and a new `planning_depth` enum consumed by `projects.planning_depth not null default 'minimal'`. Order the migration: enums first, then tables (goals → projects → actions → inbox_items → review_sessions → weekly_snapshots so FKs resolve), then indexes, then RLS, then functions, then triggers.

Live application requires a provisioned Supabase project (owned by 1.3's wiring + env). In this environment, verification is SQL validity + `tsc` type-check of `schema.ts`; note if a local Postgres/Supabase CLI is unavailable so the human can run `supabase db reset` against their instance.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: `lib/supabase/schema.ts` compiles with no type errors.
- `supabase db reset` (if the Supabase CLI + local stack are available) -- expected: migration applies cleanly, all objects created. If unavailable, state so and fall back to manual SQL inspection.

**Manual checks:**

- Inspect `0001_init_schema.sql`: all six tables, five status enums + `planning_depth`, `goals.last_checked_at`, `projects.planning_depth default 'minimal'`, correct FK on-delete rules, `enable row level security` + a `user_id = auth.uid()` policy on every table, `fn_set_updated_at` triggers on the five tables with `updated_at`, and `fn_commit_action` `BEFORE UPDATE` on actions with the decommit logic.
- Confirm `schema.ts` enum unions and per-table Row/Insert/Update types match the columns and nullability in the DDL.

## Suggested Review Order

**Schema DDL (the core of the change)**

- Entry point — enum types define the status vocabulary every table and the TS types depend on.
  [`0001_init_schema.sql:21`](../../supabase/migrations/0001_init_schema.sql#L21)

- The six tables with FK on-delete rules and the two spine additions (`goals.last_checked_at`, `projects.planning_depth`).
  [`0001_init_schema.sql:64`](../../supabase/migrations/0001_init_schema.sql#L64)

- RLS: default-deny + `user_id = auth.uid()` policy on every table — the per-user isolation guarantee.
  [`0001_init_schema.sql:243`](../../supabase/migrations/0001_init_schema.sql#L243)

- `fn_commit_action` — the single-committed-action-per-project invariant enforced at the DB layer.
  [`0001_init_schema.sql:300`](../../supabase/migrations/0001_init_schema.sql#L300)

- `fn_set_updated_at` + triggers on the five tables that carry `updated_at`.
  [`0001_init_schema.sql:288`](../../supabase/migrations/0001_init_schema.sql#L288)

**Types**

- Authoritative TS types mirroring the DDL — enum unions + Row/Insert/Update per table.
  [`schema.ts:24`](../../lib/supabase/schema.ts#L24)

**Config (peripheral)**

- Minimal Supabase CLI config so the migration is runnable via `supabase db reset`.
  [`config.toml:8`](../../supabase/config.toml#L8)
