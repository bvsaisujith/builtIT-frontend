/*
# built IT 2K26 - Migration 006
# GitHub OAuth onboarding, Domains, Admin role, Team codes, Join requests

## Safety
ADDITIVE ONLY. This migration never drops a table, never deletes rows and never
resets data. It only:
  - adds columns / constraints / indexes / triggers / policies
  - normalises empty strings ("") to NULL (a cleanup, not a deletion)
  - backfills new columns from data that already exists
It must run AFTER migrations 001..005.

## What it delivers (requirement -> mechanism)
  1  roll_number is KEPT, nullable until onboarding -> profiles.roll_number DROP NOT NULL
  2  email is optional                             -> profiles.email DROP NOT NULL
  3  phone required for a completed profile        -> profiles_completion_required_fields CHECK
  4  year + section required for a completed profile -> same CHECK
  5  GitHub username/url/avatar come from the identity -> handle_new_user() reads OAuth metadata
  6  /complete-profile terminology                 -> profiles.profile_completed_at gate
  7  Domains -> Problem statements are DB-driven   -> public.domains + problem_statements.domain_id
                                                      (legacy `category` values migrated, not deleted)
  8  Join requests + leader approval               -> public.team_join_requests + respond_to_join_request()
  9  Configurable max team size (default 4)        -> event_config.max_team_size + membership trigger
 10  Unique human-readable team code (BIT-7K4P9X)  -> teams.team_code + UNIQUE + generator trigger
 11  One team per participant                      -> team_memberships UNIQUE(user_id) PRESERVED
 12  Two teams may pick the same problem           -> deliberately NO unique constraint there
 13  Only the leader may select/change domain+problem -> enforce_team_problem_selection() trigger
 14  Problem must belong to the chosen domain      -> composite FK (problem_statement_id, domain_id)
 15  Inactive domain/problem cannot be NEWLY selected, but stays viewable -> selection trigger
 16/17 see lib/data.ts + get_team_members() RPC (safe teammate fields only)
 18  Only admins change event_config              -> admin-only RLS policies
 19  Real admin role, no hardcoded email          -> profiles.role + public.is_admin() (SECURITY DEFINER)
*/

-- ============================================================================
-- SECTION 1 - PROFILES: optional email, onboarding-completed gate, GitHub fields
-- ============================================================================

-- 1.1 Email is optional (GitHub may not expose an email at all).
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- 1.2 roll_number is KEPT (participant identification) but may be NULL until onboarding.
--     The UNIQUE constraint is intentionally kept so no two participants can ever
--     claim the same roll number. Postgres treats multiple NULLs as distinct, so
--     many not-yet-onboarded participants can coexist.
ALTER TABLE public.profiles ALTER COLUMN roll_number DROP NOT NULL;

-- 1.3 phone may be NULL only temporarily, until the profile is completed (see CHECK 1.6).
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

-- 1.4 Identity fields sourced automatically from the GitHub provider identity.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 1.5 Academic fields collected by /complete-profile.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS year    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section text;

-- 1.6 Completion gate + role. profile_completed_at IS NULL means "onboarding pending".
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'participant';

-- 1.7 Normalise legacy empty strings to NULL so UNIQUE(email)/UNIQUE(roll_number)
--     tolerate many OAuth participants. Scoped to rows that actually contain
--     empty/blank values, so it is a no-op on healthy data.
UPDATE public.profiles
   SET email           = NULLIF(lower(btrim(COALESCE(email, ''))), ''),
       roll_number     = NULLIF(btrim(COALESCE(roll_number, '')), ''),
       phone           = NULLIF(btrim(COALESCE(phone, '')), ''),
       github_username = NULLIF(btrim(COALESCE(github_username, '')), '')
 WHERE COALESCE(email, '') = ''
    OR COALESCE(roll_number, '') = ''
    OR COALESCE(phone, '') = ''
    OR COALESCE(github_username, '') = '';

-- 1.8 Constraints (idempotent: drop-then-add).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_valid
  CHECK (role IN ('participant', 'admin'));

-- Requirements 1 + 3 + 4: a profile may only be marked complete when the
-- identifying fields (roll number, phone, year, section) are present.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_completion_required_fields;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_completion_required_fields CHECK (
  profile_completed_at IS NULL
  OR (roll_number IS NOT NULL AND phone IS NOT NULL AND year IS NOT NULL AND section IS NOT NULL)
);

