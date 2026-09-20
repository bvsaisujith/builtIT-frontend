-- ============================================================================
-- built IT 2K26 - Migration 011
-- Allow the admin API (service role) to execute the admin delete RPCs.
-- ============================================================================
-- The admin console's API routes (/api/admin/*) authenticate organizers with a
-- standalone HMAC cookie - there is no Supabase user in that request, so the
-- service role key is used. Migration 009 granted EXECUTE on the delete RPCs
-- only to `authenticated` and guarded them with is_admin() (which requires a
-- Supabase user). This migration:
--   1. Grants EXECUTE on both RPCs to `service_role`.
--   2. Extends the guard: is_admin() OR service_role.
-- GitHub admins (authenticated + is_admin) keep working exactly as before.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_participant(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_github text;
BEGIN
  IF NOT public.is_admin() AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only administrators can remove participants'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own account'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Administrator accounts cannot be removed from this screen'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT github_username INTO v_github FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Cascades remove: profile, team_memberships, join requests, any team they
  -- lead (and that team's memberships/submissions via further cascades).
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN 'Removed ' || COALESCE(v_github, 'participant');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_participant(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_delete_participant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_team(p_team_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT public.is_admin() AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only administrators can remove teams'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO v_name FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Remove any uploaded files for this team from the submissions bucket.
  -- Supabase blocks direct SQL deletes on storage.objects via the
  -- storage.protect_delete() trigger unless the transaction-local GUC
  -- storage.allow_delete_query is 'true' (normally only set by the Storage
  -- API). The trigger is owned by supabase_storage_admin, which this function
  -- owner cannot become a member of, so we set the GUC instead - the sanctioned
  -- escape hatch - and reset it immediately afterwards.
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.objects
   WHERE bucket_id = 'submissions'
     AND (name = 'teams/' || p_team_id::text
          OR name LIKE 'teams/' || p_team_id::text || '/%');
  PERFORM set_config('storage.allow_delete_query', 'false', true);

  -- Cascades remove: memberships, join requests, submissions.
  DELETE FROM public.teams WHERE id = p_team_id;

  RETURN 'Removed team ' || v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_team(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_delete_team(uuid) TO authenticated, service_role;

-- @@END@@
