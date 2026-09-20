import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, getAdminSession, readJson, serverError, unauthorized } from '@/lib/admin-api';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EventConfigBody {
  aim_deadline?: string | null;
  final_deadline?: string | null;
  registration_open?: boolean;
  max_team_size?: number;
}

export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return unauthorized();

  const body = await readJson<EventConfigBody>(request);
  if (!body) return badRequest('Invalid request body.');

  const patch: Record<string, unknown> = {};

  for (const field of ['aim_deadline', 'final_deadline'] as const) {
    const value = body[field];
    if (value === undefined) continue;
    if (value === null || value === '') {
      patch[field] = null;
    } else {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return badRequest(`Invalid date for ${field}.`);
      patch[field] = parsed.toISOString();

    }
  }

  if (body.registration_open !== undefined) {
    patch.registration_open = Boolean(body.registration_open);
  }

  if (body.max_team_size !== undefined) {
    const size = Number(body.max_team_size);
    if (!Number.isInteger(size) || size < 1 || size > 20) {
      return badRequest('Max team size must be a whole number between 1 and 20.');
    }
    patch.max_team_size = size;
  }

  if (Object.keys(patch).length === 0) return badRequest('Nothing to update.');

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('event_config').update(patch).eq('id', 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
