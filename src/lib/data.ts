'use client';

import { supabase } from './supabase';
import type { TeamWithDetails, EventConfig, ProblemStatement, Team, TeamMember, Submission } from './types';

export async function getMyTeam(): Promise<TeamWithDetails | null> {
  const { data: membership } = await supabase
    .from('team_memberships')
    .select('team_id')
    .maybeSingle();

  if (!membership) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', membership.team_id)
    .maybeSingle();

  if (!team) return null;

  const { data: members } = await supabase
    .from('team_memberships')
    .select(`
      id,
      team_id,
      user_id,
      joined_at,
      profile:profiles(id, full_name, email)
    `)
    .eq('team_id', team.id);

  const { data: problemStatement } = await supabase
    .from('problem_statements')
    .select('*')
    .eq('team_id', team.id)
    .maybeSingle();

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
    ...team as Team,
    members: (members ?? []) as unknown as TeamMember[],
    problem_statement: (problemStatement as ProblemStatement) ?? null,
    submissions: {
      aim: (aimSub as Submission) ?? null,
      final: (finalSub as Submission) ?? null,
    },
  };
}

export async function getEventConfig(): Promise<EventConfig | null> {
  const { data } = await supabase
    .from('event_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as EventConfig | null;
}

export async function getProblemStatements(category?: string): Promise<ProblemStatement[]> {
  let query = supabase.from('problem_statements').select('*').is('team_id', null);
  if (category && category !== 'All') {
    query = query.eq('category', category);
  }
  const { data } = await query;
  return (data ?? []) as ProblemStatement[];
}

export function getTeamCode(teamId: string): string {
  return teamId.substring(0, 8).toUpperCase();
}
