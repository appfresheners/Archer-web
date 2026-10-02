alter table public.actions
	add column if not exists time_available_minutes integer not null default 25
	check (time_available_minutes between 1 and 120);

comment on column public.actions.time_available_minutes is
	'Estimated minutes available for this next action. Used by Engage filters and to size the focus timer.';
