create or replace function public.save_goal_breakdown(
	p_goal jsonb,
	p_projects jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_goal_id uuid;
	v_project jsonb;
	v_project_id uuid;
	v_action text;
	v_sort int;
begin
	if v_user_id is null then
		raise exception 'Authentication required' using errcode = '42501';
	end if;

	insert into public.goals (
		user_id, area_id, goal_text, why, target_date,
		skill_framework, drivers, barriers, if_then_plans,
		goal_statement, success_criteria
	) values (
		v_user_id,
		nullif(p_goal->>'area_id', '')::uuid,
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
		insert into public.projects (
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
			insert into public.actions (user_id, project_id, text, sort_order)
			values (v_user_id, v_project_id, v_action, v_sort);
			v_sort := v_sort + 1;
		end loop;
	end loop;

	return v_goal_id;
end;
$$;

revoke execute on function public.save_goal_breakdown(jsonb, jsonb) from public, anon;
grant execute on function public.save_goal_breakdown(jsonb, jsonb) to authenticated;
