/**
 * SigortaOS — Etkinlik (activity_log) kaydı.
 *
 * Server-only: getSupabaseAdmin() service role ile activity_log'a yazar.
 * Best-effort: ASLA throw etmez, ana akışı bloklamaz — hata yutulur (console.warn).
 * (ocr_cache cache yazımı ile aynı felsefe.)
 *
 * activity_log tablosu yoksa (migration çalıştırılmamış) insert hata verir ve
 * sessizce yutulur — create akışları çalışmaya devam eder.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ActivityAction =
  | "create" | "update" | "delete" | "upload" | "send" | string;

export type ActivityEntity =
  | "customer" | "policy" | "quote_run" | "document" | "whatsapp" | "user" | string;

export interface ActivityInput {
  agencyId: string | null;
  actorId: string | null;
  actorName?: string | null;
  action: ActivityAction;
  entityType: ActivityEntity;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("activity_log") as any).insert({
      agency_id:   input.agencyId,
      actor_id:    input.actorId,
      actor_name:  input.actorName ?? null,
      action:      input.action,
      entity_type: input.entityType,
      entity_id:   input.entityId ?? null,
      summary:     input.summary ?? null,
      metadata:    input.metadata ?? {},
    });
    if (error) console.warn("[logActivity] yutuldu:", error.message);
  } catch (err) {
    console.warn("[logActivity] yutuldu:", err instanceof Error ? err.message : err);
  }
}
