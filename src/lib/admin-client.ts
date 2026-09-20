// ---------------------------------------------------------------------------
// Admin console client - talks to the cookie-protected /api/admin/* routes.
// ---------------------------------------------------------------------------
// The admin console page uses THIS module instead of data.ts: the standalone
// (username/password) admin has no Supabase user, so RLS-protected browser
// queries would fail. Both admin kinds (cookie-based and GitHub-based) hold
// the admin session cookie, so the API works for everyone.
// ---------------------------------------------------------------------------

import type { Domain, EventConfig, ProblemStatement } from './types';
import type { AdminParticipantRow, AdminTeamRow } from './data';

export interface AdminOverview {
  config: EventConfig | null;
  domains: Domain[];
  problems: ProblemStatement[];
  teams: AdminTeamRow[];
  participants: AdminParticipantRow[];
  submissions: AdminSubmissionSummary[];
}

// One row per (team, stage) — summary fields only, for the review dashboard chips.
export interface AdminSubmissionSummary {
  team_id: string;
  stage: 'AIM' | 'FINAL';
  status: string;
  submitted_at: string | null;
}

export interface AdminTeamMemberRow {
  user_id: string;
  is_leader: boolean;
  joined_at: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    roll_number: string | null;
    year: string | null;
    section: string | null;
    github_username: string | null;
    avatar_url: string | null;
  } | null;
}

// Full submission row for the team detail view.
export interface AdminSubmissionRow {
  id: string;
  team_id: string;
  stage: 'AIM' | 'FINAL';
  aim_summary: string | null;
  ppt_drive_url: string | null;
  ppt_file_name: string | null;
  deployed_url: string | null;
  repo_url: string | null;
  demo_video_url: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

export interface AdminTeamDetail {
  team: {
    id: string;
    name: string;
    team_code: string | null;
    is_locked: boolean;
    created_at: string;
    domain: { name: string; slug: string } | null;
    problem_statement: { title: string; description: string | null } | null;
  } | null;
  members: AdminTeamMemberRow[];
  submissions: AdminSubmissionRow[];
  deadlines: { aim_deadline: string | null; final_deadline: string | null } | null;
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

async function postJson(url: string, body: unknown): Promise<{ error: string | null }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { error: payload?.error ?? `Request failed (${response.status}).` };
    }
    return { error: null };
  } catch {
    return { error: 'Could not reach the server. Try again.' };
  }
}

async function postAction(payload: Record<string, unknown>): Promise<{ error: string | null }> {
  return postJson('/api/admin/actions', payload);
}

export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  try {
    const response = await fetch('/api/admin/overview', { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as AdminOverview;
  } catch {
    return null;
  }
}

export async function fetchAdminTeamDetail(teamId: string): Promise<AdminTeamDetail | null> {
  try {
    const response = await fetch(`/api/admin/teams/${teamId}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as AdminTeamDetail;
  } catch {
    return null;
  }
}

export function saveEventConfig(
  values: {
    aim_deadline?: string | null;
    final_deadline?: string | null;
    registration_open?: boolean;
    max_team_size?: number;
  },
): Promise<{ error: string | null }> {
  return postJson('/api/admin/event-config', values);
}

export function createDomain(
  values: { name: string; slug: string; short_label?: string | null },
): Promise<{ error: string | null }> {
  return postAction({ action: 'create_domain', ...values });
}

export function setDomainActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  return postAction({ action: 'set_domain_active', id, is_active: isActive });
}

export function createProblemStatement(
  values: { title: string; description: string; domain_id: string },
): Promise<{ error: string | null }> {
  return postAction({ action: 'create_problem', ...values });
}

export function setProblemActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  return postAction({ action: 'set_problem_active', id, is_active: isActive });
}

export function adminDeleteTeam(teamId: string): Promise<{ error: string | null }> {
  return postAction({ action: 'delete_team', id: teamId });
}

export function adminDeleteParticipant(userId: string): Promise<{ error: string | null }> {
  return postAction({ action: 'delete_participant', id: userId });
}
