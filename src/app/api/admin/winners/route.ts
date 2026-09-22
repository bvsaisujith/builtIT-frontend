import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, getAdminSession, readJson, serverError, unauthorized } from '@/lib/admin-api';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Winners podium: 1st / 2nd / 3rd. Any position may be omitted (null) until
// the organizers decide; all chosen teams must be distinct.
interface WinnersBody {
  first_team_id?: string | null;
  second_team_id?: string | null;
  third_team_id?: string | null;
}

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return unauthorized();

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('winners')
      .select('position, team_id, team:teams(name, team_code)');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ winners: data ?? [] });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return unauthorized();

  const body = await readJson<WinnersBody>(request);
  if (!body) return badRequest('Invalid request body.');

  const slots: { position: number; team_id: string | null }[] = [
    { position: 1, team_id: body.first_team_id || null },
    { position: 2, team_id: body.second_team_id || null },
    { position: 3, team_id: body.third_team_id || null },
  ];

  // Every non-empty selection must be a valid uuid.
  for (const slot of slots) {
    if (slot.team_id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slot.team_id)) {
      return badRequest(`Invalid team selection for position ${slot.position}.`);
    }
  }

  // The same team cannot hold two podium positions.
  const chosen = slots.filter(s => s.team_id !== null).map(s => s.team_id as string);
  if (new Set(chosen).size !== chosen.length) {
    return badRequest('Each winner position must be a different team.');
  }

  try {
    const supabase = createServiceRoleClient();

    // Every position the admin left empty is removed from the podium.
    const cleared = slots.filter(s => s.team_id === null);
    if (cleared.length > 0) {
      const { error } = await supabase
        .from('winners')
        .delete()
        .in('position', cleared.map(s => s.position));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filled positions are upserted (position is the primary key).
    const filled = slots.filter(s => s.team_id !== null);
    if (filled.length > 0) {
      const { error } = await supabase
        .from('winners')
        .upsert(
          filled.map(s => ({ position: s.position, team_id: s.team_id, updated_at: new Date().toISOString() })),
          { onConflict: 'position' },
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
