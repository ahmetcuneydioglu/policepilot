/**
 * Mock provider — test modu ve geliştirme ortamı.
 * Gerçek gönderim yapmaz; her çağrıda başarılı döner.
 */

import type { WhatsAppMessage, WhatsAppProvider, WhatsAppSendResult } from "../types";

export class MockProvider implements WhatsAppProvider {
  readonly name = "mock" as const;

  async send(msg: WhatsAppMessage): Promise<WhatsAppSendResult> {
    console.log(`[whatsapp/mock] (simülasyon) → ${msg.phone}: ${msg.message.slice(0, 60)}…`);
    return {
      success:    true,
      providerId: `MOCK-${Date.now().toString(36).toUpperCase()}`,
    };
  }
}
