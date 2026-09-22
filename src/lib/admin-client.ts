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
  /** Round total (0..100) once an organizer has scored the round, else null. */
  score: number | null;
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
  // --- judging (migration 013) ---
  /** Round total computed from criteria_scores, null until scored. */
  score: number | null;
  /** Per-criterion points keyed by the criterion ids in lib/rubrics.ts. */
  criteria_scores: Record<string, number> | null;
  feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
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

async function postJsonWithBody<T>(
  url: string,
  body: unknown,
): Promise<{ error: string | null; data: T | null }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { error: payload?.error ?? `Request failed (${response.status}).`, data: null };
    }
    const data = (await response.json().catch(() => null)) as T | null;
    return { error: null, data };
  } catch {
    return { error: 'Could not reach the server. Try again.', data: null };
  }
}

async function postJson(url: string, body: unknown): Promise<{ error: string | null }> {
  const { error } = await postJsonWithBody(url, body);
  return { error };
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

// ---------------------------------------------------------------------------
// Winners podium (migration 015)
// ---------------------------------------------------------------------------

/** Current podium selections keyed by position, from /api/admin/winners. */
export interface AdminWinners {
  first_team_id: string | null;
  second_team_id: string | null;
  third_team_id: string | null;
}

export async function fetchAdminWinners(): Promise<AdminWinners> {
  try {
    const response = await fetch('/api/admin/winners', { cache: 'no-store' });
    if (!response.ok) return { first_team_id: null, second_team_id: null, third_team_id: null };
    const data = (await response.json()) as { winners?: { position: number; team_id: string }[] };
    const out: AdminWinners = { first_team_id: null, second_team_id: null, third_team_id: null };
    for (const w of data.winners ?? []) {
      if (w.position === 1) out.first_team_id = w.team_id;
      if (w.position === 2) out.second_team_id = w.team_id;
      if (w.position === 3) out.third_team_id = w.team_id;
    }
    return out;
  } catch {
    return { first_team_id: null, second_team_id: null, third_team_id: null };
  }
}

export function saveWinners(values: {
  first_team_id: string | null;
  second_team_id: string | null;
  third_team_id: string | null;
}): Promise<{ error: string | null }> {
  return postJson('/api/admin/winners', values);
}

// ---------------------------------------------------------------------------
// Judging (round 1 + round 2 rubrics — see lib/rubrics.ts)
// ---------------------------------------------------------------------------

/** Decisions an organizer can record for a submission. */
export type ReviewDecision = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';

/** The judging slice of a submission, as returned by a successful save. */
export interface SavedEvaluation {
  id: string;
  score: number | null;
  criteria_scores: Record<string, number> | null;
  feedback: string | null;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/**
 * Persist an evaluation for one submission. Omitted fields are left untouched
 * server-side, so a decision-only call (status) never clears saved points.
 */
export async function saveEvaluation(values: {
  submissionId: string;
  criteria?: Record<string, number>;
  feedback?: string;
  status?: ReviewDecision;
}): Promise<{ error: string | null; submission: SavedEvaluation | null }> {
  const { error, data } = await postJsonWithBody<{ submission?: SavedEvaluation }>(
    '/api/admin/actions',
    {
      action: 'save_evaluation',
      id: values.submissionId,
      criteria: values.criteria,
      feedback: values.feedback,
      status: values.status,
    },
  );
  return { error, submission: data?.submission ?? null };
}
