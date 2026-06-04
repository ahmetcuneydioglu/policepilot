/**
 * lib/supabase-admin.ts
 * Service-role Supabase client — SERVER SIDE ONLY.
 *
 * The `import "server-only"` line below causes an immediate build error
 * if this module is ever imported from a "use client" component or any
 * other browser-destined code. The service role key never reaches the bundle.
 */

import "server-only"; // 🔒 build fails if imported from client code

import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local (server-only, never NEXT_PUBLIC_)"
    );
  }

  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
