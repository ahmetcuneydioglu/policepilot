/**
 * GET /api/whatsapp/platform-settings — platform Meta yapılandırması
 * PUT /api/whatsapp/platform-settings — yapılandırmayı güncelle
 *
 * YALNIZ super_admin. WhatsApp hattının sahibi platformdur; Meta token,
 * Phone Number ID, WABA, sağlayıcı ve test modu burada yönetilir.
 * Token client'a ASLA geri dönmez (yalnız has_token + önizleme yok).
 * PUT'ta token boş gelirse mevcut korunur.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";
import { inspectMetaToken } from "@/services/whatsapp/metaToken";
import { resolveCaller } from "../_lib/auth";

const PROVIDERS = ["mock", "meta_cloud"];

async function requireSuperAdmin(request: NextRequest) {
  const caller = await resolveCaller(request);
  if (!caller) return { error: NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 }) };
  if (caller.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Bu işlem yalnız super_admin için." }, { status: 403 }) };
  }
  return { caller };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("platform_settings") as any)
      .select("whatsapp_provider, meta_access_token, meta_phone_number_id, meta_waba_id, test_mode, updated_at")
      .eq("id", 1)
      .maybeSingle();

    // Tablo henüz oluşturulmamışsa env yedeğiyle durum raporla (migration uyarısıyla)
    const tableMissing = Boolean(error);

    const config = await getPlatformWhatsAppConfig();
    const tokenStatus = config.provider === "meta_cloud" && config.token
      ? await inspectMetaToken(config.token)
      : config.provider === "meta_cloud"
        ? { valid: false, expires_at: null, hours_left: null, expiring_soon: false, error: "Token tanımlı değil." }
        : null;

    return NextResponse.json({
      migration_required: tableMissing,
      settings: {
        whatsapp_provider:    data?.whatsapp_provider    ?? config.provider,
        meta_phone_number_id: data?.meta_phone_number_id ?? "",
        meta_waba_id:         data?.meta_waba_id         ?? "",
        test_mode:            data?.test_mode            ?? config.testMode,
        has_token:            Boolean(data?.meta_access_token),
        env_fallback_configured: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID),
        effective_source:     config.source,
        updated_at:           data?.updated_at ?? null,
      },
      token_status: tokenStatus,
    });
  } catch (err) {
    console.error("[api/whatsapp/platform-settings GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const provider = body.whatsapp_provider ?? "meta_cloud";
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `Geçersiz sağlayıcı: ${provider}` }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      id:                   1,
      whatsapp_provider:    provider,
      meta_phone_number_id: (body.meta_phone_number_id ?? "").toString().replace(/\D/g, "") || null,
      meta_waba_id:         (body.meta_waba_id ?? "").toString().trim() || null,
      test_mode:            Boolean(body.test_mode),
      updated_at:           new Date().toISOString(),
    };
    // Boş token mevcut token'ı korur
    if (typeof body.meta_access_token === "string" && body.meta_access_token.trim() !== "") {
      row.meta_access_token = body.meta_access_token.trim();
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("platform_settings") as any)
      .upsert(row, { onConflict: "id" });

    if (error) {
      const hint = error.message.includes("platform_settings")
        ? " (platform_settings_migration.sql çalıştırıldı mı?)"
        : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/whatsapp/platform-settings PUT]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
