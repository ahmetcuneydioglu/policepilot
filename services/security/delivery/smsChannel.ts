/**
 * SMS OTP teslimat kanalı — mevcut SmsProvider soyutlamasını sarar.
 * Varsayılan fallback kanalı: WhatsApp yapılandırılmamış/başarısızsa OTP buradan gider.
 */

import { getSmsProvider } from "../sms/providerFactory";
import type { OtpDeliveryChannel, OtpDeliveryInput, OtpDeliveryResult } from "./types";

export class SmsOtpChannel implements OtpDeliveryChannel {
  readonly channel = "sms" as const;

  get name(): string {
    return (process.env.SMS_PROVIDER as string) || "mock";
  }

  isConfigured(): boolean {
    const p = (process.env.SMS_PROVIDER as string) || "mock";
    if (p === "mock") return true; // mock her zaman gönderebilir (fallback garantisi)
    if (p === "netgsm") {
      return Boolean(process.env.NETGSM_USER && process.env.NETGSM_PASSWORD && process.env.NETGSM_HEADER);
    }
    return false; // diğer sağlayıcılar henüz implemente değil
  }

  async deliver(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
    try {
      const sms = getSmsProvider();
      const res = await sms.sendSms({
        to: input.to,
        message: `${input.appName} doğrulama kodunuz: ${input.code}\nKod ${input.ttlMinutes} dakika geçerlidir, kimseyle paylaşmayın.`,
      });
      return {
        success: res.success,
        providerId: res.providerId,
        errorMessage: res.errorMessage,
        devCode: sms.name === "mock" ? input.code : undefined, // yalnız mock
      };
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : String(err) };
    }
  }
}
