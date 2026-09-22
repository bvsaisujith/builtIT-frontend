-- ============================================================================
-- Migration 016 — get_winners() RPC for the public podium
-- ============================================================================
-- The winners table is world-readable, but public.teams is not (only team
-- members can SELECT their own team), so the page's `team:teams(...)`
-- embed resolves to null for visitors and the podium showed "Unknown team".
--
-- Same fix as migration 014's get_leaderboard(): a SECURITY DEFINER RPC that
-- joins winners -> teams server-side and exposes ONLY position, team id, team
-- name and team code. Granted to anon + authenticated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_winners()
RETURNS TABLE (
  "position" integer,
  team_id    uuid,
  team_name  text,
  team_code  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.position,
    w.team_id,
    t.name AS team_name,
    t.team_code
  FROM public.winners w
  JOIN public.teams t ON t.id = w.team_id
  ORDER BY w.position ASC;
$$;

COMMENT ON FUNCTION public.get_winners() IS
  'Public winners podium (1st-3rd): position, team id, team name and team code only. Backs the /winners page.';

REVOKE EXECUTE ON FUNCTION public.get_winners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_winners() TO anon, authenticated;
