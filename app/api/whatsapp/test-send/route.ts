/**
 * POST /api/whatsapp/test-send — anında test mesajı
 *
 * Acente, ayarlardaki provider yapılandırmasıyla kendi numarasına test
 * mesajı gönderir. test_mode'dan BAĞIMSIZ çalışır — amaç tam da gerçek
 * Meta yapılandırmasını doğrulamak. Sonuç whatsapp_queue'ya da yazılır
 * (kuyruk ekranında izlenebilsin diye).
 *
 * Body (opsiyonel): { phone?: string, message?: string }
 *   phone verilmezse agency_settings.whatsapp_phone kullanılır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProvider } from "@/services/whatsapp/providerFactory";
import { getAgencySettings } from "@/services/whatsapp/queueService";
import { resolveCaller } from "../_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const requestedAgency = typeof body.agency_id === "string" ? body.agency_id : null;
    const agencyId = caller.role === "super_admin" ? (requestedAgency ?? caller.agencyId) : caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });

    const settings = await getAgencySettings(agencyId);
    if (!settings) {
      return NextResponse.json({ error: "WhatsApp ayarları bulunamadı. Önce ayarları kaydedin." }, { status: 400 });
    }

    const phone = ((body.phone as string) || settings.whatsapp_phone || "").replace(/\D/g, "");
    if (!phone) {
      return NextResponse.json({ error: "Telefon numarası gerekli (ayarlardan girin veya istekle gönderin)." }, { status: 400 });
    }

    const message =
      (typeof body.message === "string" && body.message.trim()) ||
      `🔔 *PolicePilot Test Mesajı*\n\nWhatsApp entegrasyonunuz çalışıyor! 🎉\n\nBu mesaj ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde gönderildi.`;

    // ── Provider'ı kur ve gönder (test_mode'dan bağımsız) ──────────────────
    let result: { success: boolean; providerId?: string; errorMessage?: string };
    let providerName = settings.whatsapp_provider;
    try {
      const provider = getProvider({
        provider: settings.whatsapp_provider,
        apiKey:   settings.whatsapp_api_key,
        senderId: settings.whatsapp_sender_id,
      });
      providerName = provider.name;
      result = await provider.send({ phone, message });
    } catch (err) {
      result = { success: false, errorMessage: err instanceof Error ? err.message : String(err) };
    }

    // ── İz: kuyruk tablosuna kaydet ────────────────────────────────────────
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("whatsapp_queue") as any).insert({
      agency_id:     agencyId,
      phone,
      message,
      template_key:  "test_send",
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
