-- ============================================================================
-- Migration 015 — Winners podium
-- ============================================================================
-- Replaces the public leaderboard with a curated winners podium. The admin
-- console picks 3 teams (1st, 2nd, 3rd); everyone else sees the podium.
--
--   position: 1 = winner, 2 = runner-up, 3 = second runner-up (unique)
--   team_id:  FK to teams, unique per position
--
-- Everyone can read; only the service role (admin API) writes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.winners (
  position  integer PRIMARY KEY CHECK (position BETWEEN 1 AND 3),
  team_id   uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.winners IS
  'Curated winners podium: positions 1-3 map to 1st, 2nd and 3rd place. Managed from the admin console.';

ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "winners_select" ON public.winners;
CREATE POLICY "winners_select" ON public.winners
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No insert/update/delete policies: writes go through the /api/admin/winners
-- route which uses the service role key (bypasses RLS), exactly like the
-- other admin console mutations (migrations 011/013 pattern).

-- Realtime: let the winners page live-update without polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'winners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.winners;
  END IF;
END
$$;