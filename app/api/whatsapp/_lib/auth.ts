/**
 * WhatsApp API ortak auth yardımcısı.
 *
 * Oturumu doğrular, profili (role + agency_id) service role ile çeker.
 * agency_user → yalnız kendi acentesi · super_admin → tüm kayıtlar.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export interface ApiCaller {
  userId:      string;
  role:        string;          // sistem rolü: 'super_admin' | 'agency_user'
  agencyId:    string | null;
  agencyRole:  string | null;   // SaaS rolü: 'owner'|'manager'|'sales'|'operations'|'viewer'
  permissions: Record<string, boolean> | null; // override haritası (null = rol şablonu)
  status:      string | null;   // 'active' | 'suspended' | 'invited'
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
    .select("role, agency_id, agency_role, permissions, status")
    .eq("id", user.id)
    .maybeSingle();

  const jwtRole = (user.app_metadata as Record<string, string> | undefined)?.role ?? null;

  return {
    userId:      user.id,
    role:        prof?.role ?? jwtRole ?? "agency_user",
    agencyId:    prof?.agency_id ?? null,
    agencyRole:  prof?.agency_role ?? null,
    permissions: prof?.permissions ?? null,
    status:      prof?.status ?? null,
  };
}

/**
 * Yetki guard'ı — mutation endpoint'lerinde kullanılır.
 *  - super_admin her zaman geçer (bypass).
 *  - status='suspended' → 403 (okuma serbest, yazma kapalı).
 *  - agencyRole yoksa (legacy) 'owner' varsayılır → eski kullanıcı kilitlenmez.
 * İzin varsa null döner; yoksa hazır NextResponse döner.
 *
 * Kullanım:  const denied = requirePermission(caller, "customer.edit");
 *            if (denied) return denied;
 */
export function requirePermission(caller: ApiCaller, key: PermissionKey): NextResponse | null {
  if (caller.role === "super_admin") return null;
  if (caller.status === "suspended") {
    return NextResponse.json({ error: "Hesabınız askıya alınmış. Yöneticinizle görüşün.", code: "suspended" }, { status: 403 });
  }
  const role = caller.agencyRole ?? "owner"; // legacy güvenlik: rol yoksa tam yetki
  if (hasPermission(role, caller.permissions ?? null, key)) return null;
  return NextResponse.json({ error: "Bu işlem için yetkiniz yok.", code: "forbidden_permission" }, { status: 403 });
}
