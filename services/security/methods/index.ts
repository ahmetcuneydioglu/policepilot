/**
 * Doğrulama yöntemi registry'si (DI). API bu registry üzerinden çalışır →
 * yeni yöntem eklenince route/UI değişmez.
 */

import type { VerificationMethod } from "./verificationMethod";
import { PhoneOtpMethod } from "./phoneOtpMethod";
import { SecurityError } from "../errors";

const REGISTRY: Record<string, VerificationMethod> = {
  phone_otp: new PhoneOtpMethod(),
  // İLERİDE (refactorsuz):
  // totp:    new TotpMethod(),
  // passkey: new PasskeyMethod(),
  // push:    new PushApprovalMethod(),
};

export function getVerificationMethod(type: string = "phone_otp"): VerificationMethod {
  const method = REGISTRY[type];
  if (!method) throw new SecurityError(`Desteklenmeyen doğrulama yöntemi: ${type}`, 400, "unknown_method");
  return method;
}

export const SUPPORTED_METHODS = Object.keys(REGISTRY);
