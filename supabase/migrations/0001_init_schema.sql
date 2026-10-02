-- =============================================================================
-- 0001_init_schema.sql — Archer v1-full data layer
-- =============================================================================
-- Authoritative schema for the six-table Archer persistence backbone.
-- Source of truth: ARCHITECTURE-SPINE.md "## Schema" section (AD-9, AD-10,
-- AD-14), extended with two spine additions:
--   * goals.last_checked_at timestamptz (nullable) — drives the 30-day check.
--   * planning_depth enum + projects.planning_depth (not null default 'minimal').
--
-- Ordering: enums → tables (goals → projects → actions → inbox_items →
-- review_sessions → weekly_snapshots) → indexes → RLS → functions → triggers,
-- so FKs and enum references resolve in dependency order.
--
-- Idempotency: enum creation is guarded (create type only if absent) so the
-- migration can be re-read safely. Tables/indexes/policies use `if not exists`
-- and drop-before-create where the object type supports it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

do $$ begin
  create type goal_status as enum (
    'active', 'paused', 'not_now', 'someday', 'completed', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum (
    'active', 'paused', 'completed', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type action_status as enum (
    'available', 'committed', 'done'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type inbox_processing_status as enum (
    'unprocessed', 'processed', 'trashed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_phase as enum (
    'snapshot_open', 'get_clear', 'get_current', 'get_creative', 'snapshot_close', 'complete'
  );
exception when duplicate_object then null; end $$;

-- Spine addition: project planning depth
do $$ begin
  create type planning_depth as enum (
    'minimal', 'full_gtd'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- goals
-- -----------------------------------------------------------------------------

create table if not exists goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- core content
  goal_text       text not null check (char_length(goal_text) between 1 and 500),
  target_date     date not null,                            -- auto: 3 months from created_at
  status          goal_status not null default 'active',

  -- gap analysis (stored as JSONB — structure mirrors wizard inputs)
  skill_framework jsonb,   -- [{name, required_level, description, user_rating}]
  drivers         text[],  -- array of free-text driver strings
  barriers        text[],  -- array of free-text barrier strings
  if_then_plan    text,    -- "If X, then I will Y"

  -- AI output
  breakdown_md    text,    -- full generated markdown (goal breakdown)

  -- spine addition: drives the 30-day monthly-check prompt
  last_checked_at timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------

create table if not exists projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  goal_id          uuid references goals(id) on delete set null,
  -- goal_id nullable: Project Mode creates projects not linked to a goal

  -- core content
  name             text not null check (char_length(name) between 1 and 200),
  purpose          text,
  successful_outcome text,
  status           project_status not null default 'active',

  -- spine addition: persists the depth choice
  planning_depth   planning_depth not null default 'minimal',

  -- AI output
  breakdown_md     text,   -- raw generated markdown for this project

  -- ordering within a goal
  sort_order       integer not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- actions
-- -----------------------------------------------------------------------------

create table if not exists actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,

  -- core content
  text          text not null check (char_length(text) between 1 and 500),
  status        action_status not null default 'available',

  -- optional context tags
  context_tags  text[] default '{}',   -- e.g. ['@energy:high', '@location:home']

  -- ordering within a project
  sort_order    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- inbox_items
-- -----------------------------------------------------------------------------

create table if not exists inbox_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  raw_text            text not null check (char_length(raw_text) between 1 and 2000),
  processing_status   inbox_processing_status not null default 'unprocessed',

  -- set when processed → linked to a project
  resolved_project_id uuid references projects(id) on delete set null,

  captured_at         timestamptz not null default now(),
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- review_sessions
-- -----------------------------------------------------------------------------

create table if not exists review_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- week identity (ISO week)
  week_number           integer not null,   -- 1–53
  week_year             integer not null,
  week_start_date       date not null,      -- Monday
  week_end_date         date not null,      -- Sunday

  -- phase tracking
  current_phase         review_phase not null default 'snapshot_open',

  -- opening snapshot (written at snapshot_open → get_clear transition)
  opening_retrospective text,               -- "What actually moved last week? What didn't?"

  -- closing snapshot (written at snapshot_close → complete transition)
  closing_intention     text,               -- "What matters most this coming week?"
  closing_blocker       text,               -- "What's the main thing that could derail it?"

  -- timestamps
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- one in-progress session per user at a time
  unique (user_id, week_number, week_year)
);

-- -----------------------------------------------------------------------------
-- weekly_snapshots
-- -----------------------------------------------------------------------------

-- Immutable record of a completed week's closing snapshot.
-- Read by the *next* week's opening snapshot display.
create table if not exists weekly_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  review_session_id uuid not null references review_sessions(id) on delete cascade,

  week_number       integer not null,
  week_year         integer not null,
  week_start_date   date not null,
  week_end_date     date not null,

  -- the two closing snapshot fields
  intention         text not null,   -- "What matters most this coming week?"
  blocker           text not null,   -- "What's the main thing that could derail it?"

  -- the opening retrospective from the same session
  opening_retrospective text,

  created_at        timestamptz not null default now(),

  unique (user_id, week_number, week_year)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists goals_user_id_status_idx on goals (user_id, status);

create index if not exists projects_user_id_status_idx on projects (user_id, status);
create index if not exists projects_goal_id_idx on projects (goal_id);

create index if not exists actions_project_id_status_idx on actions (project_id, status);
create index if not exists actions_user_id_status_idx    on actions (user_id, status);
-- Partial index: fast lookup of committed actions
create index if not exists actions_committed_idx on actions (project_id)
  where status = 'committed';

-- Index: unprocessed items sorted by capture time
create index if not exists inbox_items_unprocessed_idx on inbox_items (user_id, captured_at)
  where processing_status = 'unprocessed';

-- Index: find latest session for a user
create index if not exists review_sessions_user_id_idx on review_sessions (user_id, week_year desc, week_number desc);

-- Index: fetch prior week snapshot efficiently
create index if not exists weekly_snapshots_user_week_idx on weekly_snapshots (user_id, week_year desc, week_number desc);

-- -----------------------------------------------------------------------------
-- Row-Level Security — default-deny, per-user access
-- -----------------------------------------------------------------------------

alter table goals            enable row level security;
alter table projects         enable row level security;
alter table actions          enable row level security;
alter table inbox_items      enable row level security;
alter table review_sessions  enable row level security;
alter table weekly_snapshots enable row level security;

drop policy if exists "users manage own goals" on goals;
create policy "users manage own goals"
  on goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users manage own projects" on projects;
create policy "users manage own projects"
  on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users manage own actions" on actions;
create policy "users manage own actions"
  on actions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users manage own inbox" on inbox_items;
create policy "users manage own inbox"
  on inbox_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users manage own review sessions" on review_sessions;
create policy "users manage own review sessions"
  on review_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users read own snapshots" on weekly_snapshots;
create policy "users read own snapshots"
  on weekly_snapshots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Shared updated_at trigger (applied to all tables with an updated_at column)
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- fn_commit_action: enforce single committed action per project.
-- Called when an action's status is set to 'committed'.
-- Decommits all other committed actions on the same project first.
create or replace function fn_commit_action()
returns trigger language plpgsql as $$
begin
  if new.status = 'committed' and old.status <> 'committed' then
    update actions
    set status = 'available'
    where project_id = new.project_id
      and id <> new.id
      and status = 'committed';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- updated_at maintenance on the five tables that carry updated_at
-- (weekly_snapshots is immutable and has no updated_at column — excluded).
drop trigger if exists set_updated_at on goals;
create trigger set_updated_at before update on goals
  for each row execute function fn_set_updated_at();

drop trigger if exists set_updated_at on projects;
create trigger set_updated_at before update on projects
  for each row execute function fn_set_updated_at();

drop trigger if exists set_updated_at on actions;
create trigger set_updated_at before update on actions
  for each row execute function fn_set_updated_at();

drop trigger if exists set_updated_at on inbox_items;
create trigger set_updated_at before update on inbox_items
  for each row execute function fn_set_updated_at();

drop trigger if exists set_updated_at on review_sessions;
create trigger set_updated_at before update on review_sessions
  for each row execute function fn_set_updated_at();

-- Single-committed-action-per-project enforcement at the DB layer (AD-10).
drop trigger if exists commit_action_trigger on actions;
create trigger commit_action_trigger
  before update on actions
  for each row execute function fn_commit_action();
