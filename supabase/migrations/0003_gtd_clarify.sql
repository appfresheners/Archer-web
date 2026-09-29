-- 0003_gtd_clarify.sql — Archer v1-full: GTD clarify/organize outcomes (Story 5.2)
-- =============================================================================
-- The Clarify Wizard walks a captured inbox item through the canonical GTD
-- decision tree. This migration extends the data layer so every outcome of
-- that flow can be represented:
--
--   1. actions.project_id becomes NULLABLE — an action created during clarify
--      defaults to STANDALONE (no parent project). Existing project-bound
--      actions are unaffected.
--   2. actions.delegated_to text — who a `waiting` (delegated) action is
--      waiting on. NULL for non-delegated actions.
--   3. actions.scheduled_for date — the calendar date a deferred action is
--      tied to (a badge only; there is no calendar UI). NULL otherwise.
--   4. action_status gains 'waiting' — a delegated/waiting-for action.
--   5. inbox_processing_status gains 'someday' and 'reference' — the two
--      non-actionable terminal states beyond 'trashed'.
--
-- ENUM ORDERING (Postgres constraint):
--   `ALTER TYPE ... ADD VALUE` cannot run in the same transaction that then
--   USES the new value. The three `add value` statements are therefore the
--   FIRST top-level statements in this file, before any column/DML work that
--   could reference them. `supabase db push` runs statements individually; if
--   applied via the SQL editor, run the enum adds first (they are already
--   ordered first here). `add value if not exists` makes each idempotent.
--
-- fn_commit_action is UNCHANGED (see 0001). Its
--   `where project_id = new.project_id`
-- never matches a NULL project_id (`= NULL` is unknown in SQL), so standalone
-- committed actions never decommit one another — each is independent. That is
-- GTD-correct (single-next-action is a per-project rule) and intentional.
--
-- Idempotent: enum adds use `if not exists`; column adds use `if not exists`;
-- the NOT NULL drop is a no-op once applied. Does NOT edit 0001/0002.
-- Apply with the Supabase CLI (`supabase db push`) or the SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum additions — FIRST, before any use (see header note on txn ordering).
-- -----------------------------------------------------------------------------

alter type action_status add value if not exists 'waiting';

alter type inbox_processing_status add value if not exists 'someday';
alter type inbox_processing_status add value if not exists 'reference';

-- -----------------------------------------------------------------------------
-- 2. actions.project_id → nullable (standalone actions).
-- -----------------------------------------------------------------------------

alter table actions
  alter column project_id drop not null;

comment on column actions.project_id is
  'Parent project. NULL for a STANDALONE action created during inbox clarify (Story 5.2) — an action that belongs to no project.';

-- -----------------------------------------------------------------------------
-- 3. New action columns for the delegate + defer-to-calendar outcomes.
-- -----------------------------------------------------------------------------

alter table actions
  add column if not exists delegated_to text;

comment on column actions.delegated_to is
  'Who a waiting/delegated action is waiting on. Set when status = ''waiting''; NULL otherwise. (Story 5.2)';

alter table actions
  add column if not exists scheduled_for date;

comment on column actions.scheduled_for is
  'Calendar date a deferred action is tied to (surfaced as a badge; there is no calendar UI). NULL when not scheduled. (Story 5.2)';
