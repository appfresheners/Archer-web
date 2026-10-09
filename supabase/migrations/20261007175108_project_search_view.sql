create view public.project_search
with (security_invoker = true)
as
select
	p.id,
	p.name,
	p.status,
	p.goal_id,
	p.created_at,
	g.goal_text as parent_goal_text
from public.projects as p
left join public.goals as g on g.id = p.goal_id;

revoke all on table public.project_search from public, anon;
grant select on table public.project_search to authenticated;
