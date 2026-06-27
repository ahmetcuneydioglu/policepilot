/**
 * SigortaOS — OTP Teslimat Kanalı soyutlaması (Dependency Injection)
 *
 * Bir OTP'nin kullanıcıya nasıl ulaştığını soyutlar: SMS, WhatsApp, (ileride) sesli arama.
 * OTP üretimi/doğrulaması burada DEĞİL — `otp/otpService.ts`'tedir. Kanal yalnız İLETİR.
 *
 * phoneVerificationService kanalları öncelik sırasıyla dener (WhatsApp → SMS fallback);
 * yeni kanal eklemek = yeni sınıf + `delivery/index.ts`'e satır (refactorsuz).
 */

import type { VerificationChannel } from "../types";

export interface OtpDeliveryInput {
  /** E.164 benzeri numara: 905xxxxxxxxx (kanal kendi normalizasyonunu yapar). */
  to: string;
  /** 6 haneli OTP kodu (plain — yalnız iletim için, saklanmaz). */
  code: string;
  /** Kodun geçerlilik süresi (mesaj metni için). */
  ttlMinutes: number;
  /** Marka adı (mesaj metni için), ör. "SigortaOS". */
  appName: string;
}

export interface OtpDeliveryResult {
  success: boolean;
  /** Sağlayıcının döndürdüğü mesaj/işlem id'si. */
  providerId?: string;
  errorMessage?: string;
  /** YALNIZ mock kanallarda dolar (geliştirme test bannerı). Gerçek sağlayıcıda undefined. */
  devCode?: string;
}

export interface OtpDeliveryChannel {
  /** Kanal türü — otp_requests.channel + audit'te saklanır. */
  readonly channel: VerificationChannel;
  /** Somut sağlayıcı adı (audit metadata): 'mock' | 'netgsm' | 'meta_cloud' … */
  readonly name: string;
  /** Bu kanal şu an gerçekten gönderim yapacak şekilde yapılandırılmış mı? */
  isConfigured(): boolean;
  deliver(input: OtpDeliveryInput): Promise<OtpDeliveryResult>;
}
