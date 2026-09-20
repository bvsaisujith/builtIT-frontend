import { NextResponse, type NextRequest } from 'next/server';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminSessionHours,
  checkAdminCredentials,
  createAdminSessionToken,
} from '@/lib/admin-auth';
import { badRequest, readJson } from '@/lib/admin-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const body = await readJson<LoginBody>(request);
  const username = (body?.username ?? '').trim();
  const password = body?.password ?? '';

  if (!username || !password) {
    return badRequest('Username and password are required.');
  }

  if (!checkAdminCredentials(username, password)) {
    // Slow down brute-force attempts a little.
    await new Promise(resolve => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'Invalid admin username or password.' }, { status: 401 });
  }

  const token = await createAdminSessionToken(username);
  const response = NextResponse.json({ ok: true, username });
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions(adminSessionHours() * 60 * 60));
  return response;
}
