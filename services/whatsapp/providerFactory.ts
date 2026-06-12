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
      // Öncelik: acente ayarları → sunucu env değişkenleri (Vercel)
      // Token koda yazılmaz; acente bazlı kurulum yoksa platform geneli
      // META_ACCESS_TOKEN / META_PHONE_NUMBER_ID kullanılır.
      const apiKey   = config.apiKey   || process.env.META_ACCESS_TOKEN    || null;
      const senderId = config.senderId || process.env.META_PHONE_NUMBER_ID || null;
      if (!apiKey || !senderId) {
        throw new Error(
          "Meta Cloud API yapılandırması eksik: Access Token + Phone Number ID gerekli " +
          "(ayarlardan girin veya META_ACCESS_TOKEN / META_PHONE_NUMBER_ID env değişkenlerini tanımlayın)."
        );
      }
      return new MetaCloudProvider(apiKey, senderId);
    }

    case "twilio":
    case "dialog360":
    case "wati":
      throw new Error(`'${config.provider}' sağlayıcısı henüz desteklenmiyor.`);

    default:
      throw new Error(`Bilinmeyen WhatsApp sağlayıcısı: ${config.provider}`);
  }
}
