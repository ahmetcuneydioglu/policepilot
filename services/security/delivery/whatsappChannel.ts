/**
 * WhatsApp OTP teslimat kanalı — Meta Cloud "authentication" şablonu ile.
 *
 * Şablon Meta'da AUTHENTICATION kategorisinde, OTP butonlu (copy-code veya one-tap
 * autofill) onaylanmış olmalı. Meta auth-template gönderim kuralı gereği kod HEM body
 * parametresine HEM butona ({{1}}) verilir.
 *
 * Yapılandırma (env — WhatsApp motoruyla ORTAK token):
 *   META_ACCESS_TOKEN      → kalıcı erişim token'ı
 *   META_PHONE_NUMBER_ID   → Cloud API gönderen numara id'si
 *   WHATSAPP_OTP_TEMPLATE  → onaylı authentication şablon adı (ör. sigortaos_otp)
 *   WHATSAPP_OTP_LANG      → şablon dil kodu (varsayılan 'tr')
 *
 * WHATSAPP_OTP_TEMPLATE tanımlı DEĞİLSE kanal devre dışıdır (isConfigured=false) →
 * akış otomatik SMS'e düşer. Böylece şablon onaylanana kadar davranış birebir korunur.
 */

import type { OtpDeliveryChannel, OtpDeliveryInput, OtpDeliveryResult } from "./types";

const GRAPH_VERSION = "v21.0";

export class WhatsAppOtpChannel implements OtpDeliveryChannel {
  readonly channel = "whatsapp" as const;
  readonly name = "meta_cloud";

  private get token(): string | null { return process.env.META_ACCESS_TOKEN ?? null; }
  private get phoneNumberId(): string | null { return process.env.META_PHONE_NUMBER_ID ?? null; }
  private get template(): string | null { return process.env.WHATSAPP_OTP_TEMPLATE ?? null; }
  private get lang(): string { return process.env.WHATSAPP_OTP_LANG || "tr"; }

  isConfigured(): boolean {
    return Boolean(this.token && this.phoneNumberId && this.template);
  }

  async deliver(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
    if (!this.isConfigured()) {
      return { success: false, errorMessage: "WhatsApp OTP yapılandırılmamış (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID / WHATSAPP_OTP_TEMPLATE)." };
    }

    const to = input.to.replace(/\D/g, "");
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: this.template,
        language: { code: this.lang },
        // Auth-template kuralı: kod hem body'ye hem OTP butonuna verilir.
        components: [
          { type: "body", parameters: [{ type: "text", text: input.code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] },
        ],
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Meta'nın jenerik mesajları teşhise yetmez — status/code/fbtrace de raporla.
        const e = json?.error ?? {};
        const parts = [
          e.message ?? "Meta API hatası",
          `HTTP ${res.status}`,
          e.code != null ? `code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}` : null,
          e.fbtrace_id ? `fbtrace ${e.fbtrace_id}` : null,
        ].filter(Boolean);
        return { success: false, errorMessage: `WhatsApp: ${parts.join(" · ")}` };
      }

      return { success: true, providerId: json?.messages?.[0]?.id };
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : String(err) };
    }
  }
}
