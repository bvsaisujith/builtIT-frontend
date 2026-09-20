import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, getAdminSession, serverError, unauthorized } from '@/lib/admin-api';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full detail for one team, for the organizer review dashboard: team + domain +
// problem, members (with profile contact details), both submission rows and the
// event deadlines (for on-time/late checks). Service role - RLS bypassed, but
// the admin session cookie is still re-checked on every call.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  if (!(await getAdminSession(request))) return unauthorized();

  const { teamId } = await params;
  if (!teamId) return badRequest('teamId is required.');

  try {
    const supabase = createServiceRoleClient();

    const [teamResult, membershipsResult, submissionsResult, configResult] = await Promise.all([
      supabase
        .from('teams')
        .select(
          '*, domain:domains(name, slug), problem_statement:problem_statements!teams_problem_statement_id_fkey(title, description)',
        )
        .eq('id', teamId)
        .maybeSingle(),
      supabase.from('team_memberships').select('user_id, joined_at').eq('team_id', teamId),
      supabase.from('submissions').select('*').eq('team_id', teamId),
      supabase.from('event_config').select('aim_deadline, final_deadline').eq('id', 1).maybeSingle(),
    ]);

    if (teamResult.error) return NextResponse.json({ error: teamResult.error.message }, { status: 500 });
    if (!teamResult.data) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    if (membershipsResult.error) {
      return NextResponse.json({ error: membershipsResult.error.message }, { status: 500 });
    }

    // team_memberships.user_id points at auth.users, not profiles (no direct FK),
    // so profiles cannot be embedded - fetch them separately.
    const memberships = membershipsResult.data ?? [];
    const userIds = memberships.map(m => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, roll_number, year, section, github_username, avatar_url')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const members = memberships
      .map(m => ({
        user_id: m.user_id,
        joined_at: m.joined_at,
        is_leader: m.user_id === teamResult.data!.leader_id,
        profile: profileMap.get(m.user_id) ?? null,
      }))
      .sort((a, b) => {
        if (a.is_leader !== b.is_leader) return a.is_leader ? -1 : 1;
        return (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '');
      });

    return NextResponse.json({
      team: teamResult.data,
      members,
      submissions: submissionsResult.data ?? [],
      deadlines: configResult.data ?? null,
    });
  } catch (error) {
    return serverError(error);
  }
}
