/**
 * GET /api/activity — çağıranın acentesindeki son etkinlikler (Giriş Geçmişi / Aktivite)
 *
 * activity_log'tan acente-scoped son 50 kayıt: kim / ne / ne zaman.
 * Yetki: users.manage (acente sahibi/yönetici). Ayarlar > Güvenlik > Giriş Geçmişi.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller, requirePermission } from "../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("activity_log") as any)
      .select("id, actor_name, action, entity_type, summary, created_at")
      .eq("agency_id", caller.agencyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("[api/activity GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
