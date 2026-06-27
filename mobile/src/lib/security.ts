/**
 * Security Center — mobil istemci (Web /api/security köprüsü, bearer).
 * Backend ortak: web + mobil aynı uçları kullanır.
 */

import { apiPost } from './api';

export type OtpChannel = 'sms' | 'whatsapp' | 'call';

export type SendOtpResponse = {
  ok: boolean;
  sent: boolean;
  meta?: { phoneMasked?: string; cooldownMs?: number; expiresInMs?: number; channel?: OtpChannel; devCode?: string };
};

export type VerifyOtpResponse = { ok: boolean; verified: boolean };

/** Telefona OTP gönder (profildeki numaraya). */
export async function sendPhoneOtp(): Promise<SendOtpResponse> {
  return apiPost<SendOtpResponse>('/api/security/otp/send', {});
}

/** 6 haneli kodu doğrula → başarıda profiles.verified_phone=true. */
export async function verifyPhoneOtp(code: string): Promise<VerifyOtpResponse> {
  return apiPost<VerifyOtpResponse>('/api/security/otp/verify', { code });
}
