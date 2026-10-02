-- =============================================================================
-- 20261002120100_commit_action_hardening.sql — DB backstop for the single-
-- committed-action invariant
-- =============================================================================
-- The original fn_commit_action (0001) handled only UPDATE and only decommitted
-- siblings — it never guarded against a direct INSERT with status='committed',
-- and it did not serialize concurrent commits. This migration:
--
--   1. Rewrites fn_commit_action with INSERT + UPDATE branches and a
--      `SELECT ... FOR UPDATE` lock on the project row, so concurrent commits
--      on the same project serialize and the decommit can't race.
--   2. Adds a partial UNIQUE index `actions(project_id) WHERE status='committed'`
--      as the hard backstop: even if two writers bypass the trigger, Postgres
--      rejects the second committed row per project (SQLSTATE 23505). NULL
--      project_ids are distinct in a unique index, so standalone actions
--      (project_id IS NULL) stay independent.
--
-- A pre-check reports and aborts when existing rows already violate the
-- invariant (a project with more than one committed action) — the migration
-- never silently mutates data.
-- =============================================================================

-- Pre-check: abort loudly if any project already has >1 committed action.
do $$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from (
    select project_id
    from actions
    where status = 'committed' and project_id is not null
    group by project_id
    having count(*) > 1
  ) violations;

  if v_count > 0 then
    raise exception
      'Migration aborted: % project(s) already have more than one committed action',
      v_count;
  end if;
end $$;

-- Replace the old non-unique lookup index with the unique backstop.
drop index if exists actions_committed_idx;

create unique index if not exists actions_committed_unique_idx
  on actions (project_id)
  where status = 'committed';

-- Rewrite the trigger function: INSERT + UPDATE branches, project-row lock.
create or replace function fn_commit_action()
returns trigger language plpgsql as $$
begin
  if new.status = 'committed' then
    -- Standalone actions (no project) are independent: no lock, no decommit.
    if new.project_id is not null then
      -- Serialize concurrent commits on this project so the decommit below
      -- and the unique index above always agree on the winner.
      perform 1 from projects where id = new.project_id for update;

      if tg_op = 'INSERT' then
        update actions
        set status = 'available'
        where project_id = new.project_id
          and status = 'committed';
      elsif tg_op = 'UPDATE' and old.status <> 'committed' then
        update actions
        set status = 'available'
        where project_id = new.project_id
          and id <> new.id
          and status = 'committed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Recreate the trigger to fire on INSERT as well as UPDATE.
drop trigger if exists commit_action_trigger on actions;
create trigger commit_action_trigger
  before insert or update on actions
  for each row execute function fn_commit_action();
