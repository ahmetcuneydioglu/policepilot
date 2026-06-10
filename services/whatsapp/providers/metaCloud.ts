/**
 * Meta WhatsApp Cloud API provider.
 *
 * Gereksinimler (agency_settings):
 *  - whatsapp_api_key → Meta kalıcı erişim token'ı
 *  - sender_id        → phone_number_id (Cloud API gönderen numara id'si)
 *
 * Not: 24 saat penceresi dışındaki mesajlar için onaylı template gerekir.
 * Şimdilik düz metin (type: text) gönderilir; template desteği ileride
 * bu sınıfa eklenecek — interface değişmez.
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
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to:   msg.phone,
            type: "text",
            text: { body: msg.message },
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        return {
          success:      false,
          errorMessage: json?.error?.message ?? `Meta API HTTP ${res.status}`,
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
