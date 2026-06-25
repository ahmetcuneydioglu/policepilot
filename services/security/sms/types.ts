/**
 * SigortaOS — SMS Provider soyutlaması (Dependency Injection)
 *
 * Kod hiçbir yerde doğrudan Netgsm/Twilio çağırmaz — yalnız bu interface'i kullanır.
 * Sağlayıcı `services/security/sms/providerFactory.ts` üzerinden seçilir.
 *
 * DİKKAT: SmsProvider yalnız İLETİR. OTP üretimi/doğrulaması burada DEĞİL,
 * `services/security/otp/otpService.ts`'tedir (temiz ayrım).
 */

export type SmsProviderName =
  | "mock"
  | "netgsm"
  | "iletimerkezi"
  | "twilio"
  | "vonage"
  | "aws_sns";

export interface SmsMessage {
  /** E.164 benzeri numara: 905xxxxxxxxx */
  to: string;
  message: string;
}

export interface SmsSendResult {
  success: boolean;
  /** Sağlayıcının döndürdüğü mesaj/işlem id'si */
  providerId?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  readonly name: SmsProviderName;
  sendSms(msg: SmsMessage): Promise<SmsSendResult>;
}

export interface SmsProviderConfig {
  provider: SmsProviderName;
  apiKey?: string | null;     // Netgsm: kullanıcı · Twilio: account SID
  apiSecret?: string | null;  // Netgsm: şifre  · Twilio: auth token
  senderId?: string | null;   // başlık / from numarası
}
