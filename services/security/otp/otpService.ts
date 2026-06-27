/**
 * OTP kripto + politika servisi (sağlayıcı-bağımsız, saf).
 *
 * - 6 haneli rastgele kod (crypto.randomInt — güvenli).
 * - Kod ASLA plain saklanmaz: HMAC-SHA256(salt + ":" + code, pepper) hex.
 * - Doğrulama constant-time (timingSafeEqual).
 * - Politika sabitleri: 5 dk TTL, 5 deneme, 60 sn yeniden-gönder bekleme.
 *
 * DB yazımı/okuması burada DEĞİL — phoneVerificationService + repository yapar.
 */

import { randomInt, randomBytes, createHmac, timingSafeEqual } from "crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
/** Kullanıcı başına 24 saatte azami kod isteği (SMS/WhatsApp pumping & maliyet-DoS koruması). */
export const OTP_MAX_PER_DAY = 12;

function pepper(): string {
  // server-only. Üretimde SECURITY_OTP_PEPPER ZORUNLU.
  const p = process.env.SECURITY_OTP_PEPPER;
  if (p) return p;

  // Üretimde fail-closed: sessizce herkesçe bilinen dev pepper'a düşmek = güvenlik açığı
  // (otp_requests sızarsa code_hash+salt'tan kod offline forge edilebilir). O yüzden patla.
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProd) {
    throw new Error(
      "[security] SECURITY_OTP_PEPPER tanımlı değil — üretimde ZORUNLU. " +
      "Vercel env'e güçlü rastgele bir değer ekleyin: openssl rand -hex 32"
    );
  }
  // eslint-disable-next-line no-console
  console.warn("[security] SECURITY_OTP_PEPPER tanımlı değil — geçici dev pepper kullanılıyor (yalnız non-prod). Üretimde MUTLAKA tanımlayın.");
  return "dev-insecure-pepper-change-me";
}

/** 6 haneli, baştan sıfır korunan kod. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashOtp(code: string, salt: string): string {
  return createHmac("sha256", pepper()).update(`${salt}:${code}`).digest("hex");
}

/** Constant-time karşılaştırma. */
export function verifyOtpHash(code: string, salt: string, expectedHash: string): boolean {
  const calc = Buffer.from(hashOtp(code, salt), "hex");
  let stored: Buffer;
  try { stored = Buffer.from(expectedHash, "hex"); } catch { return false; }
  if (calc.length !== stored.length || calc.length === 0) return false;
  return timingSafeEqual(calc, stored);
}

export function otpExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + OTP_TTL_MS);
}

/** "0532 *** ** 67" gibi maskeli gösterim (UI bilgisi için). */
export function maskPhone(phone: string): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `${d.slice(0, Math.min(4, d.length - 2))}*** ** ${d.slice(-2)}`;
}
