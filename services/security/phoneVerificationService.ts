/**
 * Telefon OTP doğrulama — orkestrasyon (Service Layer).
 *
 * requestPhoneOtp: profilden telefonu al → cooldown kontrol → eski kodları iptal →
 *   kod üret/hash'le/kaydet → SMS sağlayıcı ile gönder → OTP_SENT logla.
 * verifyPhoneOtp:  aktif kodu doğrula (expiry/deneme/constant-time) → başarıda
 *   profiles.verified_phone=true + audit + PHONE_VERIFIED logla.
 *
 * Plain kod hiçbir yerde saklanmaz; tüm yazımlar service-role ile (repository).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSmsProvider } from "./sms/providerFactory";
import {
  generateOtpCode, generateSalt, hashOtp, verifyOtpHash, otpExpiry, maskPhone,
  OTP_RESEND_COOLDOWN_MS, OTP_MAX_ATTEMPTS, OTP_TTL_MS,
} from "./otp/otpService";
import * as otpRepo from "./repositories/otpRepository";
import { recordVerification } from "./repositories/phoneVerificationRepository";
import { logSecurityEvent } from "./securityLog";
import { SecurityError } from "./errors";
import type { SecurityContext } from "./types";

async function getProfile(userId: string): Promise<{ phone: string | null; agencyId: string | null }> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("profiles") as any)
    .select("phone, agency_id")
    .eq("id", userId)
    .maybeSingle();
  return { phone: (data?.phone as string) ?? null, agencyId: (data?.agency_id as string) ?? null };
}

export interface RequestOtpResult {
  sent: boolean;
  phoneMasked: string;
  cooldownMs: number;
  expiresInMs: number;
}

export async function requestPhoneOtp(ctx: SecurityContext): Promise<RequestOtpResult> {
  const { phone, agencyId } = await getProfile(ctx.userId);
  if (!phone) {
    throw new SecurityError("Profilinizde telefon numarası tanımlı değil.", 400, "no_phone");
  }

  // Yeniden-gönder bekleme süresi
  const latest = await otpRepo.getLatestOtp(ctx.userId);
  if (latest) {
    const sinceMs = Date.now() - new Date(latest.created_at).getTime();
    if (sinceMs < OTP_RESEND_COOLDOWN_MS) {
      throw new SecurityError("Çok sık kod istediniz. Lütfen biraz bekleyin.", 429, "resend_cooldown", {
        retryAfterMs: OTP_RESEND_COOLDOWN_MS - sinceMs,
      });
    }
  }

  await otpRepo.consumeActive(ctx.userId); // eski aktif kodları geçersiz kıl

  const code = generateOtpCode();
  const salt = generateSalt();
  await otpRepo.createOtp({
    user_id: ctx.userId,
    phone,
    code_hash: hashOtp(code, salt),
    code_salt: salt,
    expires_at: otpExpiry().toISOString(),
    max_attempts: OTP_MAX_ATTEMPTS,
  });

  const sms = getSmsProvider();
  const res = await sms.sendSms({
    to: phone,
    message: `SigortaOS doğrulama kodunuz: ${code}\nKod 5 dakika geçerlidir, kimseyle paylaşmayın.`,
  });
  if (!res.success) {
    throw new SecurityError("SMS gönderilemedi. Lütfen tekrar deneyin.", 502, "sms_failed");
  }

  await logSecurityEvent({
    userId: ctx.userId, agencyId, event: "OTP_SENT", channel: "sms",
    ip: ctx.ip, userAgent: ctx.userAgent,
    metadata: { phoneMasked: maskPhone(phone), provider: sms.name },
  });

  return { sent: true, phoneMasked: maskPhone(phone), cooldownMs: OTP_RESEND_COOLDOWN_MS, expiresInMs: OTP_TTL_MS };
}

export interface VerifyOtpResult { verified: boolean; }

export async function verifyPhoneOtp(ctx: SecurityContext, code: string): Promise<VerifyOtpResult> {
  const clean = (code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) {
    throw new SecurityError("Kod 6 haneli olmalı.", 400, "bad_code");
  }

  const otp = await otpRepo.getActiveOtp(ctx.userId);
  if (!otp) {
    throw new SecurityError("Aktif kod bulunamadı. Lütfen yeni kod isteyin.", 400, "no_active_code");
  }

  const { agencyId } = await getProfile(ctx.userId);

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await otpRepo.consumeOtp(otp.id);
    await logSecurityEvent({ userId: ctx.userId, agencyId, event: "OTP_EXPIRED", channel: "sms", ip: ctx.ip, userAgent: ctx.userAgent });
    throw new SecurityError("Kodun süresi doldu. Lütfen yeni kod isteyin.", 400, "expired");
  }

  if (otp.attempts >= otp.max_attempts) {
    await otpRepo.consumeOtp(otp.id);
    throw new SecurityError("Çok fazla yanlış deneme. Lütfen yeni kod isteyin.", 429, "too_many_attempts");
  }

  if (!verifyOtpHash(clean, otp.code_salt, otp.code_hash)) {
    const attempts = await otpRepo.incrementAttempts(otp.id);
    const remaining = Math.max(0, otp.max_attempts - attempts);
    await logSecurityEvent({ userId: ctx.userId, agencyId, event: "OTP_FAILED", channel: "sms", ip: ctx.ip, userAgent: ctx.userAgent, metadata: { remaining } });
    if (remaining <= 0) {
      await otpRepo.consumeOtp(otp.id);
      throw new SecurityError("Çok fazla yanlış deneme. Lütfen yeni kod isteyin.", 429, "too_many_attempts");
    }
    throw new SecurityError(`Kod hatalı. ${remaining} deneme hakkınız kaldı.`, 400, "wrong_code", { remaining });
  }

  // ── Başarı ──
  await otpRepo.consumeOtp(otp.id);
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("profiles") as any)
    .update({ verified_phone: true, phone_verified_at: new Date().toISOString() })
    .eq("id", ctx.userId);
  await recordVerification(ctx.userId, otp.phone);
  await logSecurityEvent({ userId: ctx.userId, agencyId, event: "PHONE_VERIFIED", channel: "sms", ip: ctx.ip, userAgent: ctx.userAgent });

  return { verified: true };
}
