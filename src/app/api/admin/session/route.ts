import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/admin-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lets the client-side AdminGuard verify the standalone (username/password)
// admin session. The middleware also accepts Supabase admins through /admin,
// so the guard additionally falls back to the Supabase `is_admin()` RPC.
export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, username: session.username });
}
