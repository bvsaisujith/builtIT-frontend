'use client';

import { supabase } from './supabase';
import type {
  TeamWithDetails,
  EventConfig,
  ProblemStatement,
  Domain,
  Team,
  TeamMemberPublic,
} from './types';

// ---------------------------------------------------------------------------
// Auth / profile helpers
// ---------------------------------------------------------------------------

export async function getSessionUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) { return false; }
  return data as boolean;
}

export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Teams + team members (Requirement 16: fix missing user_id filter)
// ---------------------------------------------------------------------------

export async function getMyTeam(): Promise<TeamWithDetails | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('team_memberships')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle();

    if (!membership) return null;

  return getTeamById(membership.team_id);
}

export async function getTeamById(teamId: string): Promise<TeamWithDetails | null> {
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .maybeSingle();

  if (!team) return null;

  // Member list (public fields only — requirement 17). Uses the RPC so we
  // never expose email/phone/roll_number to teammates.
  const { data: members } = await supabase
    .rpc('get_team_members', { p_team_id: team.id });

  const typedTeam = team as unknown as Team & {
    domain_id: string | null;
    problem_statement_id: string | null;
  };

  // Problem statement (if selected)
  let problemStatement: ProblemStatement | null = null;
  if (typedTeam.problem_statement_id) {
    const { data: ps } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('id', typedTeam.problem_statement_id)
      .maybeSingle();
    problemStatement = ps as ProblemStatement | null;
  }

  // Domain (if selected)
  let domain: Domain | null = null;
  if (typedTeam.domain_id) {
    const { data: dom } = await supabase
      .from('domains')
      .select('*')
      .eq('id', typedTeam.domain_id)
      .maybeSingle();
    domain = dom as Domain | null;
  }

  // Submissions
  const { data: aimSub } = await supabase
    .from('submissions')
    .select('*')
    .eq('team_id', team.id)
    .eq('stage', 'AIM')
    .maybeSingle();

  const { data: finalSub } = await supabase
    .from('submissions')
    .select('*')
    .eq('team_id', team.id)
    .eq('stage', 'FINAL')
    .maybeSingle();

  return {
    ...typedTeam,
    members: (members ?? []) as TeamMemberPublic[],
    problem_statement: problemStatement,
    domain,
    submissions: {
      aim: (aimSub ?? null) as TeamWithDetails['submissions']['aim'],
      final: (finalSub ?? null) as TeamWithDetails['submissions']['final'],
    },
  } as TeamWithDetails;
}

// Requirement 10: use the database-generated team_code, not a UUID prefix.
export function getTeamCode(team: Team): string {
  return team.team_code ?? '';
}

export async function isTeamLeader(teamId: string): Promise<boolean> {
  const { data } = await supabase.rpc('is_team_leader', { p_team_id: teamId });
  return data as boolean;
}

export async function isTeamMember(teamId: string): Promise<boolean> {
  const { data } = await supabase.rpc('is_team_member', { p_team_id: teamId });
  return data as boolean;
}

// ---------------------------------------------------------------------------
// Event config
// ---------------------------------------------------------------------------

export async function getEventConfig(): Promise<EventConfig | null> {
  const { data } = await supabase
    .from('event_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as EventConfig | null;
}

// ---------------------------------------------------------------------------
// Domains + Problem Statements (Requirement 7, 9, 15)
// ---------------------------------------------------------------------------

export async function getActiveDomains(): Promise<Domain[]> {
  const { data } = await supabase
    .from('domains')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data ?? []) as Domain[];
}

export async function getAllDomains(): Promise<Domain[]> {
  const { data } = await supabase
    .from('domains')
    .select('*')
    .order('display_order', { ascending: true });
  return (data ?? []) as Domain[];
}

export async function getDomainBySlug(slug: string): Promise<Domain | null> {
  const { data } = await supabase
    .from('domains')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data as Domain | null;
}

// Curated problems (team_id IS NULL), filtered by active domain and problem.
export async function getCuratedProblemStatements(
  domainId?: string,
): Promise<ProblemStatement[]> {
  let query = supabase
    .from('problem_statements')
    .select('*')
    .is('team_id', null)
    .eq('is_active', true);

  if (domainId) {
    query = query.eq('domain_id', domainId);
  }

  const { data } = await query.order('display_order', { ascending: true });
  return (data ?? []) as ProblemStatement[];
}

export async function getProblemStatement(id: string): Promise<ProblemStatement | null> {
  const { data } = await supabase
    .from('problem_statements')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data as ProblemStatement | null;
}

// ---------------------------------------------------------------------------
// Team join requests (Requirement 8)
// ---------------------------------------------------------------------------

export interface JoinRequest {
  id: string;
  team_id: string;
  requester_id: string;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
}

