-- =============================================================================
-- 20261103_daily_shutdowns.sql — Daily Shutdown Flow (Story 10.1)
-- =============================================================================
-- Adds the `daily_shutdowns` table to support the daily closure ritual at
-- `/app/shutdown`. Each row records one completed shutdown: the timestamp,
-- optional intention for tomorrow (500 chars max), and computed RLS user_id.
--
-- One shutdown per calendar day per user — enforced at the DB layer via a
-- unique constraint on (user_id, date(completed_at)). Attempts to save a
-- duplicate are rejected by the database, and the UI shows the already-
-- completed state on reload.
--
-- RLS: users manage own daily shutdowns (policy using user_id = auth.uid()).
-- Trigger: updated_at is maintained by fn_set_updated_at (see 0001).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- daily_shutdowns
-- -----------------------------------------------------------------------------

create table if not exists daily_shutdowns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  completed_at    timestamptz not null default now(),
  intention       text,  -- optional, 500 char limit enforced in app layer
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table daily_shutdowns is
  'Daily shutdown completions. Each row records one completed shutdown with optional intention for tomorrow. One per calendar day per user (enforced by unique index).';

comment on column daily_shutdowns.intention is
  'Optional free-text intention for tomorrow (500 char limit enforced at app layer). NULL when user leaves blank.';

-- -----------------------------------------------------------------------------
-- Unique constraint: one completion per calendar day per user
-- -----------------------------------------------------------------------------
-- Using a unique index with an expression since PostgreSQL doesn't support
-- expression-based UNIQUE constraints in the table definition.

create unique index if not exists daily_shutdowns_user_date_unique
  on daily_shutdowns (user_id, (date(completed_at at time zone 'UTC')));

-- -----------------------------------------------------------------------------
-- Index: most recent shutdown per user (for "already completed today" check)
-- -----------------------------------------------------------------------------

create index if not exists daily_shutdowns_user_recent_idx
  on daily_shutdowns (user_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table daily_shutdowns enable row level security;

drop policy if exists "users manage own daily shutdowns" on daily_shutdowns;
create policy "users manage own daily shutdowns"
  on daily_shutdowns for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Trigger: updated_at maintenance (fn_set_updated_at already exists from 0001)
-- -----------------------------------------------------------------------------

drop trigger if exists set_updated_at_daily_shutdowns on daily_shutdowns;
create trigger set_updated_at_daily_shutdowns
  before update on daily_shutdowns
  for each row execute function fn_set_updated_at();
