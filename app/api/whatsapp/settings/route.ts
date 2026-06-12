/**
 * GET /api/whatsapp/settings — acentenin WhatsApp ayarları
 * PUT /api/whatsapp/settings — ayarları güncelle (upsert)
 *
 * Güvenlik: api_key client'a ASLA dönmez; yalnız has_api_key boolean'ı döner.
 * PUT'ta whatsapp_api_key boş gönderilirse mevcut anahtar korunur.
 * agency_settings tablosunda RLS client erişimine kapalı — tek kapı bu API.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../_lib/auth";

const PROVIDERS = ["mock", "meta_cloud", "twilio", "dialog360", "wati"];

function targetAgency(callerRole: string, callerAgency: string | null, requested: string | null): string | null {
  // super_admin istediği acentenin ayarını yönetebilir; agency_user yalnız kendisininkini
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
      .select("*")
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      settings: {
        agency_id:             agencyId,
        whatsapp_enabled:      data?.whatsapp_enabled      ?? false,
        whatsapp_phone:        data?.whatsapp_phone        ?? "",
        whatsapp_provider:     data?.whatsapp_provider     ?? "mock",
        daily_summary_enabled: data?.daily_summary_enabled ?? false,
        test_mode:             data?.test_mode             ?? true,
        has_api_key:           Boolean(data?.whatsapp_api_key),
        // Meta Cloud API alanları (token asla dönmez)
        whatsapp_sender_id:           data?.whatsapp_sender_id           ?? "",
        whatsapp_business_account_id: data?.whatsapp_business_account_id ?? "",
        // Sunucuda platform geneli Meta yapılandırması var mı? (env fallback)
        env_meta_configured: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID),
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

    const provider = body.whatsapp_provider ?? "mock";
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `Geçersiz sağlayıcı: ${provider}` }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      agency_id:             agencyId,
      whatsapp_enabled:      Boolean(body.whatsapp_enabled),
      whatsapp_phone:        (body.whatsapp_phone ?? "").toString().replace(/\D/g, "") || null,
      whatsapp_provider:     provider,
      daily_summary_enabled: Boolean(body.daily_summary_enabled),
      test_mode:             Boolean(body.test_mode),
      // Meta Cloud API: Phone Number ID (gönderen hat) + WABA ID
      whatsapp_sender_id:           (body.whatsapp_sender_id ?? "").toString().replace(/\D/g, "") || null,
      whatsapp_business_account_id: (body.whatsapp_business_account_id ?? "").toString().trim() || null,
      updated_at:            new Date().toISOString(),
    };
    // Boş anahtar gönderilirse mevcut anahtara dokunma
    if (typeof body.whatsapp_api_key === "string" && body.whatsapp_api_key.trim() !== "") {
      row.whatsapp_api_key = body.whatsapp_api_key.trim();
    }

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
