/**
 * Provider factory — agency_settings'teki yapılandırmadan somut provider üretir.
 *
 * Yeni sağlayıcı eklemek: providers/ altına sınıf yaz, buraya case ekle.
 * Twilio / 360dialog / WATI henüz implemente edilmedi — seçilirse mock'a
 * düşmek yerine açık hata verir ki sessizce yanlış davranmasın.
 */

import type { ProviderConfig, WhatsAppProvider } from "./types";
import { MockProvider }      from "./providers/mock";
import { MetaCloudProvider } from "./providers/metaCloud";

export function getProvider(config: ProviderConfig): WhatsAppProvider {
  switch (config.provider) {
    case "mock":
      return new MockProvider();

    case "meta_cloud": {
      if (!config.apiKey || !config.senderId) {
        throw new Error("Meta Cloud API için api_key ve sender_id (phone_number_id) gerekli.");
      }
      return new MetaCloudProvider(config.apiKey, config.senderId);
    }

    case "twilio":
    case "dialog360":
    case "wati":
      throw new Error(`'${config.provider}' sağlayıcısı henüz desteklenmiyor.`);

    default:
      throw new Error(`Bilinmeyen WhatsApp sağlayıcısı: ${config.provider}`);
  }
}
