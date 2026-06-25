/**
 * Yöntem-bağımsız güvenlik audit'i. Her güvenlik işlemi buradan loglanır.
 * Loglama akışı ASLA bozmaz (hata yutulur).
 */

import { insertLog } from "./repositories/securityLogRepository";
import type { SecurityEvent } from "./types";

export async function logSecurityEvent(input: {
  userId: string | null;
  agencyId?: string | null;
  event: SecurityEvent;
  channel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await insertLog({
      user_id: input.userId,
      agency_id: input.agencyId ?? null,
      event: input.event,
      channel: input.channel ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[security] log yazılamadı:", (e as Error)?.message);
  }
}
