-- =============================================================================
-- 20261002120200_integrity_constraints.sql — schema-level integrity the app
-- currently only promises
-- =============================================================================
-- Adds:
--   1. Cross-owner ownership guards (BEFORE INSERT OR UPDATE triggers) so a
--      child row can never belong to a different user than its parent:
--        goals → projects (goal_id)
--        projects → actions (project_id)
--        projects → inbox_items (resolved_project_id)
--        review_sessions → weekly_snapshots (review_session_id)
--   2. CHECK constraints for impossible rows:
--        week_number 1..53, week_end_date >= week_start_date (both review
--        tables), completed_at >= started_at (review_sessions), and inbox
--        processed_at ↔ processing_status consistency.
--   3. A weekly_snapshots immutability trigger that blocks UPDATE and DELETE.
--   4. The two missing FK indexes.
--
-- Every constraint is additive; existing FKs and per-table RLS are untouched.
-- A pre-check reports and aborts when existing rows would violate a new
-- constraint — never silently mutates data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-checks — abort loudly on any existing violating row.
-- -----------------------------------------------------------------------------

do $$ begin
  if exists (
    select 1
    from projects p
    join goals g on g.id = p.goal_id
    where p.goal_id is not null and p.user_id <> g.user_id
  ) then
    raise exception 'Migration aborted: projects exist whose goal has a different owner';
  end if;
end $$;

do $$ begin
  if exists (
    select 1
    from actions a
    join projects p on p.id = a.project_id
    where a.project_id is not null and a.user_id <> p.user_id
  ) then
    raise exception 'Migration aborted: actions exist whose project has a different owner';
  end if;
end $$;

do $$ begin
  if exists (
    select 1
    from inbox_items i
    join projects p on p.id = i.resolved_project_id
    where i.resolved_project_id is not null and i.user_id <> p.user_id
  ) then
    raise exception 'Migration aborted: inbox items exist whose resolved project has a different owner';
  end if;
end $$;

do $$ begin
  if exists (
    select 1
    from weekly_snapshots s
    join review_sessions r on r.id = s.review_session_id
    where s.user_id <> r.user_id
  ) then
    raise exception 'Migration aborted: weekly snapshots exist whose review session has a different owner';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from review_sessions
    where week_number < 1 or week_number > 53
  ) then
    raise exception 'Migration aborted: review_sessions rows have week_number outside 1..53';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from review_sessions
    where week_end_date < week_start_date
  ) then
    raise exception 'Migration aborted: review_sessions rows have week_end_date before week_start_date';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from review_sessions
    where completed_at is not null and completed_at < started_at
  ) then
    raise exception 'Migration aborted: review_sessions rows have completed_at before started_at';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from weekly_snapshots
    where week_number < 1 or week_number > 53
  ) then
    raise exception 'Migration aborted: weekly_snapshots rows have week_number outside 1..53';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from weekly_snapshots
    where week_end_date < week_start_date
  ) then
    raise exception 'Migration aborted: weekly_snapshots rows have week_end_date before week_start_date';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from inbox_items
    where (processing_status = 'unprocessed') <> (processed_at is null)
  ) then
    raise exception 'Migration aborted: inbox_items rows have processed_at inconsistent with processing_status';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Cross-owner ownership guards.
-- -----------------------------------------------------------------------------

create or replace function fn_check_project_goal_owner()
returns trigger language plpgsql as $$
begin
  if new.goal_id is not null and not exists (
    select 1 from goals where id = new.goal_id and user_id = new.user_id
  ) then
    raise exception 'Project must belong to the same user as its goal';
  end if;
  return new;
end;
$$;

drop trigger if exists project_goal_owner_check on projects;
create trigger project_goal_owner_check
  before insert or update on projects
  for each row execute function fn_check_project_goal_owner();

create or replace function fn_check_action_project_owner()
returns trigger language plpgsql as $$
begin
  if new.project_id is not null and not exists (
    select 1 from projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'Action must belong to the same user as its project';
  end if;
  return new;
end;
$$;

drop trigger if exists action_project_owner_check on actions;
create trigger action_project_owner_check
  before insert or update on actions
  for each row execute function fn_check_action_project_owner();

create or replace function fn_check_inbox_project_owner()
returns trigger language plpgsql as $$
begin
  if new.resolved_project_id is not null and not exists (
    select 1 from projects where id = new.resolved_project_id and user_id = new.user_id
  ) then
    raise exception 'Inbox item must belong to the same user as its resolved project';
  end if;
  return new;
end;
$$;

drop trigger if exists inbox_project_owner_check on inbox_items;
create trigger inbox_project_owner_check
  before insert or update on inbox_items
  for each row execute function fn_check_inbox_project_owner();

create or replace function fn_check_snapshot_session_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from review_sessions where id = new.review_session_id and user_id = new.user_id
  ) then
    raise exception 'Weekly snapshot must belong to the same user as its review session';
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_session_owner_check on weekly_snapshots;
create trigger snapshot_session_owner_check
  before insert or update on weekly_snapshots
  for each row execute function fn_check_snapshot_session_owner();

-- -----------------------------------------------------------------------------
-- 2. CHECK constraints.
-- -----------------------------------------------------------------------------

alter table review_sessions
  add constraint review_sessions_week_number_range
    check (week_number between 1 and 53);

alter table review_sessions
  add constraint review_sessions_week_dates_ordered
    check (week_end_date >= week_start_date);

alter table review_sessions
  add constraint review_sessions_completed_after_started
    check (completed_at is null or completed_at >= started_at);

alter table weekly_snapshots
  add constraint weekly_snapshots_week_number_range
    check (week_number between 1 and 53);

alter table weekly_snapshots
  add constraint weekly_snapshots_week_dates_ordered
    check (week_end_date >= week_start_date);

alter table inbox_items
  add constraint inbox_items_processed_at_consistency
    check ((processing_status = 'unprocessed') = (processed_at is null));

-- -----------------------------------------------------------------------------
-- 3. weekly_snapshots immutability — block UPDATE and DELETE.
-- -----------------------------------------------------------------------------

create or replace function fn_block_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'weekly_snapshots rows are immutable';
end;
$$;

drop trigger if exists weekly_snapshots_immutable on weekly_snapshots;
create trigger weekly_snapshots_immutable
  before update or delete on weekly_snapshots
  for each row execute function fn_block_snapshot_mutation();

-- -----------------------------------------------------------------------------
-- 4. Missing FK indexes.
-- -----------------------------------------------------------------------------

create index if not exists inbox_items_resolved_project_idx
  on inbox_items (resolved_project_id);

create index if not exists weekly_snapshots_review_session_idx
  on weekly_snapshots (review_session_id);
