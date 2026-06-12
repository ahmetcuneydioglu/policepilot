/**
 * POST /api/whatsapp/token-exchange — kısa token'ı 60 günlük token'a çevir
 *
 * YALNIZ super_admin. Body: { token?: string }
 *   token verilirse o uzatılır; verilmezse platform_settings'teki kayıtlı
 *   token uzatılır. Başarıda yeni 60 günlük token platform_settings'e
 *   kaydedilir ve kalan süre döner. Token client'a geri dönmez.
 *
 * Business Verification gerektirmez — Meta'nın resmi fb_exchange_token akışı.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { exchangeForLongLivedToken, inspectMetaToken } from "@/services/whatsapp/metaToken";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";
import { resolveCaller } from "../_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (caller.role !== "super_admin") {
      return NextResponse.json({ error: "Bu işlem yalnız super_admin için." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    let shortToken: string | null =
      typeof body.token === "string" && body.token.trim() !== "" ? body.token.trim() : null;

    if (!shortToken) {
      // Kayıtlı token'ı (platform_settings → env) uzatmayı dene
      const config = await getPlatformWhatsAppConfig();
      shortToken = config.token;
    }
    if (!shortToken) {
      return NextResponse.json(
        { error: "Uzatılacak token yok — alana kısa token'ı yapıştırın." },
        { status: 400 }
      );
    }

    // ── Exchange ──────────────────────────────────────────────────────────
    const result = await exchangeForLongLivedToken(shortToken);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // ── Yeni token'ı doğrula + kalan süreyi hesapla ───────────────────────
    const status = await inspectMetaToken(result.token);

    // ── platform_settings'e kaydet ────────────────────────────────────────
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: saveErr } = await (admin.from("platform_settings") as any)
      .upsert(
        { id: 1, meta_access_token: result.token, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );

    if (saveErr) {
      const hint = saveErr.message.includes("platform_settings")
        ? " (platform_settings_migration.sql çalıştırıldı mı?)"
        : "";
      return NextResponse.json({ error: `Token uzatıldı ama kaydedilemedi: ${saveErr.message}${hint}` }, { status: 500 });
    }

    return NextResponse.json({
      ok:           true,
      valid:        status.valid,
      hours_left:   status.hours_left,
      expires_at:   status.expires_at,
      days_left:    status.hours_left != null ? Math.round(status.hours_left / 24) : null,
    });
  } catch (err) {
    console.error("[api/whatsapp/token-exchange]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
