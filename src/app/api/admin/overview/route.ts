import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSession, serverError, unauthorized } from '@/lib/admin-api';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One round-trip for the whole admin console: event config, domains, curated
// problem statements, teams and participants. Runs with the service role key,
// so RLS is bypassed and inactive rows are visible for toggling.
export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return unauthorized();

  try {
    const supabase = createServiceRoleClient();

    const [configResult, domainsResult, problemsResult, teamsResult, participantsResult] =
      await Promise.all([
        supabase.from('event_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('domains').select('*').order('display_order', { ascending: true }),
        supabase
          .from('problem_statements')
          .select('*')
          .is('team_id', null)
          .order('display_order', { ascending: true }),
        supabase
          .from('teams')
          // NOTE: there are TWO foreign keys between teams and problem_statements
          // (teams_problem_statement_id_fkey from migration 004 and the composite
          // teams_problem_domain_fk from migration 006). PostgREST cannot infer
          // which one to embed, so the relationship must be disambiguated with
          // the "!<constraint>" hint - otherwise this query 300s with
          // "Could not embed because more than one relationship was found".
          .select(
            '*, domain:domains(name, slug), problem_statement:problem_statements!teams_problem_statement_id_fkey(title), team_memberships(count)',
          )
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ]);

    const firstError = [
      configResult.error,
      domainsResult.error,
      problemsResult.error,
      teamsResult.error,
      participantsResult.error,
    ].find(Boolean);
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const teams = (teamsResult.data ?? []).map(row => {
      const typed = row as unknown as {
        team_memberships?: { count: number }[];
      };
      return {
        ...row,
        member_count: typed.team_memberships?.[0]?.count ?? 0,
        team_memberships: undefined,
      };
    });

    return NextResponse.json({
      config: configResult.data ?? null,
      domains: domainsResult.data ?? [],
      problems: problemsResult.data ?? [],
      teams,
      participants: participantsResult.data ?? [],
    });
  } catch (error) {
    return serverError(error);
  }
}
