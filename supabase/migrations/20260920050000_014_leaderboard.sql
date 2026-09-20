-- ============================================================================
-- built IT 2K26 - Migration 014
-- Public leaderboard: safe aggregated scores + live change signals.
-- ============================================================================
-- The leaderboard page (/leaderboard) shows every team's round 1 / round 2
-- totals and per-criterion points. Participants and anonymous visitors cannot
-- read public.submissions (RLS + it holds organizer-only feedback), so:
--
--   1. get_leaderboard() - SECURITY DEFINER RPC returning ONLY public-safe
--      columns (team, domain, problem, member count, round scores, criterion
--      breakdown, rank). No feedback, no contact details, no roll numbers.
--      Granted to anon + authenticated so the page works signed-out.
--
--   2. leaderboard_signals - one tiny row per team, touched whenever that
--      team's submissions change. RLS allows SELECT for everyone; writes only
--      happen through the SECURITY DEFINER trigger below. The table is added
--      to the supabase_realtime publication so the page receives a push event
--      the moment any evaluation is saved, then refetches fresh values from
--      get_leaderboard().
--
-- Safety: ADDITIVE ONLY (new table + function + trigger). Re-running is safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Public leaderboard RPC — rank, team name, total score. Nothing else.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  team_id   uuid,
  team_name text,
  total     integer,
  team_rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rounds AS (
    -- Round 1 = AIM submission, round 2 = FINAL submission (migration 013
    -- stores the organizer's round total in submissions.score).
    SELECT
      t.id     AS team_id,
      t.name   AS team_name,
      s1.score AS r1_score,
      s2.score AS r2_score
    FROM public.teams t
    LEFT JOIN public.submissions s1 ON s1.team_id = t.id AND s1.stage = 'AIM'
    LEFT JOIN public.submissions s2 ON s2.team_id = t.id AND s2.stage = 'FINAL'
  ), scored_teams AS (
    -- Only teams that have been evaluated appear on the leaderboard.
    SELECT
      team_id,
      team_name,
      (COALESCE(r1_score, 0) + COALESCE(r2_score, 0)) AS total
    FROM rounds
    WHERE r1_score IS NOT NULL OR r2_score IS NOT NULL
  )
  SELECT
    scored_teams.team_id,
    scored_teams.team_name,
    scored_teams.total,
    -- Teams with the same total share the same rank.
    rank() OVER (ORDER BY scored_teams.total DESC) AS team_rank
  FROM scored_teams
  ORDER BY team_rank ASC, team_name ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Change signals for live updates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leaderboard_signals (
  team_id    uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leaderboard_signals IS
  'Change signal for the live leaderboard: one row per team with submissions, touched by a trigger on public.submissions. Clients subscribe via Supabase Realtime and refetch get_leaderboard().';

ALTER TABLE public.leaderboard_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_signals_select" ON public.leaderboard_signals;
CREATE POLICY "leaderboard_signals_select" ON public.leaderboard_signals
  FOR SELECT
  TO anon, authenticated
  USING (true);
-- Deliberately NO insert/update/delete policies: only the SECURITY DEFINER
-- trigger writes here, so visitors can never forge a signal.

CREATE OR REPLACE FUNCTION public.sync_leaderboard_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.leaderboard_signals WHERE team_id = OLD.team_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.leaderboard_signals (team_id, updated_at)
  VALUES (NEW.team_id, now())
  ON CONFLICT (team_id) DO UPDATE SET updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_leaderboard_signal ON public.submissions;
CREATE TRIGGER sync_leaderboard_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_leaderboard_signal();

-- ---------------------------------------------------------------------------
-- 3. Stream the signals through Supabase Realtime (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'leaderboard_signals'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_signals;
  END IF;
END
$$;

-- @@END@@
