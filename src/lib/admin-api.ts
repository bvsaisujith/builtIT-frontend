import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifyAdminSessionToken, type AdminSession } from './admin-auth';

// Every /api/admin/* handler re-checks the cookie (defence in depth - the
// middleware already rejects unauthenticated requests).
export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
