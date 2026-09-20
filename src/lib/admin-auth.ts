// ---------------------------------------------------------------------------
// Standalone admin session (username + password), independent of Supabase Auth
// ---------------------------------------------------------------------------
// The admin console is NOT a participant account: organizers open /admin/login,
// type the shared username + password, and get an HMAC-signed session cookie.
// No Supabase user, no profile row, no participant privileges.
//
// Secrets come from server-only env vars (never NEXT_PUBLIC_*):
//   ADMIN_USERNAME        default: bvsaisujith
//   ADMIN_PASSWORD        default: builtit-admin
//   ADMIN_SESSION_SECRET  optional; defaults to a value derived from the above
//   ADMIN_SESSION_HOURS   optional; default 12
//
// Web Crypto only (globalThis.crypto.subtle) so the exact same code runs in
// middleware (Edge runtime) and in Node route handlers.
// ---------------------------------------------------------------------------

export const ADMIN_COOKIE = 'built_it_admin_session';

const DEFAULT_USERNAME = 'bvsaisujith';
const DEFAULT_PASSWORD = 'builtit-admin';
const DEFAULT_SESSION_HOURS = 12;

function envValue(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export function adminUsername(): string {
  return envValue('ADMIN_USERNAME', DEFAULT_USERNAME);
}

export function adminPassword(): string {
  return envValue('ADMIN_PASSWORD', DEFAULT_PASSWORD);
}

export function adminSessionHours(): number {
  const hours = Number(envValue('ADMIN_SESSION_HOURS', String(DEFAULT_SESSION_HOURS)));
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_HOURS;
}

function sessionSecret(): string {
  return envValue(
    'ADMIN_SESSION_SECRET',
    `built-it-2k26::${adminUsername()}::${adminPassword()}`,
  );
}

// --- base64url helpers ------------------------------------------------------

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encoder(): TextEncoder {
  return new TextEncoder();
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// --- credentials ------------------------------------------------------------

// Constant-time-ish comparison: never short-circuit on the first bad character.
function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const userOk = safeEqual(username.trim(), adminUsername());
  const passOk = safeEqual(password, adminPassword());
  return userOk && passOk;
}

// --- session token ----------------------------------------------------------

export interface AdminSession {
  username: string;
  expiresAt: number;
}

export async function createAdminSessionToken(username: string): Promise<string> {
  const payload: AdminSession = {
    username,
    expiresAt: Date.now() + adminSessionHours() * 60 * 60 * 1000,
  };
  const payloadPart = encodeBase64Url(encoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder().encode(payloadPart));
  return `${payloadPart}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null,
): Promise<AdminSession | null> {
  if (!token) return null;

  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      decodeBase64Url(signaturePart),
      encoder().encode(payloadPart),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart))) as AdminSession;
    if (!session?.username || !session?.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function adminCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
