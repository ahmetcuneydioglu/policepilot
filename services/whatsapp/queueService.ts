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
import { inspectMetaToken } from "./metaToken";
import { getPlatformWhatsAppConfig } from "./platformConfig";
import type { WhatsAppProvider, WhatsAppProviderName, WhatsAppTemplate } from "./types";

const MAX_ATTEMPTS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnqueueInput {
  agencyId:    string;
  phone:       string;
  message:     string;        // okunabilir metin (önizleme + şablon yoksa fallback)
  templateKey?: string;
  /** Verilirse Meta'ya onaylı şablonla gider (24 saat penceresi gerektirmez) */
  template?:   WhatsAppTemplate;
  /** Aynı mesajın tekrar kuyruğa girmesini engeller (ör. "daily:AGENCY:2026-06-10") */
  dedupKey?:   string;
}

// Acente ayarları artık yalnız ALICI tercihlerini taşır.
// Meta kimlik bilgileri ve gönderim modu platform seviyesindedir
// (platform_settings → services/whatsapp/platformConfig.ts).
export interface AgencyWhatsAppSettings {
  agency_id:             string;
  whatsapp_enabled:      boolean;
  whatsapp_phone:        string | null;  // ALICI: özetlerin gittiği acente numarası
  daily_summary_enabled: boolean;
  /** @deprecated Platform seviyesine taşındı — kod artık okumaz */
  whatsapp_provider?:    WhatsAppProviderName;
}

type QueueRow = {
  id:        string;
  agency_id: string;
  phone:     string;
  message:   string;
  attempts:  number;
  template_name?:   string | null;
  template_params?: { languageCode: string; bodyParams: string[] } | null;
};

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueue(input: EnqueueInput): Promise<{ queued: boolean; reason?: string }> {
  const admin = getSupabaseAdmin();

  const baseRow = {
    agency_id:    input.agencyId,
    phone:        input.phone,
    message:      input.message,
    template_key: input.templateKey ?? null,
    dedup_key:    input.dedupKey ?? null,
    status:       "pending",
  };
  const fullRow = {
    ...baseRow,
    template_name:   input.template?.name ?? null,
    template_params: input.template
      ? { languageCode: input.template.languageCode, bodyParams: input.template.bodyParams }
      : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error } = await (admin.from("whatsapp_queue") as any).insert(fullRow);

  // Şablon kolonları henüz oluşturulmadıysa (migration bekleniyor) düz metinle ekle
  if (error && /template_(name|params)/.test(error.message)) {
    console.warn("[whatsapp/enqueue] şablon kolonları yok, düz metin olarak ekleniyor (migration gerekli).");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ error } = await (admin.from("whatsapp_queue") as any).insert(baseRow));
  }

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
    .select("agency_id, whatsapp_enabled, whatsapp_phone, daily_summary_enabled")
    .eq("agency_id", agencyId)
    .maybeSingle();
  return (data as AgencyWhatsAppSettings) ?? null;
}

// ─── Process queue ────────────────────────────────────────────────────────────

export interface ProcessResult {
  processed: number;
  sent:      number;
  skipped:   number;        // test modu
  failed:    number;
  token_blocked: number;    // token geçersiz — pending bekletildi, deneme yakılmadı
}

export async function processQueue(limit = 50): Promise<ProcessResult> {
  const admin  = getSupabaseAdmin();
  const result: ProcessResult = { processed: 0, sent: 0, skipped: 0, failed: 0, token_blocked: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin.from("whatsapp_queue") as any)
    .select("id, agency_id, phone, message, attempts, template_name, template_params")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`whatsapp_queue fetch: ${error.message}`);

  // ── Gönderim yapılandırması PLATFORM seviyesindedir ───────────────────────
  // Meta token/sender acentelerden değil platform_settings → env'den gelir.
  const platform = await getPlatformWhatsAppConfig();

  // Meta + gerçek mod: token'ı batch başına BİR KEZ doğrula — geçersizse tüm
  // Meta mesajları pending bekler, deneme hakkı yakılmaz.
  let tokenCheck: { valid: boolean; error: string | null } = { valid: true, error: null };
  if (!platform.testMode && platform.provider === "meta_cloud") {
    if (!platform.token) {
      tokenCheck = { valid: false, error: "Platform token'ı tanımlı değil." };
    } else {
      const st = await inspectMetaToken(platform.token);
      tokenCheck = { valid: st.valid, error: st.error };
    }
  }

  // Provider tüm batch için aynıdır — bir kez kurulur
  let provider: WhatsAppProvider | null = null;
  let providerInitError: string | null = null;
  if (!platform.testMode && tokenCheck.valid) {
    try {
      provider = getProvider({
        provider: platform.provider,
        apiKey:   platform.token,
        senderId: platform.senderId,
      });
    } catch (err) {
      providerInitError = err instanceof Error ? err.message : String(err);
    }
  }

  // Acente ayarlarını batch başına bir kez çek (yalnız alıcı tercihleri)
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

    // Platform test modu → gerçek gönderim YOK, kayıt skipped işaretlenir
    if (platform.testMode) {
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

    // Token geçersiz → PENDING kalır, attempts artmaz; token yenilenince gider
    if (!tokenCheck.valid) {
      await updateRow(row.id, {
        error_message: `Platform token geçersiz: ${tokenCheck.error ?? "doğrulanamadı"} → super_admin: WhatsApp ayarlarından yeni token girin.`,
      });
      result.token_blocked++;
      continue;
    }

    // Provider kurulamadıysa (eksik yapılandırma) → pending beklet
    if (!provider) {
      await updateRow(row.id, {
        error_message: `Gönderim yapılandırması eksik: ${providerInitError ?? "bilinmiyor"}`,
      });
      result.token_blocked++;
      continue;
    }

    // Gerçek gönderim — şablon kayıtlıysa şablonla (24 saat penceresi gerekmez)
    const template = row.template_name
      ? {
          name:         row.template_name,
          languageCode: row.template_params?.languageCode ?? "tr",
          bodyParams:   row.template_params?.bodyParams ?? [],
        }
      : undefined;
    try {
      const sendRes = await provider.send({ phone: row.phone, message: row.message, template });

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
