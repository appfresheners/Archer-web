-- =============================================================================
-- 20261002120000_atomic_writes.sql — single-call atomicity for multi-row writes
-- =============================================================================
-- Four app flows previously ran as sequences of independent Supabase calls with
-- manual, best-effort rollback (goal generate-save, goal soft-delete cascade,
-- project regeneration, action reorder). Each is now ONE Postgres function
-- executed as a single RPC — one transaction, so a mid-sequence failure rolls
-- back every row already written.
--
-- Conventions:
--   * SECURITY INVOKER — each function runs with the calling user's privileges,
--     so per-table RLS (`user_id = auth.uid()`) still applies to every write.
--   * Ownership is always derived from `auth.uid()` inside the function, never
--     trusted from a parameter.
--   * Grants: execute is revoked from public and granted to `authenticated`
--     (the role PostgREST runs RPCs as).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- save_goal_breakdown(p_goal, p_projects) → new goal id
-- -----------------------------------------------------------------------------
-- Persists ONE goals row, one projects row per generated project, and one
-- actions row per next action — all owned by the invoker — atomically.
-- `p_projects` is a JSON array of { name, purpose, successful_outcome,
-- sort_order, next_actions: string[] }; actions link to their project by
-- insertion order, so the mapping can never desync.
-- -----------------------------------------------------------------------------

create or replace function save_goal_breakdown(
  p_goal     jsonb,
  p_projects jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_goal_id     uuid;
  v_project     jsonb;
  v_project_id  uuid;
  v_action      text;
  v_sort        int;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into goals (
    user_id, goal_text, why, target_date,
    skill_framework, drivers, barriers, if_then_plan
  ) values (
    v_user_id,
    p_goal->>'goal_text',
    nullif(p_goal->>'why', ''),
    (p_goal->>'target_date')::date,
    p_goal->'skill_framework',
    case
      when jsonb_typeof(p_goal->'drivers') = 'array'
        then array(select jsonb_array_elements_text(p_goal->'drivers'))
      else null
    end,
    case
      when jsonb_typeof(p_goal->'barriers') = 'array'
        then array(select jsonb_array_elements_text(p_goal->'barriers'))
      else null
    end,
    nullif(p_goal->>'if_then_plan', '')
  )
  returning id into v_goal_id;

  for v_project in select * from jsonb_array_elements(p_projects) loop
    insert into projects (
      user_id, goal_id, name, purpose, successful_outcome, sort_order
    ) values (
      v_user_id,
      v_goal_id,
      v_project->>'name',
      nullif(v_project->>'purpose', ''),
      nullif(v_project->>'successful_outcome', ''),
      coalesce((v_project->>'sort_order')::int, 0)
    )
    returning id into v_project_id;

    v_sort := 0;
    for v_action in
      select * from jsonb_array_elements_text(v_project->'next_actions')
    loop
      insert into actions (user_id, project_id, text, sort_order)
      values (v_user_id, v_project_id, v_action, v_sort);
      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_goal_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- archive_goal_cascade(p_goal_id) → void
-- -----------------------------------------------------------------------------
-- Soft-deletes a goal by archiving it AND every project linked to it, in one
-- transaction. Actions are archived transitively via their parent project
-- (action_status has no `archived` member by design), so nothing is orphaned
-- or left half-archived.
-- -----------------------------------------------------------------------------

create or replace function archive_goal_cascade(
  p_goal_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from goals where id = p_goal_id and user_id = auth.uid()
  ) then
    raise exception 'Goal not found or not owned' using errcode = 'P0002';
  end if;

  update projects
  set status = 'archived'
  where goal_id = p_goal_id
    and user_id = auth.uid();

  update goals
  set status = 'archived'
  where id = p_goal_id
    and user_id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- regenerate_project_actions(p_project_id, p_project, p_actions) → void
-- -----------------------------------------------------------------------------
-- Replaces a project's AI content and its actions atomically: update the
-- project fields, delete the existing actions, insert the freshly generated
-- ones. `p_project` carries { name, purpose, successful_outcome,
-- planning_detail } (planning_detail null for minimal depth). `p_actions` is
-- a JSON array of { text, sort_order }.
-- -----------------------------------------------------------------------------

create or replace function regenerate_project_actions(
  p_project_id uuid,
  p_project    jsonb,
  p_actions    jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from projects where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'Project not found or not owned' using errcode = 'P0002';
  end if;

  update projects
  set name                = p_project->>'name',
      purpose             = nullif(p_project->>'purpose', ''),
      successful_outcome  = nullif(p_project->>'successful_outcome', ''),
      planning_detail     = nullif(p_project->'planning_detail', 'null'::jsonb)
  where id = p_project_id
    and user_id = auth.uid();

  delete from actions
  where project_id = p_project_id
    and user_id = auth.uid();

  insert into actions (user_id, project_id, text, sort_order)
  select auth.uid(),
         p_project_id,
         a->>'text',
         coalesce((a->>'sort_order')::int, 0)
  from jsonb_array_elements(p_actions) as a;
end;
$$;

-- -----------------------------------------------------------------------------
-- reorder_project_actions(p_project_id, p_action_ids) → void
-- -----------------------------------------------------------------------------
-- Verifies the submitted id set is EXACTLY the project's current action ids
-- (no missing, no foreign ids), then writes sort_order = index for each, all
-- in one transaction. A mismatched set raises (SQLSTATE 22000) with no write,
-- so a reorder can never drop, adopt, or partially reorder an action.
-- -----------------------------------------------------------------------------

create or replace function reorder_project_actions(
  p_project_id uuid,
  p_action_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current uuid[];
begin
  if not exists (
    select 1 from projects where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'Project not found or not owned' using errcode = 'P0002';
  end if;

  -- Lock the project's action rows so two concurrent reorders serialize.
  perform 1
  from actions
  where project_id = p_project_id and user_id = auth.uid()
  for update;

  select array_agg(id order by id)
  into v_current
  from actions
  where project_id = p_project_id and user_id = auth.uid();

  if (select array_agg(x order by x) from unnest(p_action_ids) x)
       is distinct from
     (select array_agg(x order by x) from unnest(v_current) x)
  then
    raise exception 'Reorder list does not match the project''s actions'
      using errcode = '22000';
  end if;

  for i in 1..array_length(p_action_ids, 1) loop
    update actions
    set sort_order = i - 1
    where id = p_action_ids[i]
      and project_id = p_project_id
      and user_id = auth.uid();
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants — RPCs are callable by the authenticated role only.
-- -----------------------------------------------------------------------------

revoke execute on function save_goal_breakdown(jsonb, jsonb) from public;
grant  execute on function save_goal_breakdown(jsonb, jsonb) to authenticated;

revoke execute on function archive_goal_cascade(uuid) from public;
grant  execute on function archive_goal_cascade(uuid) to authenticated;

revoke execute on function regenerate_project_actions(uuid, jsonb, jsonb) from public;
grant  execute on function regenerate_project_actions(uuid, jsonb, jsonb) to authenticated;

revoke execute on function reorder_project_actions(uuid, uuid[]) from public;
grant  execute on function reorder_project_actions(uuid, uuid[]) to authenticated;