// A pending join request enriched with the requester's PUBLIC profile fields
// (name, GitHub identity, avatar). Served by the SECURITY DEFINER RPC
// get_pending_join_requests_public (migration 010) because profiles SELECT is
// self-only - without the RPC the leader would only see a raw requester UUID.
export interface PendingJoinRequest extends JoinRequest {
  full_name: string | null;
  github_username: string | null;
  github_url: string | null;
  avatar_url: string | null;
}

export async function getPendingJoinRequests(teamId: string): Promise<PendingJoinRequest[]> {
  const { data, error } = await supabase.rpc('get_pending_join_requests_public', {
    p_team_id: teamId,
  });
  if (error) return [];
  return (data ?? []) as unknown as PendingJoinRequest[];
}

export async function createJoinRequest(
  teamId: string,
  message?: string,
): Promise<{ error: string | null }> {
  const user = await getSessionUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: membership } = await supabase
    .from('team_memberships')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership) {
    return { error: 'You are already a member of a team.' };
  }

  const { error } = await supabase
    .from('team_join_requests')
    .insert({
      team_id: teamId,
      requester_id: user.id,
      message: message || null,
    });

  return { error: error ? error.message : null };
}

// The current user's live (pending) join request, with the target team's name
// and code so the join page can show "waiting for approval of <team>".
export interface MyPendingRequest extends JoinRequest {
  team: { id: string; name: string; team_code: string | null } | null;
}

export async function getMyPendingJoinRequest(): Promise<MyPendingRequest | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data } = await supabase
    .from('team_join_requests')
    .select('*, team:teams(id, name, team_code)')
    .eq('requester_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as MyPendingRequest;
}

// Resolve a human-readable team code (BIT-XXXXXX) to a joinable team.
export async function getTeamByCode(code: string): Promise<Team | null> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return null;

  // Teams RLS only lets members/leaders SELECT from `teams`, so a participant
  // without a team would always get an empty result here. Use the
  // SECURITY DEFINER directory RPC (migration 007) instead - it returns
  // public-safe fields to any signed-in participant.
  const { data: allTeams } = await supabase.rpc('list_teams_public');
  if (!allTeams) return null;

  const wanted = normalized.startsWith('BIT-') ? normalized : `BIT-${normalized}`;
  const match = (allTeams as { id: string; name: string; team_code: string | null; is_locked: boolean }[])
    .find(t => (t.team_code ?? '').toUpperCase() === wanted);

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    team_code: match.team_code,
    is_locked: match.is_locked,
    leader_id: '',
    category: null,
    domain_id: null,
    problem_statement_id: null,
    created_at: '',
  } as Team;
}

// Leader selects/changes the team's problem statement. The composite FK
// (problem_statement_id, domain_id) requires both values to travel together —
// the database rejects a problem that does not belong to the chosen domain.
export async function selectTeamProblem(
  teamId: string,
  domainId: string,
  problemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('teams')
    .update({ domain_id: domainId, problem_statement_id: problemId })
    .eq('id', teamId);

  return { error: error ? error.message : null };
}

export async function respondToJoinRequest(
  requestId: string,
  action: 'approve' | 'reject' | 'cancel',
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('respond_to_join_request', {
    p_request_id: requestId,
    p_action: action,
  });
  return { error: error ? error.message : null };
}

// ---------------------------------------------------------------------------
// Admin operations (requirement 18/19: RLS rejects these for non-admins)
// ---------------------------------------------------------------------------

export async function updateEventConfig(
  values: Partial<Pick<EventConfig, 'aim_deadline' | 'final_deadline' | 'registration_open' | 'max_team_size'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('event_config')
    .update(values)
    .eq('id', 1);
  return { error: error ? error.message : null };
}

export async function setDomainActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('domains')
    .update({ is_active: isActive })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export async function setProblemActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('problem_statements')
    .update({ is_active: isActive })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export async function createDomain(
  values: { name: string; slug: string; short_label?: string | null; icon?: string | null; description?: string | null },
): Promise<{ error: string | null }> {
  const { data: maxRow } = await supabase
    .from('domains')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('domains')
    .insert({
      name: values.name,
      slug: values.slug,
      short_label: values.short_label || null,
      icon: values.icon || null,
      description: values.description || null,
      display_order: (maxRow?.display_order ?? 0) + 1,
    });
  return { error: error ? error.message : null };
}

