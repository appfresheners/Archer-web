BEGIN;
SELECT plan(2);

SELECT results_eq(
	$$SELECT enumlabel::text COLLATE "C"
		FROM pg_enum
		JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
		WHERE pg_type.typname = 'project_status'
		ORDER BY enumsortorder$$,
	ARRAY['active', 'paused', 'completed', 'archived', 'someday']::text[] COLLATE "C",
	'project_status retains existing labels and adds someday'
);

INSERT INTO auth.users (id, email)
VALUES ('81818181-8181-4181-8181-818181818181', 'someday-project@example.test');

INSERT INTO public.projects (id, user_id, name, status)
VALUES
	('91919191-9191-4191-8191-919191919191', '81818181-8181-4181-8181-818181818181', 'Active', 'active'),
	('92929292-9292-4292-8292-929292929292', '81818181-8181-4181-8181-818181818181', 'Paused', 'paused'),
	('93939393-9393-4393-8393-939393939393', '81818181-8181-4181-8181-818181818181', 'Someday', 'someday');

SELECT results_eq(
	$$SELECT status::text COLLATE "C"
		FROM public.projects
		WHERE user_id = '81818181-8181-4181-8181-818181818181'
		ORDER BY name$$,
	ARRAY['active', 'paused', 'someday']::text[] COLLATE "C",
	'projects persist existing statuses and someday'
);

SELECT * FROM finish();
ROLLBACK;