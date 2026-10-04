BEGIN;
SELECT plan(40);

INSERT INTO auth.users (id, email)
VALUES
	('11111111-1111-4111-8111-111111111111', 'focus-owner@example.test'),
	('22222222-2222-4222-8222-222222222222', 'focus-other@example.test');

INSERT INTO public.focus_profiles (id, user_id, vision)
VALUES (
	'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
	'22222222-2222-4222-8222-222222222222',
	'Other user vision'
);

INSERT INTO public.areas_of_focus (id, user_id, name)
VALUES
	('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Owner area'),
	('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'Other area');

SELECT ok(
	NOT has_table_privilege('anon', 'public.focus_profiles', 'SELECT')
		AND NOT has_table_privilege('anon', 'public.focus_profiles', 'INSERT')
		AND NOT has_table_privilege('anon', 'public.focus_profiles', 'UPDATE')
		AND NOT has_table_privilege('anon', 'public.focus_profiles', 'DELETE'),
	'anon has no Focus profile table privileges'
);
SELECT ok(
	NOT has_table_privilege('anon', 'public.areas_of_focus', 'SELECT')
		AND NOT has_table_privilege('anon', 'public.areas_of_focus', 'INSERT')
		AND NOT has_table_privilege('anon', 'public.areas_of_focus', 'UPDATE')
		AND NOT has_table_privilege('anon', 'public.areas_of_focus', 'DELETE'),
	'anon has no Area table privileges'
);
SELECT ok(
	has_table_privilege('authenticated', 'public.focus_profiles', 'SELECT')
		AND has_table_privilege('authenticated', 'public.focus_profiles', 'INSERT')
		AND has_table_privilege('authenticated', 'public.focus_profiles', 'UPDATE'),
	'authenticated can read, insert, and update Focus profiles'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.focus_profiles', 'DELETE'),
	'authenticated cannot hard-delete Focus profiles'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.focus_profiles', 'TRUNCATE')
		AND NOT has_table_privilege('authenticated', 'public.focus_profiles', 'REFERENCES')
		AND NOT has_table_privilege('authenticated', 'public.focus_profiles', 'TRIGGER'),
	'authenticated has no extra Focus profile table privileges'
);
SELECT ok(
	has_table_privilege('authenticated', 'public.areas_of_focus', 'SELECT')
		AND has_table_privilege('authenticated', 'public.areas_of_focus', 'INSERT')
		AND has_table_privilege('authenticated', 'public.areas_of_focus', 'UPDATE'),
	'authenticated can read, insert, and update Areas'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.areas_of_focus', 'DELETE'),
	'authenticated cannot hard-delete Areas'
);
SELECT ok(
	NOT has_table_privilege('authenticated', 'public.areas_of_focus', 'TRUNCATE')
		AND NOT has_table_privilege('authenticated', 'public.areas_of_focus', 'REFERENCES')
		AND NOT has_table_privilege('authenticated', 'public.areas_of_focus', 'TRIGGER'),
	'authenticated has no extra Area table privileges'
);
SELECT ok(
	EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'areas_of_focus' AND column_name = 'sort_order'
	)
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'areas_of_focus' AND column_name = 'archived_at'
		)
		AND NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'areas_of_focus' AND column_name = 'status'
		),
	'Areas support ordering and archival without a completion status'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

SELECT results_eq(
	$$INSERT INTO public.focus_profiles (id, user_id, vision, purpose, principles)
		VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Owner vision', 'Owner purpose', ARRAY['Be kind'])
		RETURNING user_id$$,
	ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
	'owner can create a Focus profile'
);
SELECT throws_ok(
	$$INSERT INTO public.focus_profiles (id, user_id)
		VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111')$$,
	'23505', NULL,
	'a user cannot create a second Focus profile'
);
SELECT throws_ok(
	$$INSERT INTO public.focus_profiles (id, user_id)
		VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', '22222222-2222-4222-8222-222222222222')$$,
	'42501', NULL,
	'owner cannot create another user''s Focus profile'
);
SELECT results_eq(
	$$SELECT vision FROM public.focus_profiles WHERE user_id = '11111111-1111-4111-8111-111111111111'$$,
	ARRAY['Owner vision']::text[],
	'owner can read their Focus profile'
);
SELECT is_empty(
	$$SELECT id FROM public.focus_profiles WHERE user_id = '22222222-2222-4222-8222-222222222222'$$,
	'owner cannot read another user''s Focus profile'
);
SELECT is_empty(
	$$UPDATE public.focus_profiles SET vision = 'stolen' WHERE user_id = '22222222-2222-4222-8222-222222222222' RETURNING id$$,
	'owner cannot update another user''s Focus profile'
);

SELECT results_eq(
	$$INSERT INTO public.areas_of_focus (id, user_id, name)
		VALUES ('12121212-1212-4212-8212-121212121212', '11111111-1111-4111-8111-111111111111', 'New owner area')
		RETURNING name$$,
	ARRAY['New owner area']::text[],
	'owner can create an Area'
);
SELECT throws_ok(
	$$INSERT INTO public.areas_of_focus (id, user_id, name)
		VALUES ('13131313-1313-4313-8313-131313131313', '22222222-2222-4222-8222-222222222222', 'Spoofed area')$$,
	'42501', NULL,
	'owner cannot create another user''s Area'
);
SELECT results_eq(
	$$SELECT name FROM public.areas_of_focus WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
	ARRAY['Owner area']::text[],
	'owner can read their Area'
);
SELECT is_empty(
	$$SELECT id FROM public.areas_of_focus WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
	'owner cannot read another user''s Area'
);
SELECT is_empty(
	$$UPDATE public.areas_of_focus SET name = 'stolen' WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' RETURNING id$$,
	'owner cannot update another user''s Area'
);

