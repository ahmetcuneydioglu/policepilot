/**
 * SMS Provider factory — env/yapılandırmadan somut sağlayıcı üretir (DI).
 *
 * Yeni sağlayıcı eklemek: providers/ altına sınıf yaz, buraya case ekle.
 * Varsayılan `mock` (gerçek SMS göndermez). Üretimde SMS_PROVIDER env'i ile seçilir.
 * Sağlayıcı anahtarları koda gömülmez — yalnız env'den okunur.
 */

import type { SmsProvider, SmsProviderConfig, SmsProviderName } from "./types";
import { MockSmsProvider } from "./providers/mock";
import { NetgsmSmsProvider } from "./providers/netgsm";

export function getSmsProvider(config?: SmsProviderConfig): SmsProvider {
  const provider: SmsProviderName =
    config?.provider ?? ((process.env.SMS_PROVIDER as SmsProviderName) || "mock");

  switch (provider) {
    case "mock":
      return new MockSmsProvider();

    case "netgsm": {
      const user = config?.apiKey ?? process.env.NETGSM_USER ?? null;
      const pass = config?.apiSecret ?? process.env.NETGSM_PASSWORD ?? null;
      const header = config?.senderId ?? process.env.NETGSM_HEADER ?? null;
      if (!user || !pass || !header) {
        throw new Error(
          "Netgsm yapılandırması eksik: NETGSM_USER / NETGSM_PASSWORD / NETGSM_HEADER env değişkenleri gerekli."
        );
      }
      return new NetgsmSmsProvider(user, pass, header);
    }

    case "twilio":
    case "iletimerkezi":
    case "vonage":
    case "aws_sns":
      throw new Error(`'${provider}' SMS sağlayıcısı henüz desteklenmiyor.`);

    default:
      throw new Error(`Bilinmeyen SMS sağlayıcısı: ${provider}`);
  }
}
