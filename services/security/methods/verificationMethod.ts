/**
 * Doğrulama yöntemi soyutlaması — FUTURE-READY seam.
 *
 * Tüm yöntemler (phone_otp şimdi; totp / passkey / push / yeni-cihaz ileride) bu
 * arayüzü uygular. Yeni yöntem eklemek = yeni sınıf + registry'ye satır; API ve UI
 * akışı DEĞİŞMEZ (refactorsuz genişleme).
 */

import type { SecurityContext } from "../types";

export interface ChallengeResult {
  sent: boolean;
  meta?: Record<string, unknown>;
}
export interface VerifyInput {
  code?: string;
  [key: string]: unknown;
}
export interface VerifyResult {
  verified: boolean;
}

export interface VerificationMethod {
  /** 'phone_otp' | 'totp' | 'passkey' | 'push' … */
  readonly type: string;
  /** Meydan okuma başlat (OTP gönder / WebAuthn challenge üret …). */
  challenge(ctx: SecurityContext): Promise<ChallengeResult>;
  /** Kullanıcı girdisini doğrula. */
  verify(ctx: SecurityContext, input: VerifyInput): Promise<VerifyResult>;
}