SELECT results_eq(
	$$INSERT INTO public.goals (id, user_id, goal_text, target_date, area_id)
		VALUES ('14141414-1414-4414-8414-141414141414', '11111111-1111-4111-8111-111111111111', 'Area goal', DATE '2026-12-31', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
		RETURNING area_id$$,
	ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
	'Goal can reference its owner''s Area'
);
SELECT results_eq(
	$$INSERT INTO public.goals (id, user_id, goal_text, target_date)
		VALUES ('15151515-1515-4515-8515-151515151515', '11111111-1111-4111-8111-111111111111', 'Unassigned goal', DATE '2026-12-31')
		RETURNING id$$,
	ARRAY['15151515-1515-4515-8515-151515151515'::uuid],
	'Goal can have no Area'
);
SELECT throws_ok(
	$$INSERT INTO public.goals (id, user_id, goal_text, target_date, area_id)
		VALUES ('16161616-1616-4616-8616-161616161616', '11111111-1111-4111-8111-111111111111', 'Cross-owner goal', DATE '2026-12-31', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
	'23503', NULL,
	'database rejects a Goal linked to another user''s Area'
);
SELECT results_eq(
	$$INSERT INTO public.projects (id, user_id, name)
		VALUES ('17171717-1717-4717-8717-171717171717', '11111111-1111-4111-8111-111111111111', 'Unassigned project')
		RETURNING id$$,
	ARRAY['17171717-1717-4717-8717-171717171717'::uuid],
	'standalone Project can have no Area'
);
SELECT results_eq(
	$$INSERT INTO public.projects (id, user_id, name, area_id)
		VALUES ('18181818-1818-4818-8818-181818181818', '11111111-1111-4111-8111-111111111111', 'Area project', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
		RETURNING area_id$$,
	ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
	'standalone Project can reference its owner''s Area'
);
SELECT throws_ok(
	$$INSERT INTO public.projects (id, user_id, name, area_id)
		VALUES ('19191919-1919-4919-8919-191919191919', '11111111-1111-4111-8111-111111111111', 'Cross-owner project', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
	'23503', NULL,
	'database rejects a Project linked to another user''s Area'
);
SELECT throws_ok(
	$$INSERT INTO public.projects (id, user_id, goal_id, area_id, name)
		VALUES ('20202020-2020-4020-8020-202020202020', '11111111-1111-4111-8111-111111111111', '14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Two parents')$$,
	'23514', NULL,
	'database rejects a Project with both direct parents'
);
SELECT throws_ok(
	$$UPDATE public.projects SET goal_id = '14141414-1414-4414-8414-141414141414' WHERE id = '18181818-1818-4818-8818-181818181818'$$,
	'23514', NULL,
	'database rejects updating a standalone Area Project to also have a Goal parent'
);
SELECT throws_ok(
	$$UPDATE public.goals SET area_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' WHERE id = '14141414-1414-4414-8414-141414141414'$$,
	'23503', NULL,
	'database rejects updating a Goal to another user''s Area'
);
SELECT throws_ok(
	$$UPDATE public.projects SET area_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' WHERE id = '18181818-1818-4818-8818-181818181818'$$,
	'23503', NULL,
	'database rejects updating a Project to another user''s Area'
);
SELECT throws_ok(
	$$DELETE FROM public.focus_profiles WHERE user_id = '11111111-1111-4111-8111-111111111111'$$,
	'42501', NULL,
	'authenticated cannot hard-delete a Focus profile'
);
SELECT throws_ok(
	$$DELETE FROM public.areas_of_focus WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
	'42501', NULL,
	'authenticated cannot hard-delete an Area'
);
SELECT results_eq(
	$$UPDATE public.focus_profiles SET purpose = 'Updated purpose' WHERE user_id = '11111111-1111-4111-8111-111111111111' RETURNING purpose$$,
	ARRAY['Updated purpose']::text[],
	'owner can update their Focus profile'
);
SELECT results_eq(
	$$UPDATE public.areas_of_focus SET name = 'Updated owner area' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' RETURNING name$$,
	ARRAY['Updated owner area']::text[],
	'owner can update their Area'
);
SELECT throws_ok(
	$$UPDATE public.focus_profiles SET user_id = '22222222-2222-4222-8222-222222222222' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$,
	'42501', NULL,
	'owner cannot transfer their Focus profile to another user'
);
SELECT throws_ok(
	$$UPDATE public.areas_of_focus SET user_id = '22222222-2222-4222-8222-222222222222' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
	'42501', NULL,
	'owner cannot transfer their Area to another user'
);
UPDATE public.focus_profiles
	SET updated_at = timestamptz '2000-01-01'
	WHERE user_id = '11111111-1111-4111-8111-111111111111';
SELECT ok(
	(SELECT updated_at > timestamptz '2000-01-01' FROM public.focus_profiles WHERE user_id = '11111111-1111-4111-8111-111111111111'),
	'Focus profile update refreshes updated_at'
);
UPDATE public.areas_of_focus
	SET updated_at = timestamptz '2000-01-01'
	WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT ok(
	(SELECT updated_at > timestamptz '2000-01-01' FROM public.areas_of_focus WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
	'Area update refreshes updated_at'
);

SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT results_eq(
	$$SELECT vision FROM public.focus_profiles WHERE user_id = '22222222-2222-4222-8222-222222222222'$$,
	ARRAY['Other user vision']::text[],
	'denied update left the other Focus profile unchanged'
);
SELECT results_eq(
	$$SELECT name FROM public.areas_of_focus WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
	ARRAY['Other area']::text[],
	'denied update left the other Area unchanged'
);

SELECT * FROM finish();
ROLLBACK;
