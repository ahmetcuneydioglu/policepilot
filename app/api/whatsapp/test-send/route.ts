/**
 * POST /api/whatsapp/test-send — anında test mesajı
 *
 * Acente, ayarlardaki provider yapılandırmasıyla kendi numarasına test
 * mesajı gönderir. test_mode'dan BAĞIMSIZ çalışır — amaç tam da gerçek
 * Meta yapılandırmasını doğrulamak. Sonuç whatsapp_queue'ya da yazılır
 * (kuyruk ekranında izlenebilsin diye).
 *
 * Body (opsiyonel): { phone?, message?, use_template?, template_name?, template_lang?, body_params? }
 *   phone verilmezse agency_settings.whatsapp_phone kullanılır.
 *   use_template=true → onaylı şablonla gönderir (24 saat penceresi GEREKMEZ).
 *     template_name varsayılan "policepilot_daily_summary", lang "tr".
 *     body_params verilmezse 7 örnek değer ({{1}}..{{7}}) kullanılır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProvider } from "@/services/whatsapp/providerFactory";
import { getAgencySettings } from "@/services/whatsapp/queueService";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";
import { resolveCaller, requirePermission } from "../_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "whatsapp.send");
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const requestedAgency = typeof body.agency_id === "string" ? body.agency_id : null;
    const agencyId = caller.role === "super_admin" ? (requestedAgency ?? caller.agencyId) : caller.agencyId;
    // super_admin acenteye bağlı olmayabilir — alıcı numara body'den gelir
    if (!agencyId && caller.role !== "super_admin") {
      return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });
    }

    // Alıcı numara acente tercihinden (varsa); gönderim yapılandırması PLATFORM'dan
    const settings = agencyId ? await getAgencySettings(agencyId) : null;
    const phone = ((body.phone as string) || settings?.whatsapp_phone || "").replace(/\D/g, "");
    if (!phone) {
      return NextResponse.json(
        { error: "Telefon numarası gerekli — alıcı numarayı girin (örn. 905XXXXXXXXX)." },
        { status: 400 }
      );
    }

    const platform = await getPlatformWhatsAppConfig();

    // ── Şablon modu: onaylı template ile gönder (24 saat penceresi gerekmez) ──
    const useTemplate = body.use_template === true;
    const template = useTemplate
      ? {
          name:         typeof body.template_name === "string" ? body.template_name : "policepilot_daily_summary",
          languageCode: typeof body.template_lang === "string" ? body.template_lang : "tr",
          bodyParams:   Array.isArray(body.body_params) && body.body_params.length > 0
            ? body.body_params.map((p: unknown) => String(p))
            : ["12", "8", "1", "3", "0", "2", "1"], // örnek {{1}}..{{7}}
        }
      : undefined;

    const message =
      (typeof body.message === "string" && body.message.trim()) ||
      (useTemplate
        ? `📊 SigortaOS Günlük Operasyon Özeti (şablon testi)`
        : `🔔 *SigortaOS Test Mesajı*\n\nWhatsApp entegrasyonunuz çalışıyor! 🎉\n\nBu mesaj ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde gönderildi.`);

    // ── Provider'ı PLATFORM config ile kur ve gönder (test_mode'dan bağımsız) ─
    let result: { success: boolean; providerId?: string; errorMessage?: string };
    let providerName: string = platform.provider;
    try {
      const provider = getProvider({
        provider: platform.provider,
        apiKey:   platform.token,
        senderId: platform.senderId,
      });
      providerName = provider.name;
      result = await provider.send({ phone, message, template });
    } catch (err) {
      result = { success: false, errorMessage: err instanceof Error ? err.message : String(err) };
    }

    // ── İz: kuyruk tablosuna kaydet (acente bağlamı varsa) ─────────────────
    // super_admin acentesiz test ederse kuyruk izi atlanır (agency_id zorunlu)
    const admin = getSupabaseAdmin();
    if (agencyId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("whatsapp_queue") as any).insert({
      agency_id:     agencyId,
      phone,
      message,
      template_key:  useTemplate ? "test_template" : "test_send",
      provider:      providerName,
      attempts:      1,
      status:        result.success ? "sent" : "failed",
      sent_at:       result.success ? new Date().toISOString() : null,
      error_message: result.errorMessage ?? null,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.errorMessage ?? "Gönderim başarısız." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, provider: providerName, provider_id: result.providerId ?? null, phone });
  } catch (err) {
    console.error("[api/whatsapp/test-send]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
