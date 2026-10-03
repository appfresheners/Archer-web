-- =============================================================================
-- 20261003120000_goal_statement_multi_if_then.sql
-- =============================================================================
-- Three changes in ONE migration:
--   1. Persist the AI-refined `goal_statement` + `success_criteria` so the goal
--      detail view can show them (previously generated then thrown away).
--   2. Convert the single `if_then_plan text` into a list `if_then_plans text[]`,
--      backfilling the existing single plan into a one-element array so no
--      existing data is lost.
--   3. Re-create `save_goal_breakdown` to persist the new fields + array.
-- =============================================================================

-- 1. New AI-owned columns (no backfill: legacy goals render the fallback).
alter table public.goals
  add column if not exists goal_statement text;
alter table public.goals
  add column if not exists success_criteria text[];

comment on column public.goals.goal_statement is
  'AI-refined 3-month goal statement. Null for goals generated before this change; the detail view falls back to goal_text.';
comment on column public.goals.success_criteria is
  'AI-generated measurable success criteria. Null/empty for legacy goals; hidden in that case.';

-- 2. Convert the single if_then_plan into a list, preserving existing data.
alter table public.goals
  add column if not exists if_then_plans text[];

-- Backfill the single existing plan into a one-element array, then drop the
-- scalar column. Guarded so the migration is re-runnable on a branch where the
-- scalar column has already been removed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'goals'
      and column_name = 'if_then_plan'
  ) then
    update public.goals
    set if_then_plans = array[if_then_plan]
    where if_then_plan is not null
      and if_then_plans is null;

    alter table public.goals
      drop column if_then_plan;
  end if;
end $$;

comment on column public.goals.if_then_plans is
  'User-authored if–then implementation intentions ("If X, then I will Y"), one or more.';

-- -----------------------------------------------------------------------------
-- Re-create save_goal_breakdown to persist the new fields + array.
-- -----------------------------------------------------------------------------
-- Same atomic contract as 20261002120000_atomic_writes.sql, extended to write
-- `goal_statement`, `success_criteria`, and `if_then_plans`. Ownership is still
-- derived from auth.uid(); projects and actions are unchanged.
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
    skill_framework, drivers, barriers, if_then_plans,
    goal_statement, success_criteria
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
    case
      when jsonb_typeof(p_goal->'if_then_plans') = 'array'
        then array(select jsonb_array_elements_text(p_goal->'if_then_plans'))
      else null
    end,
    nullif(p_goal->>'goal_statement', ''),
    case
      when jsonb_typeof(p_goal->'success_criteria') = 'array'
        then array(select jsonb_array_elements_text(p_goal->'success_criteria'))
      else null
    end
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

-- Grants are preserved by `create or replace` (same function OID), but re-apply
-- them to keep this migration self-contained and consistent with the atomic
-- writes convention.
revoke execute on function save_goal_breakdown(jsonb, jsonb) from public;
grant  execute on function save_goal_breakdown(jsonb, jsonb) to authenticated;
