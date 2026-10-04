-- Persist higher-horizon context and ongoing Areas of Focus.

create table public.focus_profiles (
	id          uuid primary key default gen_random_uuid(),
	user_id     uuid not null unique references auth.users(id) on delete cascade,
	vision      text,
	purpose     text,
	principles  text[] not null default '{}',
	created_at  timestamptz not null default now(),
	updated_at  timestamptz not null default now()
);

create table public.areas_of_focus (
	id          uuid primary key default gen_random_uuid(),
	user_id     uuid not null references auth.users(id) on delete cascade,
	name        text not null,
	description text,
	sort_order  integer not null default 0,
	archived_at timestamptz,
	created_at  timestamptz not null default now(),
	updated_at  timestamptz not null default now(),
	constraint areas_of_focus_owner_id_unique unique (user_id, id)
);

alter table public.focus_profiles enable row level security;
alter table public.areas_of_focus enable row level security;

revoke all on table public.focus_profiles, public.areas_of_focus
	from anon, authenticated;
grant select, insert, update on table public.focus_profiles, public.areas_of_focus
	to authenticated;

create policy "users read own focus profile"
	on public.focus_profiles for select to authenticated
	using ((select auth.uid()) = user_id);
create policy "users create own focus profile"
	on public.focus_profiles for insert to authenticated
	with check ((select auth.uid()) = user_id);
create policy "users update own focus profile"
	on public.focus_profiles for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

create policy "users read own areas of focus"
	on public.areas_of_focus for select to authenticated
	using ((select auth.uid()) = user_id);
create policy "users create own areas of focus"
	on public.areas_of_focus for insert to authenticated
	with check ((select auth.uid()) = user_id);
create policy "users update own areas of focus"
	on public.areas_of_focus for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

create index areas_of_focus_user_order_idx
	on public.areas_of_focus (user_id, sort_order);

drop trigger if exists set_updated_at on public.focus_profiles;
create trigger set_updated_at before update on public.focus_profiles
	for each row execute function public.fn_set_updated_at();

drop trigger if exists set_updated_at on public.areas_of_focus;
create trigger set_updated_at before update on public.areas_of_focus
	for each row execute function public.fn_set_updated_at();

alter table public.goals
	add column area_id uuid,
	add constraint goals_area_owner_fk
		foreign key (user_id, area_id)
		references public.areas_of_focus (user_id, id);

create index goals_area_id_idx on public.goals (area_id);

alter table public.projects
	add column area_id uuid,
	add constraint projects_area_owner_fk
		foreign key (user_id, area_id)
		references public.areas_of_focus (user_id, id),
	add constraint project_has_one_direct_parent
		check (goal_id is null or area_id is null);

create index projects_area_id_idx on public.projects (area_id);
