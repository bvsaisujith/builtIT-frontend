// ---------------------------------------------------------------------------
// Server-only Supabase client (service role)
// ---------------------------------------------------------------------------
// Used exclusively by the /api/admin/* route handlers. The service role key
// bypasses Row Level Security, so this module must never be imported from a
// client component - the 'server-only' import below turns that mistake into a
// build error instead of a key leak into the browser bundle.
// ---------------------------------------------------------------------------

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Admin API is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
