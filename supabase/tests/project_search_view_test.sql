BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, email)
VALUES
	('81818181-8181-4181-8181-818181818181', 'project-search-owner@example.test'),
	('82828282-8282-4282-8282-828282828282', 'project-search-other@example.test');

INSERT INTO public.goals (id, user_id, goal_text, target_date)
VALUES
	('83838383-8383-4383-8383-838383838383', '81818181-8181-4181-8181-818181818181', 'Forest ecology', DATE '2027-01-01'),
	('87878787-8787-4787-8787-878787878787', '82828282-8282-4282-8282-828282828282', 'Private forest plans', DATE '2027-01-01');

INSERT INTO public.projects (id, user_id, goal_id, name)
VALUES
	('84848484-8484-4484-8484-848484848484', '81818181-8181-4181-8181-818181818181', '83838383-8383-4383-8383-838383838383', 'Draft a guide'),
	('85858585-8585-4585-8585-858585858585', '81818181-8181-4181-8181-818181818181', NULL, 'Forest field notes'),
	('86868686-8686-4686-8686-868686868686', '82828282-8282-4282-8282-828282828282', NULL, 'Forest hidden');

SELECT ok(
	(SELECT reloptions @> ARRAY['security_invoker=true']::text[]
	 FROM pg_class WHERE oid = 'public.project_search'::regclass),
	'project search view runs with invoker privileges'
);
SELECT ok(
	NOT has_table_privilege('anon', 'public.project_search', 'SELECT'),
	'anonymous users cannot query the project search view'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '81818181-8181-4181-8181-818181818181';

SELECT throws_ok(
	$$INSERT INTO public.projects (id, user_id, goal_id, name)
		VALUES ('88888888-8888-4888-8888-888888888888', '81818181-8181-4181-8181-818181818181', '87878787-8787-4787-8787-878787878787', 'Linked to hidden goal')$$,
	'P0001', 'Project must belong to the same user as its goal',
	'cross-owner goal links are rejected before a parent goal can be exposed'
);

SELECT results_eq(
	$$SELECT parent_goal_text FROM public.project_search
		WHERE id = '84848484-8484-4484-8484-848484848484'$$,
	ARRAY['Forest ecology']::text[],
	'view includes the parent goal text'
);

SELECT results_eq(
	$$SELECT name FROM public.project_search
		WHERE name ILIKE '%fOrEsT%' OR parent_goal_text ILIKE '%fOrEsT%'
		ORDER BY name$$,
	ARRAY['Draft a guide', 'Forest field notes']::text[],
	'case-insensitive project-name OR parent-goal search returns both matches'
);

SELECT is_empty(
	$$SELECT id FROM public.project_search
		WHERE id = '86868686-8686-4686-8686-868686868686'$$,
	'RLS hides another user project through the view'
);

SELECT * FROM finish();
ROLLBACK;