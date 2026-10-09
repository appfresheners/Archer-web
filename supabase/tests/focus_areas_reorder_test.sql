BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, email)
VALUES
	('11111111-1111-4111-8111-111111111111', 'reorder-owner@example.test'),
	('22222222-2222-4222-8222-222222222222', 'reorder-other@example.test'),
	('33333333-3333-4333-8333-333333333333', 'reorder-empty@example.test');

INSERT INTO public.areas_of_focus (id, user_id, name, sort_order, archived_at)
VALUES
	('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'First', 0, NULL),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'Second', 1, NULL),
	('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'Third', 2, NULL),
	('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Archived', 8, timestamptz '2026-10-01 00:00:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', 'Other owner', 0, NULL);

SELECT ok(
	NOT has_function_privilege('anon', 'public.reorder_areas_of_focus(uuid[])', 'EXECUTE'),
	'anon cannot execute the Area reorder RPC'
);
SELECT ok(
	has_function_privilege('authenticated', 'public.reorder_areas_of_focus(uuid[])', 'EXECUTE'),
	'authenticated can execute the Area reorder RPC'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '';
SELECT throws_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[]::uuid[])$$,
	'42501', NULL,
	'authenticated role without an owner claim cannot reorder Areas'
);

SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

SELECT lives_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[
		'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
		'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
		'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
	])$$,
	'owner can atomically reorder the complete active Area list'
);
SELECT results_eq(
	$$SELECT array_agg(id ORDER BY sort_order) FROM public.areas_of_focus WHERE user_id = auth.uid() AND archived_at IS NULL$$,
	$$SELECT ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]$$,
	'valid reorder writes the submitted ordering'
);
SELECT is(
	(SELECT sort_order FROM public.areas_of_focus WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
	8,
	'archived Areas are excluded from active reorder writes'
);

SELECT throws_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[
		'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
		'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
		'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
	])$$,
	'22000', NULL,
	'duplicate Area ids are rejected'
);
SELECT results_eq(
	$$SELECT array_agg(id ORDER BY sort_order) FROM public.areas_of_focus WHERE user_id = auth.uid() AND archived_at IS NULL$$,
	$$SELECT ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]$$,
	'duplicate-list rejection leaves every sort order unchanged'
);

SELECT throws_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[
		'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
		'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
	])$$,
	'22000', NULL,
	'an incomplete Area id list is rejected'
);
SELECT results_eq(
	$$SELECT array_agg(id ORDER BY sort_order) FROM public.areas_of_focus WHERE user_id = auth.uid() AND archived_at IS NULL$$,
	$$SELECT ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]$$,
	'incomplete-list rejection leaves every sort order unchanged'
);

SELECT throws_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[
		'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
		'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
		'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
	])$$,
	'22000', NULL,
	'a foreign Area id is rejected'
);
SELECT results_eq(
	$$SELECT array_agg(id ORDER BY sort_order) FROM public.areas_of_focus WHERE user_id = auth.uid() AND archived_at IS NULL$$,
	$$SELECT ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]$$,
	'foreign-list rejection leaves every sort order unchanged'
);

SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT results_eq(
	$$SELECT array_agg(id ORDER BY sort_order) FROM public.areas_of_focus WHERE user_id = auth.uid() AND archived_at IS NULL$$,
	$$SELECT ARRAY['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid]$$,
	'reordering cannot change another owner''s Areas'
);

SET LOCAL request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
SELECT lives_ok(
	$$SELECT public.reorder_areas_of_focus(ARRAY[]::uuid[])$$,
	'an owner with no active Areas can submit an empty order'
);

SELECT * FROM finish();
ROLLBACK;