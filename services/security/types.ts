/**
 * SigortaOS — Security Center domain tipleri
 *
 * Genişleyebilir güvenlik modülünün ortak tipleri. İlk sürümde telefon OTP;
 * tipler gelecekteki 2FA/passkey/push/trusted-device için generic tutulmuştur.
 */

/** security_logs.event — yöntem-bağımsız güvenlik olayları. */
export type SecurityEvent =
  | "OTP_SENT"
  | "PHONE_VERIFIED"
  | "OTP_FAILED"
  | "OTP_EXPIRED"
  | "OTP_THROTTLED"
  | "NEW_DEVICE"
  | "PASSWORD_CHANGED"
  | "LOGOUT"
  | "SUSPICIOUS_LOGIN"
  | "ACCOUNT_DELETED";

/** Doğrulamanın amacı — aynı OTP altyapısı farklı amaçlar için kullanılabilir. */
export type VerificationPurpose = "phone_verify" | "login_2fa" | "sensitive_action";

/** Doğrulama kanalı. */
export type VerificationChannel = "sms" | "whatsapp" | "call";

/** Bir güvenlik işleminin kim/nereden bağlamı. */
export interface SecurityContext {
  userId: string;
  agencyId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}
