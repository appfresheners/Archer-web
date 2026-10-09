create or replace function public.reorder_areas_of_focus(
	p_area_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_current uuid[];
begin
	if auth.uid() is null then
		raise exception 'Authentication required' using errcode = '42501';
	end if;

	perform 1
	from public.areas_of_focus
	where user_id = auth.uid() and archived_at is null
	for update;

	select array_agg(id order by id)
	into v_current
	from public.areas_of_focus
	where user_id = auth.uid() and archived_at is null;

	if (
		select array_agg(submitted.area_id order by submitted.area_id)
		from unnest(coalesce(p_area_ids, '{}'::uuid[])) as submitted(area_id)
	) is distinct from v_current then
		raise exception 'Reorder list does not match the user''s active Areas'
			using errcode = '22000';
	end if;

	for i in 1..coalesce(array_length(p_area_ids, 1), 0) loop
		update public.areas_of_focus
		set sort_order = i - 1
		where id = p_area_ids[i]
			and user_id = auth.uid()
			and archived_at is null;
	end loop;
end;
$$;

revoke execute on function public.reorder_areas_of_focus(uuid[]) from anon, public;
grant execute on function public.reorder_areas_of_focus(uuid[]) to authenticated;