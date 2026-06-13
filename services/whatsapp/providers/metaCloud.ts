/**
 * Meta WhatsApp Cloud API provider.
 *
 * Gereksinimler (agency_settings):
 *  - whatsapp_api_key → Meta kalıcı erişim token'ı
 *  - sender_id        → phone_number_id (Cloud API gönderen numara id'si)
 *
 * Not: 24 saat penceresi dışındaki mesajlar için onaylı template gerekir.
 * msg.template verilirse type:template (pencere gerektirmez), yoksa
 * type:text (yalnız 24 saat penceresi açıkken teslim edilir) gönderilir.
 */

import type { WhatsAppMessage, WhatsAppProvider, WhatsAppSendResult } from "../types";

const GRAPH_VERSION = "v21.0";

export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta_cloud" as const;

  constructor(
    private apiKey: string,
    private phoneNumberId: string,
  ) {}

  async send(msg: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      // Şablon varsa type:template (24 saat penceresi gerektirmez), yoksa düz metin
      const payload = msg.template
        ? {
            messaging_product: "whatsapp",
            to:   msg.phone,
            type: "template",
            template: {
              name:     msg.template.name,
              language: { code: msg.template.languageCode },
              components: msg.template.bodyParams.length > 0
                ? [{
                    type: "body",
                    parameters: msg.template.bodyParams.map((text) => ({ type: "text", text })),
                  }]
                : [],
            },
          }
        : {
            messaging_product: "whatsapp",
            to:   msg.phone,
            type: "text",
            text: { body: msg.message },
          };

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        // Meta'nın jenerik mesajları ("An unknown error has occurred.") tek
        // başına teşhise yetmez — status, code ve fbtrace_id de raporlanır.
        const e = json?.error ?? {};
        const parts = [
          e.message ?? "Meta API hatası",
          `HTTP ${res.status}`,
          e.code != null ? `code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}` : null,
          e.fbtrace_id ? `fbtrace ${e.fbtrace_id}` : null,
        ].filter(Boolean);
        // Token kaynaklı hatalarda kullanıcıyı doğrudan çözüme yönlendir
        const isTokenIssue = e.type === "OAuthException" && (e.code === 190 || e.code === 1 || e.code === 102);
        const hint = isTokenIssue
          ? " → Token geçersiz/dolmuş olabilir: Ayarlar > WhatsApp'tan yeni token girin veya Vercel'de META_ACCESS_TOKEN'ı yenileyin."
          : "";
        return {
          success:      false,
          errorMessage: `Meta: ${parts.join(" · ")}${hint}`,
        };
      }

      return {
        success:    true,
        providerId: json?.messages?.[0]?.id,
      };
    } catch (err) {
      return {
        success:      false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