export async function createProblemStatement(
  values: { title: string; description: string; domain_id: string },
): Promise<{ error: string | null }> {
  const { data: maxRow } = await supabase
    .from('problem_statements')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: domain } = await supabase
    .from('domains')
    .select('name')
    .eq('id', values.domain_id)
    .maybeSingle();

  const { error } = await supabase
    .from('problem_statements')
    .insert({
      team_id: null,
      title: values.title,
      description: values.description,
      domain_id: values.domain_id,
      category: domain?.name ?? null,
      display_order: (maxRow?.display_order ?? 0) + 1,
      is_active: true,
    });
  return { error: error ? error.message : null };
}

// ---------------------------------------------------------------------------
// Team directory (public-safe; uses migration 007 SECURITY DEFINER RPCs)
// ---------------------------------------------------------------------------

export interface TeamDirectoryRow {
  id: string;
  name: string;
  team_code: string | null;
  is_locked: boolean;
  created_at: string;
  domain_name: string | null;
  domain_slug: string | null;
  problem_title: string | null;
  member_count: number;
  leader_name: string | null;
  leader_github: string | null;
  leader_avatar: string | null;
}

export async function getTeamsDirectory(): Promise<TeamDirectoryRow[]> {
  const { data, error } = await supabase.rpc('list_teams_public');
  if (error || !data) return [];
  return data as unknown as TeamDirectoryRow[];
}

export interface TeamPublicMember {
  member_id: string;
  member_user_id: string;
  member_full_name: string | null;
  member_github_username: string | null;
  member_github_url: string | null;
  member_avatar_url: string | null;
  member_year: string | null;
  member_section: string | null;
  member_is_leader: boolean;
  member_joined_at: string;
}

export interface TeamPublicDetail {
  id: string;
  name: string;
  team_code: string | null;
  is_locked: boolean;
  created_at: string;
  domain_name: string | null;
  domain_slug: string | null;
  problem_title: string | null;
  problem_description: string | null;
  member_count: number;
  leader_id: string | null;
  members: TeamPublicMember[];
}

export async function getTeamPublicDetail(teamId: string): Promise<TeamPublicDetail | null> {
  const { data, error } = await supabase
    .rpc('get_team_public_detail', { p_team_id: teamId });

  if (error || !data || data.length === 0) return null;

  const first = data[0] as unknown as Omit<TeamPublicDetail, 'members'> & TeamPublicMember;
  const members: TeamPublicMember[] = (data as unknown as (Omit<TeamPublicDetail, 'members'> & TeamPublicMember)[]).map(m => ({
    member_id: m.member_id,
    member_user_id: m.member_user_id,
    member_full_name: m.member_full_name,
    member_github_username: m.member_github_username,
    member_github_url: m.member_github_url,
    member_avatar_url: m.member_avatar_url,
    member_year: m.member_year,
    member_section: m.member_section,
    member_is_leader: m.member_is_leader,
    member_joined_at: m.member_joined_at,
  }));

  return {
    id: first.id,
    name: first.name,
    team_code: first.team_code,
    is_locked: first.is_locked,
    created_at: first.created_at,
    domain_name: first.domain_name,
    domain_slug: first.domain_slug,
    problem_title: first.problem_title,
    problem_description: first.problem_description,
    member_count: first.member_count,
    leader_id: first.leader_id,
    members,
  };
}

// ---------------------------------------------------------------------------
// Admin: remove participants / teams (migration 009 SECURITY DEFINER RPCs)
// ---------------------------------------------------------------------------

export async function adminDeleteParticipant(
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_delete_participant', { p_user_id: userId });
  return { error: error ? error.message : null };
}

export async function adminDeleteTeam(
  teamId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_delete_team', { p_team_id: teamId });
  return { error: error ? error.message : null };
}

// Admin overview: all teams with domain/problem + member counts.
export interface AdminTeamRow {
  id: string;
  name: string;
  team_code: string | null;
  is_locked: boolean;
  created_at: string;
  domain: { name: string; slug: string } | null;
  problem_statement: { title: string } | null;
  member_count: number;
}

export async function getAdminTeams(): Promise<AdminTeamRow[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*, domain:domains(name, slug), problem_statement:problem_statements(title), team_memberships(count)');

  if (error || !data) return [];
  return (data as unknown as (AdminTeamRow & { team_memberships: { count: number }[] })[]).map(row => ({
    id: row.id,
    name: row.name,
    team_code: row.team_code,
    is_locked: row.is_locked,
    created_at: row.created_at,
    domain: row.domain,
    problem_statement: row.problem_statement,
    member_count: row.team_memberships?.[0]?.count ?? 0,
  }));
}

export interface AdminParticipantRow {
  id: string;
  full_name: string | null;
  email: string | null;
  roll_number: string | null;
  year: string | null;
  section: string | null;
  github_username: string | null;
  profile_completed_at: string | null;
  role: string;
  created_at: string;
}

export async function getAdminParticipants(): Promise<AdminParticipantRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as AdminParticipantRow[];
}
