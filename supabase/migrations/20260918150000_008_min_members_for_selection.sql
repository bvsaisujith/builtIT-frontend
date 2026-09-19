-- ============================================================================
-- built IT 2K26 - Migration 008 (NON-DESTRUCTIVE)
-- Team size = exactly 3: max_team_size -> 3 and a 3-member minimum before
-- a leader may select a problem statement.
-- ============================================================================
-- 1. event_config.max_team_size is updated 4 -> 3 (the organizer's rule).
--    No existing team exceeds it.
-- 2. min_team_size_for_selection() exposes the floor (3) in one tunable place.
-- 3. The selection trigger from migration 006 is replaced with identical logic
--    PLUS the member-count check. Nothing else changes.
-- ============================================================================

-- 1. Maximum team size: 3 (was 4).
UPDATE public.event_config SET max_team_size = 3 WHERE id = 1;

-- 2. Tunable floor: change this constant to move the minimum later.
CREATE OR REPLACE FUNCTION public.min_team_size_for_selection()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 3;
$$;

-- 3. Selection trigger with the added member-count rule.
CREATE OR REPLACE FUNCTION public.enforce_team_selection_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor          uuid := auth.uid();
  v_problem_domain uuid;
  v_problem_active boolean;
  v_domain_active  boolean;
  v_domain_name    text;
  v_member_count   integer;
  v_min_members    integer := public.min_team_size_for_selection();
BEGIN
  -- Keep the legacy `category` text truthful with the chosen domain.
  IF NEW.domain_id IS NOT NULL THEN
    SELECT d.name INTO v_domain_name FROM public.domains d WHERE d.id = NEW.domain_id;
    IF v_domain_name IS NOT NULL THEN
      NEW.category := v_domain_name;
    END IF;
  END IF;

  ---------------------------------------------------------------- INSERT --
  IF TG_OP = 'INSERT' THEN
    IF NEW.domain_id IS NOT NULL THEN
      SELECT d.is_active INTO v_domain_active FROM public.domains d WHERE d.id = NEW.domain_id;
      IF v_domain_active IS NOT TRUE THEN
        RAISE EXCEPTION 'That domain is not open for selection'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF NEW.problem_statement_id IS NOT NULL THEN
      IF NEW.domain_id IS NULL THEN
        RAISE EXCEPTION 'Select a domain before selecting a problem statement'
          USING ERRCODE = 'check_violation';
      END IF;
      SELECT ps.domain_id, ps.is_active INTO v_problem_domain, v_problem_active
        FROM public.problem_statements ps WHERE ps.id = NEW.problem_statement_id;
      IF v_problem_domain IS DISTINCT FROM NEW.domain_id THEN
        RAISE EXCEPTION 'The selected problem statement does not belong to the selected domain'
          USING ERRCODE = 'foreign_key_violation';
      END IF;
      IF v_problem_active IS NOT TRUE THEN
        RAISE EXCEPTION 'That problem statement is not open for selection'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  ---------------------------------------------------------------- UPDATE --
  -- The leader of a team is immutable except by an administrator.
  IF NEW.leader_id IS DISTINCT FROM OLD.leader_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change the team leader'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- When the domain/problem are untouched we do NOT re-validate them. That is
  -- what allows an existing team to keep VIEWING a selection that has since
  -- been deactivated (or made under older rules).
  IF NEW.domain_id IS NOT DISTINCT FROM OLD.domain_id
     AND NEW.problem_statement_id IS NOT DISTINCT FROM OLD.problem_statement_id THEN
    RETURN NEW;
  END IF;

  -- Only the team leader (or an administrator) may select or change the
  -- domain / problem statement. Members can only view it.
  IF v_actor IS NOT NULL AND NOT (public.is_team_leader(OLD.id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the team leader can select or change the domain and problem statement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- NEW (migration 008): a selection can only be made or changed when the team
  -- has at least min_team_size_for_selection() members. Clearing the selection
  -- is always allowed, and administrators are exempt.
  IF NEW.problem_statement_id IS NOT NULL AND NOT public.is_admin() THEN
    SELECT count(*) INTO v_member_count
      FROM public.team_memberships m WHERE m.team_id = NEW.id;
    IF v_member_count < v_min_members THEN
      RAISE EXCEPTION
        'At least % team members are required before selecting a problem statement (your team has %)',
        v_min_members, v_member_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Moving to a DIFFERENT domain requires that domain to be active. Leaving the
  -- selection untouched is always allowed (early return above).
  IF NEW.domain_id IS NOT NULL AND NEW.domain_id IS DISTINCT FROM OLD.domain_id THEN
    SELECT d.is_active INTO v_domain_active FROM public.domains d WHERE d.id = NEW.domain_id;
    IF v_domain_active IS NOT TRUE THEN
      RAISE EXCEPTION 'That domain is no longer open for selection'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.problem_statement_id IS NULL THEN
    RETURN NEW;   -- leader is clearing the selection
  END IF;

  IF NEW.domain_id IS NULL THEN
    RAISE EXCEPTION 'Select a domain before selecting a problem statement'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ps.domain_id, ps.is_active INTO v_problem_domain, v_problem_active
    FROM public.problem_statements ps WHERE ps.id = NEW.problem_statement_id;

  IF v_problem_domain IS NULL THEN
    RAISE EXCEPTION 'Problem statement not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Friendly error here, composite FK teams_problem_domain_fk is the hard,
  -- unbypassable guarantee.
  IF v_problem_domain IS DISTINCT FROM NEW.domain_id THEN
    RAISE EXCEPTION 'The selected problem statement does not belong to the selected domain'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Only a CHANGED selection has to be active.
  IF NEW.problem_statement_id IS DISTINCT FROM OLD.problem_statement_id THEN
    IF v_problem_active IS NOT TRUE THEN
      RAISE EXCEPTION 'That problem statement is no longer open for selection'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT d.is_active INTO v_domain_active FROM public.domains d WHERE d.id = NEW.domain_id;
    IF v_domain_active IS NOT TRUE THEN
      RAISE EXCEPTION 'That domain is no longer open for selection'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger from migration 006 already points at this function; recreate
-- defensively anyway (signature unchanged, so this is a safe re-bind).
DROP TRIGGER IF EXISTS enforce_team_selection_rules ON public.teams;
CREATE TRIGGER enforce_team_selection_rules
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_selection_rules();

-- @@END@@

