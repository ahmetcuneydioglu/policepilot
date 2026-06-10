/**
 * GET /api/whatsapp/queue — kuyruk listesi (web + mobil)
 *
 * Query: ?status=pending|sent|failed|skipped  (opsiyonel)
 *        ?limit=100                            (varsayılan 100, max 500)
 *
 * Multi-tenant: agency_user kendi kayıtlarını, super_admin hepsini görür.
 * Service role kullanılır — JWT app_metadata'ya bağımlı RLS sorunlarından
 * etkilenmez (quote-runs API ile aynı desen).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    if (caller.role !== "super_admin" && !caller.agencyId) {
      return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (admin.from("whatsapp_queue") as any)
      .select("id, agency_id, phone, message, status, attempts, provider, template_key, created_at, sent_at, error_message")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (caller.role !== "super_admin") q = q.eq("agency_id", caller.agencyId);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("[api/whatsapp/queue]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