-- Light shape guards so junk cannot be stored through the completion form.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_shape;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_shape
  CHECK (phone IS NULL OR char_length(btrim(phone)) BETWEEN 6 AND 20);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_year_shape;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_year_shape
  CHECK (year IS NULL OR char_length(btrim(year)) BETWEEN 1 AND 20);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_section_shape;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_section_shape
  CHECK (section IS NULL OR char_length(btrim(section)) BETWEEN 1 AND 20);

-- ============================================================================
-- SECTION 2 - EVENT CONFIG: configurable team size (admin-writable only)
-- ============================================================================

-- Requirement 9: max team size is configuration, not a hardcoded constant.
ALTER TABLE public.event_config ADD COLUMN IF NOT EXISTS max_team_size integer NOT NULL DEFAULT 4;

ALTER TABLE public.event_config DROP CONSTRAINT IF EXISTS event_config_max_team_size_range;
ALTER TABLE public.event_config ADD CONSTRAINT event_config_max_team_size_range
  CHECK (max_team_size BETWEEN 1 AND 20);

-- ============================================================================
-- SECTION 3 - HELPER FUNCTIONS (SECURITY DEFINER, safe to use inside RLS)
-- ============================================================================

-- Requirement 19: admin authorisation is enforced in the database, never in
-- frontend code and never via a hardcoded email address. SECURITY DEFINER is
-- required because a policy cannot read the table it protects through another
-- policy.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships m
    WHERE m.team_id = p_team_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_leader(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND t.leader_id = auth.uid()
  );
$$;

-- Requirement 9: single source of truth for the team-size rule.
CREATE OR REPLACE FUNCTION public.team_size_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT max_team_size FROM public.event_config WHERE id = 1), 4);
$$;

