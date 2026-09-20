-- ============================================================================
-- built IT 2K26 - Migration 013
-- Round 1 / Round 2 judging: per-criterion scores for the admin review screen.
-- ============================================================================
-- The admin review console scores a team against a fixed rubric per round:
--   Round 1 (AIM submission)   : 5 criteria, 100 points
--   Round 2 (FINAL submission) : 8 criteria, 100 points
-- Both rubrics live in one place in the frontend (src/lib/rubrics.ts); the API
-- route validates every incoming score against them before writing here.
--
-- Storage: one row per (team, stage) already exists in public.submissions
-- (UNIQUE(team_id, stage)), so the evaluation hangs off that same row:
--   criteria_scores : {"problem_understanding": 22, "ui_ux": 8, ...}
--   score           : the round total 0..100 (column already existed)
--   feedback        : the organizer's notes (column already existed)
--   reviewed_at/by  : who scored it and when
--
-- Safety: ADDITIVE ONLY. No table is dropped, no row is deleted or rewritten,
-- no existing column is altered. Re-running is safe (idempotent).
--
-- Security: RLS lets a team UPDATE its own submissions row, which would also
-- have allowed a participant to write score/feedback (or accept themselves).
-- The trigger below keeps those judging fields admin-only while leaving every
-- participant flow (submitting the aim/final, before or after a review)
-- untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Judging columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS criteria_scores jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by     text;

COMMENT ON COLUMN public.submissions.criteria_scores IS
  'Per-criterion rubric points keyed by criterion id, e.g. {"problem_understanding":22}. Round is implied by stage (AIM=round 1, FINAL=round 2).';
COMMENT ON COLUMN public.submissions.reviewed_by IS
  'Admin identity (cookie username or Supabase user id) that last scored this submission.';
COMMENT ON COLUMN public.submissions.reviewed_at IS
  'When the submission was last scored by an organizer.';

-- ---------------------------------------------------------------------------
-- 2. Keep the judging fields admin-only
-- ---------------------------------------------------------------------------
-- A participant request always carries a Supabase JWT; the organizer API and
-- the standalone admin cookie both run with the service role (migration 011
-- uses the same discriminator). Anything else is treated as "not an organizer":
-- judged values are silently discarded instead of raising, so no participant
-- submission flow can ever break because of this.
--
--   INSERT - a team may create its own row, but never with a decision, points,
--            feedback or review stamps attached.
--   UPDATE - the judged columns are restored to their stored values, and a
--            decision already recorded by an organizer survives later edits.
CREATE OR REPLACE FUNCTION public.protect_submission_judging()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_organizer boolean;
BEGIN
  v_organizer := public.is_admin() OR COALESCE(auth.role(), '') = 'service_role';

  IF v_organizer THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.criteria_scores := NULL;
    NEW.score           := NULL;
    NEW.feedback        := NULL;
    NEW.reviewed_at     := NULL;
    NEW.reviewed_by     := NULL;
    IF NEW.status NOT IN ('NOT_SUBMITTED', 'SUBMITTED') THEN
      NEW.status := 'SUBMITTED';
    END IF;
    RETURN NEW;
  END IF;

  -- Points, feedback and audit stamps are written by the review screen only.
  NEW.criteria_scores := OLD.criteria_scores;
  NEW.score           := OLD.score;
  NEW.feedback        := OLD.feedback;
  NEW.reviewed_at     := OLD.reviewed_at;
  NEW.reviewed_by     := OLD.reviewed_by;

  -- Participants may only move a submission between "not started" and
  -- "submitted". A decision already recorded by an organizer (under review /
  -- accepted / rejected) survives any later edit of the content.
  IF OLD.status IN ('UNDER_REVIEW', 'ACCEPTED', 'REJECTED') THEN
    NEW.status := OLD.status;
  ELSIF NEW.status NOT IN ('NOT_SUBMITTED', 'SUBMITTED') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_submission_judging ON public.submissions;
CREATE TRIGGER protect_submission_judging
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_submission_judging();

-- @@END@@
