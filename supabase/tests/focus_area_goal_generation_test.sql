BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
	('31313131-3131-4313-8313-313131313131', 'goal-area-owner@example.test'),
	('32323232-3232-4323-8323-323232323232', 'goal-area-other@example.test');

INSERT INTO public.areas_of_focus (id, user_id, name)
VALUES
	('33333333-3333-4333-8333-333333333333', '31313131-3131-4313-8313-313131313131', 'Owner area'),
	('34343434-3434-4434-8434-343434343434', '32323232-3232-4323-8323-323232323232', 'Other area');

SELECT ok(
	has_function_privilege('authenticated', 'public.save_goal_breakdown(jsonb, jsonb)', 'EXECUTE')
		AND NOT has_function_privilege('anon', 'public.save_goal_breakdown(jsonb, jsonb)', 'EXECUTE'),
	'only authenticated users can execute save_goal_breakdown'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '31313131-3131-4313-8313-313131313131';

SELECT lives_ok(
	$$SELECT public.save_goal_breakdown(
		jsonb_build_object(
			'area_id', '33333333-3333-4333-8333-333333333333',
			'goal_text', 'Goal with Area',
			'why', 'A reason',
			'target_date', '2027-01-01',
			'drivers', '[]'::jsonb,
			'barriers', '[]'::jsonb,
			'if_then_plans', '[]'::jsonb,
			'success_criteria', '[]'::jsonb
		),
		jsonb_build_array(jsonb_build_object(
			'name', 'Generated child',
			'next_actions', '[]'::jsonb
		))
	)$$,
	'Goal generation saves atomically with an Area'
);
SELECT results_eq(
	$$SELECT area_id FROM public.goals WHERE goal_text = 'Goal with Area'$$,
	ARRAY['33333333-3333-4333-8333-333333333333'::uuid],
	'atomic Goal generation persists the selected Area'
);

SELECT results_eq(
	$$
	SELECT p.area_id
	FROM public.projects AS p
	JOIN public.goals AS g ON g.id = p.goal_id
	WHERE g.goal_text = 'Goal with Area'
	$$,
	ARRAY[NULL::uuid],
	'Goal-generated Projects inherit Area through the Goal and store no direct Area'
);

SELECT lives_ok(
	$$SELECT public.save_goal_breakdown(
		jsonb_build_object(
			'goal_text', 'Goal without Area',
			'why', 'A reason',
			'target_date', '2027-01-01',
			'drivers', '[]'::jsonb,
			'barriers', '[]'::jsonb,
			'if_then_plans', '[]'::jsonb,
			'success_criteria', '[]'::jsonb
		),
		'[]'::jsonb
	)$$,
	'Goal generation remains valid without an Area'
);
SELECT is(
	(SELECT area_id FROM public.goals WHERE goal_text = 'Goal without Area'),
	NULL::uuid,
	'Goal without an Area stores null'
);

SELECT throws_ok(
	$$SELECT public.save_goal_breakdown(
		jsonb_build_object(
			'area_id', '34343434-3434-4434-8434-343434343434',
			'goal_text', 'Foreign Area goal',
			'why', 'A reason',
			'target_date', '2027-01-01',
			'drivers', '[]'::jsonb,
			'barriers', '[]'::jsonb,
			'if_then_plans', '[]'::jsonb,
			'success_criteria', '[]'::jsonb
		),
		'[]'::jsonb
	)$$,
	'23503', NULL,
	'database rejects a Goal generated with another user''s Area'
);

SELECT is_empty(
	$$SELECT id FROM public.goals WHERE goal_text = 'Foreign Area goal'$$,
	'foreign Area rejection leaves no partial Goal'
);

SELECT * FROM finish();
ROLLBACK;