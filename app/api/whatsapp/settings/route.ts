/**
 * GET /api/whatsapp/settings — acentenin bildirim tercihleri
 * PUT /api/whatsapp/settings — tercihleri güncelle (upsert)
 *
 * Acente yalnız ALICI tercihlerini yönetir:
 *   whatsapp_enabled · whatsapp_phone · daily_summary_enabled
 *
 * Meta kimlik bilgileri (token, phone number id, WABA), sağlayıcı ve test
 * modu PLATFORM seviyesindedir — yalnız super_admin yönetir:
 *   /api/whatsapp/platform-settings
 * Body'de bu alanlar gelse bile YOK SAYILIR (token yazma yolu kapalıdır).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../_lib/auth";

function targetAgency(callerRole: string, callerAgency: string | null, requested: string | null): string | null {
  // super_admin istediği acentenin tercihini yönetebilir; agency_user yalnız kendisininkini
  if (callerRole === "super_admin") return requested ?? callerAgency;
  return callerAgency;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agencyId = targetAgency(caller.role, caller.agencyId, searchParams.get("agency_id"));
    if (!agencyId) return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("agency_settings") as any)
      .select("whatsapp_enabled, whatsapp_phone, daily_summary_enabled")
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      settings: {
        agency_id:             agencyId,
        whatsapp_enabled:      data?.whatsapp_enabled      ?? false,
        whatsapp_phone:        data?.whatsapp_phone        ?? "",
        daily_summary_enabled: data?.daily_summary_enabled ?? false,
      },
    });
  } catch (err) {
    console.error("[api/whatsapp/settings GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const body = await request.json();
    const agencyId = targetAgency(caller.role, caller.agencyId, body.agency_id ?? null);
    if (!agencyId) return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });

    // Yalnız alıcı tercihleri — Meta/provider/test_mode alanları bilinçli yok sayılır
    const row: Record<string, unknown> = {
      agency_id:             agencyId,
      whatsapp_enabled:      Boolean(body.whatsapp_enabled),
      whatsapp_phone:        (body.whatsapp_phone ?? "").toString().replace(/\D/g, "") || null,
      daily_summary_enabled: Boolean(body.daily_summary_enabled),
      updated_at:            new Date().toISOString(),
    };

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("agency_settings") as any)
      .upsert(row, { onConflict: "agency_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/whatsapp/settings PUT]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
