-- ============================================================================
-- built IT 2K26 - Migration 007 (NON-DESTRUCTIVE)
-- Team directory + DB-level roll-number format enforcement
-- ============================================================================
-- Purpose:
--   1. list_teams_public()      - SECURITY DEFINER RPC so ANY signed-in
--                                 participant can browse the team directory.
--                                 Exposes ONLY public-safe fields (name, code,
--                                 leader name/username, member count, domain,
--                                 problem title). RLS on teams is member-or-
--                                 leader only, so a plain SELECT cannot power
--                                 the directory. No email/phone/roll leaks.
--   2. get_team_public_detail() - same idea for /team/[teamId]: any signed-in
--                                 participant can view one team's public card
--                                 and its members' PUBLIC fields (name, github
--                                 username/url, avatar, year, section).
--   3. profiles_roll_number_format CHECK - DB-level enforcement of the
--                                 organizer-defined roll number grammar
--                                 (uniqueness was already enforced by
--                                 profiles_roll_number_key in migration 006).
-- No table is dropped, altered, or truncated. Existing rows are compatible:
-- the single stored roll number (24AK1A2580) matches the new CHECK.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Public team directory (one row per team)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_teams_public()
RETURNS TABLE (
  id             uuid,
  name           text,
  team_code      text,
  is_locked      boolean,
  created_at     timestamptz,
  domain_name    text,
  domain_slug    text,
  problem_title  text,
  member_count   bigint,
  leader_name    text,
  leader_github  text,
  leader_avatar  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.team_code,
    COALESCE(t.is_locked, false)          AS is_locked,
    t.created_at,
    d.name                                AS domain_name,
    d.slug                                AS domain_slug,
    ps.title                              AS problem_title,
    (SELECT count(*) FROM public.team_memberships m WHERE m.team_id = t.id)
                                          AS member_count,
    lp.full_name                          AS leader_name,
    lp.github_username                    AS leader_github,
    lp.avatar_url                         AS leader_avatar
  FROM public.teams t
  LEFT JOIN public.domains d              ON d.id = t.domain_id
  LEFT JOIN public.problem_statements ps  ON ps.id = t.problem_statement_id
  LEFT JOIN public.profiles lp            ON lp.id = t.leader_id
  ORDER BY t.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_teams_public() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_teams_public() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. One team's public detail (card + member list, public fields only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_public_detail(p_team_id uuid)
RETURNS TABLE (
  id              uuid,
  name            text,
  team_code       text,
  is_locked       boolean,
  created_at      timestamptz,
  domain_name     text,
  domain_slug     text,
  problem_title   text,
  problem_description text,
  member_count    bigint,
  leader_id       uuid,
  member_id       uuid,
  member_user_id  uuid,
  member_full_name text,
  member_github_username text,
  member_github_url      text,
  member_avatar_url      text,
  member_year            text,
  member_section         text,
  member_is_leader       boolean,
  member_joined_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.team_code,
    COALESCE(t.is_locked, false)          AS is_locked,
    t.created_at,
    d.name                                AS domain_name,
    d.slug                                AS domain_slug,
    ps.title                              AS problem_title,
    ps.description                        AS problem_description,
    (SELECT count(*) FROM public.team_memberships m2 WHERE m2.team_id = t.id)
                                          AS member_count,
    t.leader_id,
    m.id                                  AS member_id,
    m.user_id                             AS member_user_id,
    p.full_name                           AS member_full_name,
    p.github_username                     AS member_github_username,
    p.github_url                          AS member_github_url,
    p.avatar_url                          AS member_avatar_url,
    p.year                                AS member_year,
    p.section                             AS member_section,
    (m.user_id = t.leader_id)             AS member_is_leader,
    m.joined_at                           AS member_joined_at
  FROM public.teams t
  LEFT JOIN public.domains d              ON d.id = t.domain_id
  LEFT JOIN public.problem_statements ps  ON ps.id = t.problem_statement_id
  JOIN public.team_memberships m          ON m.team_id = t.id
  LEFT JOIN public.profiles p             ON p.id = m.user_id
  WHERE t.id = p_team_id
  ORDER BY (m.user_id = t.leader_id) DESC, m.joined_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_public_detail(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_team_public_detail(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Roll number grammar, enforced at the database level.
--    prefix: exactly one of 24AK1A25 | 25AK5A25 | 25AK1A25 | 26AK5A25
--    suffix: 01-99 or A0-A9 / B0-B9 / C0-C9 / D0-D9 / E0-E9
--    NULL is allowed (participant has not completed their profile yet).
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_roll_number_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_roll_number_format
  CHECK (
    roll_number IS NULL
    OR roll_number ~ '^(24AK1A25|25AK5A25|25AK1A25|26AK5A25)([0-9]{2}|[A-E][0-9])$'
  );

-- @@END@@
