-- ============================================================================
-- built IT 2K26 - Migration 010 (additive only)
-- Pending join requests with the requester's PUBLIC profile fields.
-- ============================================================================
-- Problem: team_join_requests only exposes requester_id to the leader, and
-- profiles SELECT is self-only (requirement 17), so the dashboard could only
-- render "Request #<uuid-fragment>" - a random string instead of a human.
--
-- Fix mirrors migration 006's get_team_members pattern: a SECURITY DEFINER RPC
-- that returns ONLY public fields (name, GitHub identity, avatar). Email,
-- phone and roll_number are not in the return shape, so they cannot leak.
-- Guarded the same way as respond_to_join_request: only the team's leader or
-- an administrator may call it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_join_requests_public(p_team_id uuid)
RETURNS TABLE (
  id              uuid,
  requester_id    uuid,
  message         text,
  created_at      timestamptz,
  full_name       text,
  github_username text,
  github_url      text,
  avatar_url      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id,
         r.requester_id,
         r.message,
         r.created_at,
         p.full_name,
         p.github_username,
         p.github_url,
         p.avatar_url
    FROM public.team_join_requests r
    JOIN public.profiles p ON p.id = r.requester_id
   WHERE r.team_id = p_team_id
     AND r.status = 'pending'
     AND (public.is_team_leader(p_team_id) OR public.is_admin())
   ORDER BY r.created_at ASC;
$$;

-- Signed-in team leaders/admins only; anonymous requests may call nothing.
REVOKE EXECUTE ON FUNCTION public.get_pending_join_requests_public(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_pending_join_requests_public(uuid) TO authenticated;

-- @@END@@
