/**
 * WhatsApp API ortak auth yardımcısı.
 *
 * Oturumu doğrular, profili (role + agency_id) service role ile çeker.
 * agency_user → yalnız kendi acentesi · super_admin → tüm kayıtlar.
 */

import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface ApiCaller {
  userId:   string;
  role:     string;          // 'super_admin' | 'agency_user'
  agencyId: string | null;
}

export async function resolveCaller(request: NextRequest): Promise<ApiCaller | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieHeader.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prof } = await (admin.from("profiles") as any)
    .select("role, agency_id")
    .eq("id", user.id)
    .maybeSingle();

  const jwtRole = (user.app_metadata as Record<string, string> | undefined)?.role ?? null;

  return {
    userId:   user.id,
    role:     prof?.role ?? jwtRole ?? "agency_user",
    agencyId: prof?.agency_id ?? null,
  };
}
