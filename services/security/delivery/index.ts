/**
 * OTP teslimat kanalı resolver'ı (DI).
 *
 * Öncelik sırası env'den okunur: OTP_CHANNEL_ORDER (varsayılan "whatsapp,sms").
 * phoneVerificationService bu sırayla yapılandırılmış ilk kanalı dener; başarısızsa
 * sıradakine düşer (WhatsApp → SMS fallback). Kanal yapılandırılmamışsa atlanır.
 */

import type { VerificationChannel } from "../types";
import type { OtpDeliveryChannel } from "./types";
import { WhatsAppOtpChannel } from "./whatsappChannel";
import { SmsOtpChannel } from "./smsChannel";

const FACTORY: Record<string, () => OtpDeliveryChannel> = {
  whatsapp: () => new WhatsAppOtpChannel(),
  sms: () => new SmsOtpChannel(),
};

/** Env'den geçerli kanal öncelik sırası. Bilinmeyen/boş → ["whatsapp","sms"]. */
export function resolveOtpChannelOrder(): VerificationChannel[] {
  const raw = process.env.OTP_CHANNEL_ORDER || "whatsapp,sms";
  const order = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s in FACTORY) as VerificationChannel[];
  return order.length ? order : (["whatsapp", "sms"] as VerificationChannel[]);
}

/** Öncelik sırasına göre kanal örnekleri (yapılandırma filtresi çağırana ait). */
export function resolveOtpChannels(): OtpDeliveryChannel[] {
  return resolveOtpChannelOrder().map((c) => FACTORY[c]());
}

export type { OtpDeliveryChannel, OtpDeliveryInput, OtpDeliveryResult } from "./types";
