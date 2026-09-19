-- ============================================================================
-- LIVE VALIDATION of migration 009 admin RPCs (temporary data, self-cleaning)
-- Runs as role `authenticated` with admin JWT claims == what the browser does.
-- ============================================================================
\set ON_ERROR_STOP on
\set admin_id '46a6bc9d-54ca-4f2a-8293-ea3fd63848bc'

BEGIN;

-- ---- seed a fake participant ------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'zz-test-participant@example.com',
        '{"user_name":"zz-test-participant"}'::jsonb);
UPDATE public.profiles SET full_name = 'ZZ Test Participant' WHERE id = '11111111-1111-1111-1111-111111111111';

-- ---- seed a team led by that participant, with a member + submission + file --
INSERT INTO public.teams (id, name, team_code, leader_id)
VALUES ('22222222-2222-2222-2222-222222222222', 'ZZ Test Team', 'BIT-ZZTEST',
        '11111111-1111-1111-1111-111111111111');

INSERT INTO public.team_memberships (team_id, user_id)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

INSERT INTO public.submissions (team_id, stage, aim_summary)
VALUES ('22222222-2222-2222-2222-222222222222', 'AIM', 'ZZ Test Submission');

-- storage.objects only guards DELETE, so inserting a test object is fine here.
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('submissions', 'teams/22222222-2222-2222-2222-222222222222/zz-test.pdf',
        '11111111-1111-1111-1111-111111111111');

\echo '--- SEEDED ---'
SELECT (SELECT count(*) FROM public.teams WHERE id = '22222222-2222-2222-2222-222222222222') AS teams,
       (SELECT count(*) FROM public.team_memberships WHERE team_id = '22222222-2222-2222-2222-222222222222') AS members,
       (SELECT count(*) FROM public.submissions WHERE team_id = '22222222-2222-2222-2222-222222222222') AS subs,
       (SELECT count(*) FROM storage.objects WHERE name LIKE 'teams/22222222-2222-2222-2222-222222222222/%') AS files;

-- ---- become the admin, exactly like the browser client ----------------------
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"46a6bc9d-54ca-4f2a-8293-ea3fd63848bc","role":"authenticated"}';

\echo '--- admin_delete_team as authenticated admin ---'
SELECT public.admin_delete_team('22222222-2222-2222-2222-222222222222') AS result;

SELECT (SELECT count(*) FROM public.teams) AS teams_left,
       (SELECT count(*) FROM public.team_memberships) AS members_left,
       (SELECT count(*) FROM public.submissions) AS subs_left,
       (SELECT count(*) FROM storage.objects WHERE bucket_id = 'submissions') AS files_left;

\echo '--- admin_delete_participant as authenticated admin ---'
SELECT public.admin_delete_participant('11111111-1111-1111-1111-111111111111') AS result;

-- auth.users is not readable by `authenticated`, so drop back to the admin
-- connection role (which has BYPASSRLS) to count leftovers.
RESET ROLE;
SELECT (SELECT count(*) FROM auth.users) AS users_left,
       (SELECT count(*) FROM public.profiles) AS profiles_left;

-- ---- guards: admin cannot be removed, self cannot be removed ----------------
\echo '--- guard checks (each MUST be refused) ---'
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"46a6bc9d-54ca-4f2a-8293-ea3fd63848bc","role":"authenticated"}';
DO $guards$
DECLARE
  v_admin constant uuid := '46a6bc9d-54ca-4f2a-8293-ea3fd63848bc';
BEGIN
  BEGIN
    PERFORM public.admin_delete_participant(v_admin);
    RAISE EXCEPTION 'GUARD FAILED: admin account was deletable';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK self/admin removal refused: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.admin_delete_team('33333333-3333-3333-3333-333333333333');
    RAISE EXCEPTION 'GUARD FAILED: missing team reported success';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK missing team refused: %', SQLERRM;
  END;
END
$guards$;

\echo '--- trigger still enabled after RPC? (O = enabled) ---'
RESET ROLE;
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'storage.objects'::regclass AND tgname = 'protect_objects_delete';

ROLLBACK;