/**
 * Telefon OTP doğrulama yöntemi — VerificationMethod implementasyonu.
 * phoneVerificationService'i sarar. (İlk sürümde tek aktif yöntem.)
 */

import type { VerificationMethod, ChallengeResult, VerifyInput, VerifyResult } from "./verificationMethod";
import type { SecurityContext } from "../types";
import { requestPhoneOtp, verifyPhoneOtp } from "../phoneVerificationService";

export class PhoneOtpMethod implements VerificationMethod {
  readonly type = "phone_otp";

  async challenge(ctx: SecurityContext): Promise<ChallengeResult> {
    const r = await requestPhoneOtp(ctx);
    return { sent: r.sent, meta: { phoneMasked: r.phoneMasked, cooldownMs: r.cooldownMs, expiresInMs: r.expiresInMs, channel: r.channel, devCode: r.devCode } };
  }

  async verify(ctx: SecurityContext, input: VerifyInput): Promise<VerifyResult> {
    return verifyPhoneOtp(ctx, String(input.code ?? ""));
  }
}