-- Raises when a team has already reached the configured maximum. Called from the
-- team_memberships trigger and from the join-request approval RPC, so the limit
-- holds no matter which code path adds a member.
CREATE OR REPLACE FUNCTION public.assert_team_has_room(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_max   integer := public.team_size_limit();
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.team_memberships m
   WHERE m.team_id = p_team_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Team is full (% members maximum)', v_max
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- A participant who is not yet a member cannot read the teams row (teams RLS =
-- member OR leader), so join-request creation uses this narrow probe instead of a
-- broad teams SELECT policy that would expose every team to everyone.
CREATE OR REPLACE FUNCTION public.team_is_open_for_requests(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND COALESCE(t.is_locked, false) = false
  );
$$;

-- ============================================================================
-- SECTION 4 - PROFILE CREATION / NORMALISATION / ROLE PROTECTION
-- ============================================================================

-- 4.1 Trim input and turn blank strings into NULL. This is what makes
--     UNIQUE(email) and UNIQUE(roll_number) tolerate OAuth participants that
--     genuinely have no email / no roll number yet (UNIQUE allows many NULLs).
CREATE OR REPLACE FUNCTION public.normalize_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.full_name       := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  NEW.email           := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
  NEW.roll_number     := NULLIF(btrim(COALESCE(NEW.roll_number, '')), '');
  NEW.phone           := NULLIF(btrim(COALESCE(NEW.phone, '')), '');
  NEW.github_username := NULLIF(btrim(COALESCE(NEW.github_username, '')), '');
  NEW.github_url      := NULLIF(btrim(COALESCE(NEW.github_url, '')), '');
  NEW.avatar_url      := NULLIF(btrim(COALESCE(NEW.avatar_url, '')), '');
  NEW.year            := NULLIF(btrim(COALESCE(NEW.year, '')), '');
  NEW.section         := NULLIF(btrim(COALESCE(NEW.section, '')), '');

  -- full_name is NOT NULL in the schema; never allow a blank one to slip through
  IF NEW.full_name IS NULL THEN
    NEW.full_name := 'Participant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_fields ON public.profiles;
CREATE TRIGGER normalize_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_fields();

-- 4.2 handle_new_user() now serves BOTH email/password signup and GitHub OAuth.
--     Requirement 5: the GitHub username, profile URL and avatar are taken from
--     the authenticated provider identity - the participant is never asked to
--     type them. profile_completed_at stays NULL, which is what sends the person
--     to /complete-profile to supply roll_number, phone, year and section.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meta    jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_name    text;
  v_github  text;
  v_url     text;
  v_avatar  text;
  v_year    text;
  v_section text;
BEGIN
  -- Display name: providers differ, so try each known claim in order.
  v_name := COALESCE(
    NULLIF(btrim(COALESCE(v_meta->>'full_name', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'name', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'user_name', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'preferred_username', '')), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Participant'
  );

  -- GitHub identity, straight from the provider.
  v_github := NULLIF(btrim(COALESCE(v_meta->>'user_name', '')), '');
  IF v_github IS NOT NULL THEN
    v_url := 'https://github.com/' || v_github;
  ELSE
    -- email/password signup may optionally carry a username in metadata
    v_github := NULLIF(btrim(COALESCE(v_meta->>'github_username', '')), '');
    IF v_github IS NOT NULL THEN
      v_url := 'https://github.com/' || v_github;
    END IF;
  END IF;

  v_avatar  := NULLIF(btrim(COALESCE(v_meta->>'avatar_url', '')), '');
  v_year    := NULLIF(btrim(COALESCE(v_meta->>'year', '')), '');
  v_section := NULLIF(btrim(COALESCE(v_meta->>'section', '')), '');

  INSERT INTO public.profiles (
    id, email, full_name, roll_number, phone,
    github_username, github_url, avatar_url, year, section
  )
  VALUES (
    NEW.id,
    NULLIF(lower(btrim(COALESCE(NEW.email, ''))), ''),
    v_name,
    NULLIF(btrim(COALESCE(v_meta->>'roll_number', '')), ''),
    NULLIF(btrim(COALESCE(v_meta->>'phone', '')), ''),
    v_github,
    v_url,
    v_avatar,
    v_year,
    v_section
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SECTION 5 - DOMAINS (requirement 7: Domains -> Problem statements, DB-driven)
-- ============================================================================
-- The legacy free-text `category` column is KEPT (never dropped) so nothing that
-- already reads it breaks. `domains` becomes the source of truth and
-- problem_statements.domain_id links each problem to its domain.

CREATE TABLE IF NOT EXISTS public.domains (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL,
  short_label   text,
  description   text,
  icon          text,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness for both human keys.
CREATE UNIQUE INDEX IF NOT EXISTS domains_slug_key ON public.domains (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS domains_name_key ON public.domains (lower(name));

-- 5.1 Seed the eight domains the application already advertises.
--     Ordering/labels/icons mirror CATEGORIES in src/lib/types.ts, so the
--     existing UI keeps rendering the same names and icons.
INSERT INTO public.domains (name, slug, short_label, icon, display_order)
VALUES
  ('Cyber Security', 'cyber-security', 'CYBER',   'shield', 1),
  ('Cloud',          'cloud',          'CLOUD',   'cloud',  2),
  ('IoT',            'iot',            'IOT',     'signal', 3),
  ('AI',             'ai',             'AI',      'brain',  4),
  ('Data Science',   'data-science',   'DATA',    'data',   5),
  ('AR / VR',        'ar-vr',          'AR/VR',   'vr',     6),
  ('Automation',     'automation',     'AUTO',    'gear',   7),
  ('Quantum',        'quantum',        'QUANTUM', 'atom',   8)
ON CONFLICT DO NOTHING;

-- 5.2 MIGRATE (not delete) any other category values that already exist on
--     problem_statements or teams, so no existing problem statement is orphaned.
INSERT INTO public.domains (name, slug, display_order)
SELECT DISTINCT
       btrim(src.category),
       lower(regexp_replace(btrim(src.category), '[^a-zA-Z0-9]+', '-', 'g')),
       100
  FROM (
        SELECT category FROM public.problem_statements
        UNION
        SELECT category FROM public.teams
       ) AS src
 WHERE src.category IS NOT NULL
   AND btrim(src.category) <> ''
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 6 - PROBLEM STATEMENTS: link to domains
-- ============================================================================

ALTER TABLE public.problem_statements ADD COLUMN IF NOT EXISTS domain_id uuid;
ALTER TABLE public.problem_statements ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.problem_statements ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- 6.1 Backfill: legacy curated problems keep their category as their domain.
UPDATE public.problem_statements ps
   SET domain_id = d.id
  FROM public.domains d
 WHERE ps.domain_id IS NULL
   AND lower(btrim(d.name)) = lower(btrim(ps.category));

-- 6.2 Anything left (blank legacy category) is parked on an inactive 'General'
--     domain rather than being deleted, then domain_id becomes mandatory.
DO $$
DECLARE
  v_general uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.problem_statements WHERE domain_id IS NULL) THEN
    SELECT id INTO v_general FROM public.domains WHERE lower(name) = 'general' LIMIT 1;
    IF v_general IS NULL THEN
      INSERT INTO public.domains (name, slug, display_order, is_active)
      VALUES ('General', 'general', 999, false)
      RETURNING id INTO v_general;
    END IF;
    UPDATE public.problem_statements SET domain_id = v_general WHERE domain_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.problem_statements ALTER COLUMN domain_id SET NOT NULL;

ALTER TABLE public.problem_statements DROP CONSTRAINT IF EXISTS problem_statements_domain_fk;
ALTER TABLE public.problem_statements ADD CONSTRAINT problem_statements_domain_fk
  FOREIGN KEY (domain_id) REFERENCES public.domains (id) ON DELETE RESTRICT;

-- 6.3 Requirement 14: a problem statement must be selectable only together with
--     its own domain. This UNIQUE key is what makes the composite FK on
--     teams(problem_statement_id, domain_id) possible.
--     The composite FK depends on this UNIQUE constraint, so on a re-run the FK
--     must be dropped first (it is recreated in Section 7.4).
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_problem_domain_fk;
ALTER TABLE public.problem_statements DROP CONSTRAINT IF EXISTS problem_statements_id_domain_key;
ALTER TABLE public.problem_statements ADD CONSTRAINT problem_statements_id_domain_key
  UNIQUE (id, domain_id);


-- 6.4 `category` is now a derived legacy mirror of the domain name, so it no
--     longer has to be supplied by the client.
ALTER TABLE public.problem_statements ALTER COLUMN category DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_problem_statement_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.domain_id IS NOT NULL THEN
    SELECT d.name INTO v_name FROM public.domains d WHERE d.id = NEW.domain_id;
    IF v_name IS NOT NULL THEN
      NEW.category := v_name;   -- keep the legacy column truthful
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_problem_statement_category ON public.problem_statements;
CREATE TRIGGER sync_problem_statement_category
  BEFORE INSERT OR UPDATE ON public.problem_statements
  FOR EACH ROW EXECUTE FUNCTION public.sync_problem_statement_category();

CREATE INDEX IF NOT EXISTS problem_statements_domain_idx
  ON public.problem_statements (domain_id) WHERE team_id IS NULL;

-- ============================================================================
-- SECTION 7 - TEAMS: unique shareable code, domain link, leader-only selection
-- ============================================================================

-- 7.1 Requirement 10: human-readable, shareable, UNIQUE team code (BIT-7K4P9X).
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_code text;

-- Random code generator. Ambiguous glyphs (0/O and 1/I/L) are excluded on
-- purpose so a code can be read aloud or copied by hand without mistakes.
-- 32^6 = ~1.07 billion combinations.
CREATE OR REPLACE FUNCTION public.generate_team_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i    integer;
BEGIN
  LOOP
    v_code := 'BIT-';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    -- Loop until the candidate is actually free. UNIQUE index below is the
    -- final guarantee; this loop merely avoids pointless collisions.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.team_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- 7.2 Assign a code automatically on INSERT and keep it uppercase forever after.
--     A team code is an identifier people share, so it is never regenerated.
CREATE OR REPLACE FUNCTION public.assign_team_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.team_code IS NULL OR btrim(NEW.team_code) = '' THEN
      NEW.team_code := public.generate_team_code();
    ELSE
      NEW.team_code := upper(btrim(NEW.team_code));
    END IF;
  ELSE
    -- A team code is an identifier people share, so it is immutable once set.
    -- When it is still NULL (legacy rows being backfilled) a value is allowed.
    IF OLD.team_code IS NOT NULL THEN
      NEW.team_code := OLD.team_code;
    ELSIF NEW.team_code IS NULL OR btrim(NEW.team_code) = '' THEN
      NEW.team_code := public.generate_team_code();
    ELSE
      NEW.team_code := upper(btrim(NEW.team_code));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_team_code ON public.teams;
CREATE TRIGGER assign_team_code
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.assign_team_code();

-- 7.3 Backfill existing teams. One UPDATE per row (not a single set-based
--     UPDATE) so each generated code sees the codes assigned just before it.
DO $$
DECLARE
  r_team record;
  v_code text;
BEGIN
  FOR r_team IN SELECT id FROM public.teams WHERE team_code IS NULL OR btrim(team_code) = '' LOOP
    SELECT public.generate_team_code() INTO v_code;
    UPDATE public.teams SET team_code = v_code WHERE id = r_team.id;
  END LOOP;
END $$;

-- Normalise any legacy casing, then enforce uniqueness at the database level.
UPDATE public.teams SET team_code = upper(btrim(team_code))
 WHERE team_code IS NOT NULL AND team_code <> upper(btrim(team_code));

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_team_code_shape;
ALTER TABLE public.teams ADD CONSTRAINT teams_team_code_shape
  CHECK (team_code IS NULL OR team_code ~ '^BIT-[A-Z0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS teams_team_code_key ON public.teams (team_code);

-- 7.4 Requirement 7/14: each team stores the DOMAIN it competes in, alongside
--     its problem statement. Both are nullable until the leader chooses.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS domain_id uuid;

-- Backfill domain from the already-selected problem statement...
UPDATE public.teams t
   SET domain_id = ps.domain_id
  FROM public.problem_statements ps
 WHERE t.problem_statement_id = ps.id
   AND t.domain_id IS NULL;

-- ...and from the legacy `category` column for teams that never picked a problem.
UPDATE public.teams t
   SET domain_id = d.id
  FROM public.domains d
 WHERE t.domain_id IS NULL
   AND t.category IS NOT NULL
   AND lower(btrim(d.name)) = lower(btrim(t.category));

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_domain_fk;
ALTER TABLE public.teams ADD CONSTRAINT teams_domain_fk
  FOREIGN KEY (domain_id) REFERENCES public.domains (id) ON DELETE SET NULL;

-- Requirement 14, enforced by the DATABASE and not just the frontend:
-- a team can only point at a problem statement that belongs to its own domain.
-- (NULL problem_statement_id means "not chosen yet" and is still allowed.)
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_problem_domain_fk;
ALTER TABLE public.teams ADD CONSTRAINT teams_problem_domain_fk
  FOREIGN KEY (problem_statement_id, domain_id)
  REFERENCES public.problem_statements (id, domain_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS teams_domain_idx ON public.teams (domain_id);

-- ============================================================================
-- SECTION 8 - TEAM SELECTION RULES (requirements 13, 14, 15)
-- ============================================================================

-- `category` is now a legacy mirror of the domain name for teams as well, so it
-- is no longer required from the client.
ALTER TABLE public.teams ALTER COLUMN category DROP NOT NULL;

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
BEGIN
  -- Keep the legacy `category` text truthful with the chosen domain.
  IF NEW.domain_id IS NOT NULL THEN
    SELECT d.name INTO v_domain_name FROM public.domains d WHERE d.id = NEW.domain_id;
    IF v_domain_name IS NOT NULL THEN
      NEW.category := v_domain_name;
    END IF;
  END IF;

  -- ---------------------------------------------------------------- INSERT --
  IF TG_OP = 'INSERT' THEN
    -- Requirement 15: a NEW selection must point at an ACTIVE domain. This is what
    -- stops a brand-new team from choosing a domain that has been deactivated.
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

  -- ---------------------------------------------------------------- UPDATE --
  -- The leader of a team is immutable except by an administrator.
  IF NEW.leader_id IS DISTINCT FROM OLD.leader_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change the team leader'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Requirement 15 (second half): when the domain/problem are untouched we do NOT
  -- re-validate them. That is exactly what allows an existing team to keep VIEWING
  -- a selection that has since been deactivated.
  IF NEW.domain_id IS NOT DISTINCT FROM OLD.domain_id
     AND NEW.problem_statement_id IS NOT DISTINCT FROM OLD.problem_statement_id THEN
    RETURN NEW;
  END IF;

  -- Requirement 13: only the team leader (or an administrator) may select or
  -- change the domain / problem statement. Members can only view it.
  IF v_actor IS NOT NULL AND NOT (public.is_team_leader(OLD.id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the team leader can select or change the domain and problem statement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Requirement 15: moving to a DIFFERENT domain also requires that domain to be
  -- active. Leaving the selection untouched is always allowed (see the early
  -- return above), which is how an existing team keeps viewing an inactive choice.
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

  -- Requirement 14: friendly error here, composite FK teams_problem_domain_fk is
  -- the hard, unbypassable guarantee.
  IF v_problem_domain IS DISTINCT FROM NEW.domain_id THEN
    RAISE EXCEPTION 'The selected problem statement does not belong to the selected domain'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Requirement 15 (first half): only a CHANGED selection has to be active.
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

DROP TRIGGER IF EXISTS enforce_team_selection_rules ON public.teams;
CREATE TRIGGER enforce_team_selection_rules
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_selection_rules();

-- ============================================================================
-- SECTION 9 - TEAM MEMBERSHIP RULES (requirements 9 and 11)
-- ============================================================================

-- 9.1 Requirement 9: the maximum team size is read from
--     event_config.max_team_size (default 4) and enforced on every membership
--     insert, whichever code path performs it (direct insert, leader approval
--     through respond_to_join_request(), or an administrator).
CREATE OR REPLACE FUNCTION public.enforce_team_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- BEFORE INSERT: the new row is not counted yet, so a team already at the
  -- limit still raises here.
  PERFORM public.assert_team_has_room(NEW.team_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_capacity ON public.team_memberships;
CREATE TRIGGER enforce_team_capacity
  BEFORE INSERT ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_capacity();

-- 9.2 Requirement 11: a participant may belong to only ONE team. This is already
--     a hard guarantee from migration 001 (UNIQUE (user_id) on
--     team_memberships) and that constraint is deliberately NOT touched here.
--     The indexes below only make the lookups the policies perform cheap.
CREATE INDEX IF NOT EXISTS team_memberships_team_idx
  ON public.team_memberships (team_id);

-- 9.3 A leader must not silently abandon a populated team, because that would
--     leave a team nobody can manage (no one able to approve join requests or
--     choose the domain / problem statement).
CREATE OR REPLACE FUNCTION public.prevent_leader_abandoning_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams t
              WHERE t.id = OLD.team_id AND t.leader_id = OLD.user_id)
     AND EXISTS (SELECT 1 FROM public.team_memberships m
                  WHERE m.team_id = OLD.team_id AND m.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'The team leader cannot leave while the team still has members'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_leader_abandoning_team ON public.team_memberships;
CREATE TRIGGER prevent_leader_abandoning_team
  BEFORE DELETE ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_leader_abandoning_team();

-- ============================================================================
-- SECTION 10 - TEAM JOIN REQUESTS (requirement 8)
-- ============================================================================
-- A participant asks to join a team; the team LEADER approves or rejects.
-- The table keeps the decision history (approved/rejected/cancelled) so the
-- dashboard can show what happened to each request.

CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  message       text,
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  responded_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.team_join_requests DROP CONSTRAINT IF EXISTS team_join_requests_status_valid;
ALTER TABLE public.team_join_requests ADD CONSTRAINT team_join_requests_status_valid
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.team_join_requests DROP CONSTRAINT IF EXISTS team_join_requests_message_len;
ALTER TABLE public.team_join_requests ADD CONSTRAINT team_join_requests_message_len
  CHECK (message IS NULL OR char_length(message) <= 500);

-- At most ONE live request per (team, requester) ...
CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_pending_team_key
  ON public.team_join_requests (team_id, requester_id) WHERE status = 'pending';

-- ... and at most ONE live request per participant across ALL teams (they can
-- only be in one team anyway, so a second pending request would be pointless).
CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_pending_user_key
  ON public.team_join_requests (requester_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_join_requests_team_status_idx
  ON public.team_join_requests (team_id, status);

-- Leader/admin action: approve / reject. The requester can cancel their own
-- pending request. SECURITY DEFINER because approval must INSERT into
-- team_memberships even though the leader does not own that row.
CREATE OR REPLACE FUNCTION public.respond_to_join_request(
  p_request_id uuid,
  p_action     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request public.team_join_requests%ROWTYPE;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'cancel') THEN
    RAISE EXCEPTION 'Unknown action "%" (use approve / reject / cancel)', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_request FROM public.team_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been %', v_request.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cancel: only the requester themselves, and only while pending.
  IF p_action = 'cancel' THEN
    IF v_request.requester_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only cancel your own request'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    UPDATE public.team_join_requests
       SET status = 'cancelled', responded_at = now()
     WHERE id = p_request_id;
    RETURN NULL;
  END IF;

  -- Approve / reject: only the team leader (or an administrator).
  IF NOT (public.is_team_leader(v_request.team_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the team leader can respond to join requests'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.team_join_requests
       SET status = 'rejected', responded_by = auth.uid(), responded_at = now()
     WHERE id = p_request_id;
    RETURN NULL;
  END IF;

  -- ---- approve ------------------------------------------------------------
  -- The requester may have joined (or been approved into) another team after
  -- sending this request. UNIQUE(user_id) would abort with a raw error, so we
  -- give the friendly one first.
  IF EXISTS (SELECT 1 FROM public.team_memberships m
              WHERE m.user_id = v_request.requester_id) THEN
    UPDATE public.team_join_requests
       SET status = 'cancelled', responded_at = now()
     WHERE id = p_request_id;
    RAISE EXCEPTION 'This participant has already joined another team'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE((SELECT t.is_locked FROM public.teams t WHERE t.id = v_request.team_id), false) THEN
    RAISE EXCEPTION 'This team is locked and cannot accept new members'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Requirement 9: same configurable limit, whichever path adds the member.
  PERFORM public.assert_team_has_room(v_request.team_id);

  INSERT INTO public.team_memberships (team_id, user_id)
  VALUES (v_request.team_id, v_request.requester_id);

  UPDATE public.team_join_requests
     SET status = 'approved', responded_by = auth.uid(), responded_at = now()
   WHERE id = p_request_id;

  RETURN v_request.team_id;
END;
$$;

-- ============================================================================
-- SECTION 11 - ROW LEVEL SECURITY (requirements 8, 13, 17, 18, 19)
-- ============================================================================

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- DOMAINS ---
-- Readable by all authenticated users; only admins may create/modify/remove.
DROP POLICY IF EXISTS "domains_select" ON public.domains;
CREATE POLICY "domains_select" ON public.domains FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "domains_insert" ON public.domains;
CREATE POLICY "domains_insert" ON public.domains FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "domains_update" ON public.domains;
CREATE POLICY "domains_update" ON public.domains FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "domains_delete" ON public.domains;
CREATE POLICY "domains_delete" ON public.domains FOR DELETE
  TO authenticated USING (public.is_admin());

-- --------------------------------------------------- TEAM JOIN REQUESTS ---
-- Requester sees their own requests; the leader sees the ones for their team.
DROP POLICY IF EXISTS "join_requests_select" ON public.team_join_requests;
CREATE POLICY "join_requests_select" ON public.team_join_requests FOR SELECT
  TO authenticated USING (
    requester_id = auth.uid()
    OR public.is_team_leader(team_id)
    OR public.is_admin()
  );

-- Anyone authenticated may ASK to join an unlocked team. The team itself is not
-- exposed: the probe function checks lock status without a broad teams SELECT.
DROP POLICY IF EXISTS "join_requests_insert" ON public.team_join_requests;
CREATE POLICY "join_requests_insert" ON public.team_join_requests FOR INSERT
  TO authenticated WITH CHECK (
    requester_id = auth.uid()
    AND public.team_is_open_for_requests(team_id)
  );

-- The requester may cancel (status -> cancelled); the leader/admin may record a
-- decision. The RPC is the normal path; this policy supports both.
DROP POLICY IF EXISTS "join_requests_update" ON public.team_join_requests;
CREATE POLICY "join_requests_update" ON public.team_join_requests FOR UPDATE
  TO authenticated USING (
    requester_id = auth.uid()
    OR public.is_team_leader(team_id)
    OR public.is_admin()
  ) WITH CHECK (
    requester_id = auth.uid()
    OR public.is_team_leader(team_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "join_requests_delete" ON public.team_join_requests;
CREATE POLICY "join_requests_delete" ON public.team_join_requests FOR DELETE
  TO authenticated USING (public.is_admin());

-- --------------------------------------------- PROBLEM STATEMENTS (fix) ---
-- Leader-only selection is enforced by the trigger (Section 8); RLS stays
-- member-scoped so any member can still SEE what the team competes in.
DROP POLICY IF EXISTS "insert_own_problem_statement" ON public.problem_statements;
CREATE POLICY "insert_own_problem_statement" ON public.problem_statements FOR INSERT
  TO authenticated WITH CHECK (
    team_id IS NULL AND public.is_admin()          -- curated list: admin only
    OR team_id IS NOT NULL
       AND public.is_team_member(team_id)          -- self-authored: team member
  );

DROP POLICY IF EXISTS "update_own_problem_statement" ON public.problem_statements;
CREATE POLICY "update_own_problem_statement" ON public.problem_statements FOR UPDATE
  TO authenticated USING (
    (team_id IS NULL AND public.is_admin())
    OR (team_id IS NOT NULL AND public.is_team_member(team_id))
  ) WITH CHECK (
    (team_id IS NULL AND public.is_admin())
    OR (team_id IS NOT NULL AND public.is_team_member(team_id))
  );

-- ---------------------------------------------------------- EVENT CONFIG ---
-- Requirement 18: participants may READ the deadlines, but only an admin may
-- change them. Replaces the previous WITH CHECK (true) policies from 002.
DROP POLICY IF EXISTS "insert_event_config" ON public.event_config;
DROP POLICY IF EXISTS "update_event_config" ON public.event_config;
CREATE POLICY "insert_event_config" ON public.event_config FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_event_config" ON public.event_config FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------ PROFILES ---
-- Requirement 17: teammates must see only PUBLIC fields (name, GitHub, avatar,
-- year, section) - never email / phone / roll_number. RLS cannot hide columns,
-- so profiles SELECT stays SELF-ONLY (plus admins) and teammate data is served
-- exclusively through the get_team_members() SECURITY DEFINER RPC in Section 12.
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Role changes are guarded by a trigger instead of the RLS WITH CHECK above,
-- because a policy that re-reads profiles would recurse on itself (the same
-- problem migration 003 solved for team_memberships).
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- NOTE: the FIRST admin must be promoted out-of-band (Dashboard SQL editor or
-- service role):  UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid>';


-- ============================================================================
-- SECTION 12 - TEAMMATE VISIBILITY RPC (requirement 17) + GRANTS
-- ============================================================================

-- Returns the public view of a team's members: name, GitHub identity, avatar,
-- year, section. Private fields (email, phone, roll_number) are simply not in
-- the return shape, so they cannot leak - the RPC is the ONLY way teammates
-- see each other. The caller must be a member of that team or an administrator.
CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id uuid)
RETURNS TABLE (
  id              uuid,
  user_id         uuid,
  full_name       text,
  github_username text,
  github_url      text,
  avatar_url      text,
  year            text,
  section         text,
  is_leader       boolean,
  joined_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id,
         m.user_id,
         p.full_name,
         p.github_username,
         p.github_url,
         p.avatar_url,
         p.year,
         p.section,
         (t.leader_id = m.user_id) AS is_leader,
         m.joined_at
    FROM public.team_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    JOIN public.teams t    ON t.id = m.team_id
   WHERE m.team_id = p_team_id
     AND (public.is_team_member(p_team_id) OR public.is_admin())
   ORDER BY (t.leader_id = m.user_id) DESC, m.joined_at ASC;
$$;

-- Signed-in users only; anonymous requests may call nothing.
REVOKE EXECUTE ON FUNCTION public.get_team_members(uuid)              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_join_request(uuid, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_team_members(uuid)              TO authenticated;
GRANT  EXECUTE ON FUNCTION public.respond_to_join_request(uuid, text) TO authenticated;

-- ============================================================================
-- END OF MIGRATION 006 - additive only: no table dropped, no row deleted,
-- no existing constraint removed (team_memberships UNIQUE(user_id) untouched).
-- ============================================================================
-- @@END@@
