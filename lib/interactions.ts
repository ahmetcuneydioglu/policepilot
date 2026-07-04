import "server-only";

/**
 * IRM — otomatik görüşme/olay kaydı (server, best-effort).
 * lib/activity.ts felsefesi: ASLA throw etmez, ana akışı bloklamaz.
 * Faz 2 hook'ları bunu çağırır: poliçe kesildi, fırsat açıldı, evrak yüklendi,
 * WhatsApp gönderildi, yenileme hatırlatması, AI özeti.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AutoInteractionInput = {
  agencyId: string;
  customerId: string;
  autoSource:
    | "policy_created" | "quote_created" | "document_uploaded"
    | "whatsapp_sent" | "renewal_reminder" | "ai_summary";
  /** Kısa insan-okur özet (timeline satırı) */
  note?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  product?: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export async function logAutoInteraction(input: AutoInteractionInput): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("customer_interactions") as any).insert({
      agency_id:   input.agencyId,
      customer_id: input.customerId,
      kind:        "auto",
      auto_source: input.autoSource,
      note:        input.note ?? null,
      staff_id:    input.staffId ?? null,
      staff_name:  input.staffName ?? null,
      product:     input.product ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      metadata:    input.metadata ?? null,
    });
    if (error) console.warn("[interactions] auto kayıt yazılamadı:", error.message);
  } catch (err) {
    console.warn("[interactions] auto kayıt hatası:", err);
  }
}
