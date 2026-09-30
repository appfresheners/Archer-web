alter table public.goals
	add column if not exists why text;

comment on column public.goals.why is
	'User-authored reason this goal matters. Required for goals created through the app; nullable to preserve legacy goals.';
