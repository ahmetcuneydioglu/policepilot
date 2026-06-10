/**
 * PolicePilot — WhatsApp Queue Service
 *
 * Kuyruğa yazma (enqueue) ve kuyruğu işleme (processQueue) burada toplanır.
 * Cron endpoint'leri ve ileride mobil/diğer otomasyonlar bu servisi kullanır.
 *
 * Akış:
 *   enqueue()      → whatsapp_queue'ya pending kayıt atar (dedup destekli)
 *   processQueue() → pending kayıtları acente ayarına göre gönderir
 *                    test_mode → gerçek gönderim yok, status: skipped
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProvider }      from "./providerFactory";
import type { WhatsAppProviderName } from "./types";

const MAX_ATTEMPTS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnqueueInput {
  agencyId:    string;
  phone:       string;
  message:     string;
  templateKey?: string;
  /** Aynı mesajın tekrar kuyruğa girmesini engeller (ör. "daily:AGENCY:2026-06-10") */
  dedupKey?:   string;
}

export interface AgencyWhatsAppSettings {
  agency_id:             string;
  whatsapp_enabled:      boolean;
  whatsapp_phone:        string | null;
  whatsapp_provider:     WhatsAppProviderName;
  whatsapp_api_key:      string | null;
  daily_summary_enabled: boolean;
  test_mode:             boolean;
}

type QueueRow = {
  id:        string;
  agency_id: string;
  phone:     string;
  message:   string;
  attempts:  number;
};

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueue(input: EnqueueInput): Promise<{ queued: boolean; reason?: string }> {
  const admin = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("whatsapp_queue") as any).insert({
    agency_id:    input.agencyId,
    phone:        input.phone,
    message:      input.message,
    template_key: input.templateKey ?? null,
    dedup_key:    input.dedupKey ?? null,
    status:       "pending",
  });

  if (error) {
    // 23505 = unique violation → aynı dedup_key zaten kuyrukta, sorun değil
    if (error.code === "23505") return { queued: false, reason: "duplicate" };
    throw new Error(`whatsapp_queue insert: ${error.message}`);
  }
  return { queued: true };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getAgencySettings(agencyId: string): Promise<AgencyWhatsAppSettings | null> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("agency_settings") as any)
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle();
  return (data as AgencyWhatsAppSettings) ?? null;
}

// ─── Process queue ────────────────────────────────────────────────────────────

export interface ProcessResult {
  processed: number;
  sent:      number;
  skipped:   number;  // test modu
  failed:    number;
}

export async function processQueue(limit = 50): Promise<ProcessResult> {
  const admin  = getSupabaseAdmin();
  const result: ProcessResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin.from("whatsapp_queue") as any)
    .select("id, agency_id, phone, message, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`whatsapp_queue fetch: ${error.message}`);

  // Acente ayarlarını tek tek değil, batch başına bir kez çek
  const settingsCache = new Map<string, AgencyWhatsAppSettings | null>();

  for (const row of (rows ?? []) as QueueRow[]) {
    result.processed++;

    let settings = settingsCache.get(row.agency_id);
    if (settings === undefined) {
      settings = await getAgencySettings(row.agency_id);
      settingsCache.set(row.agency_id, settings);
    }

    // Ayar yok ya da WhatsApp kapalı → failed (tekrar denenmez)
    if (!settings || !settings.whatsapp_enabled) {
      await updateRow(row.id, {
        status:        "failed",
        attempts:      row.attempts + 1,
        error_message: "WhatsApp bu acente için aktif değil.",
      });
      result.failed++;
      continue;
    }

    // Test modu → gerçek gönderim YOK, kayıt skipped olarak işaretlenir
    if (settings.test_mode) {
      await updateRow(row.id, {
        status:   "skipped",
        provider: "mock",
        attempts: row.attempts + 1,
        sent_at:  new Date().toISOString(),
        error_message: null,
      });
      result.skipped++;
      continue;
    }

    // Gerçek gönderim
    try {
      const provider = getProvider({
        provider: settings.whatsapp_provider,
        apiKey:   settings.whatsapp_api_key,
        senderId: settings.whatsapp_phone,
      });

      const sendRes = await provider.send({ phone: row.phone, message: row.message });

      if (sendRes.success) {
        await updateRow(row.id, {
          status:   "sent",
          provider: provider.name,
          attempts: row.attempts + 1,
          sent_at:  new Date().toISOString(),
          error_message: null,
        });
        result.sent++;
      } else {
        const attempts = row.attempts + 1;
        await updateRow(row.id, {
          // MAX_ATTEMPTS dolana kadar pending kalır → sonraki cron tekrar dener
          status:        attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          error_message: sendRes.errorMessage ?? "Bilinmeyen gönderim hatası",
        });
        result.failed++;
      }
    } catch (err) {
      await updateRow(row.id, {
        status:        "failed",
        attempts:      row.attempts + 1,
        error_message: err instanceof Error ? err.message : String(err),
      });
      result.failed++;
    }
  }

  return result;
}

async function updateRow(id: string, fields: Record<string, unknown>) {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("whatsapp_queue") as any).update(fields).eq("id", id);
  if (error) console.error("[whatsapp/queue] row update error:", error.message);
}
