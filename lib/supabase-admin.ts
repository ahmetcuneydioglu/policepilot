/**
 * lib/supabase-admin.ts
 * Service-role Supabase client — SERVER SIDE ONLY.
 * Never import this in client components ("use client").
 * Uses SUPABASE_SERVICE_ROLE_KEY which is NOT exposed to the browser.
 */

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
