import type { SmsProvider, SmsMessage, SmsSendResult } from "../types";

/**
 * Geliştirme/test sağlayıcısı — GERÇEK SMS GÖNDERMEZ.
 * Mesajı (içindeki OTP dahil) sunucu konsoluna yazar; geliştirici kodu oradan görür.
 * Üretimde SMS_PROVIDER=netgsm/twilio yapın.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock" as const;

  async sendSms(msg: SmsMessage): Promise<SmsSendResult> {
    // eslint-disable-next-line no-console
    console.log(`\n──────── [SMS · MOCK] ────────\nKime: ${msg.to}\n${msg.message}\n──────────────────────────────\n`);
    return { success: true, providerId: `mock-${Date.now()}` };
  }
}
