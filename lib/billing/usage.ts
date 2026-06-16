/**
 * lib/billing/usage.ts — kullanım ölçümü + dönemsel sayaçlar.
 *
 * Anlık metrikler canlı sayılır (users/customers/requests/policies, storage=SUM).
 * Dönemsel metrikler (ai_credits, wa_sent) usage_counters'ta TR ayı bazlı tutulur;
 * yeni ay = yeni satır (otomatik sıfırlama, cron'suz).
 */

import type { EffectiveLimits, UsageSnapshot } from "./types";

/** TR (Europe/Istanbul) içinde bulunan ayın 1'i — 'YYYY-MM-01'. */
export function trPeriodStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countLive(client: any, agencyId: string, table: string): Promise<number> {
  const { count } = await client.from(table).select("*", { count: "exact", head: true }).eq("agency_id", agencyId);
  return count ?? 0;
}

/** Toplam depolama (MB) — file_size nullable → COALESCE(0). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sumStorageMb(client: any, agencyId: string): Promise<number> {
  const { data } = await client.from("documents").select("file_size").eq("agency_id", agencyId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = ((data ?? []) as any[]).reduce((s, d) => s + (d.file_size ?? 0), 0);
  return Math.round(bytes / (1024 * 1024));
}

/** Bu dönemdeki sayaç değeri (metric: 'ai_credits' | 'wa_sent'). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPeriodUsage(client: any, agencyId: string, metric: string): Promise<number> {
  const { data } = await client.from("usage_counters")
    .select("used").eq("agency_id", agencyId).eq("metric", metric).eq("period_start", trPeriodStart()).maybeSingle();
  return data?.used ?? 0;
}

/** Atomik sayaç artırma (increment_usage RPC). Hata yutar — ana akışı bloklamaz. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bumpCounter(client: any, agencyId: string, metric: string, delta = 1): Promise<void> {
  try {
    await client.rpc("increment_usage", { p_agency: agencyId, p_metric: metric, p_period: trPeriodStart(), p_delta: delta });
  } catch (err) {
    console.warn(`[billing] increment_usage(${metric}) yutuldu:`, err instanceof Error ? err.message : err);
  }
}

/**
 * AI kredisi tüket — TEK NOKTA: OCR başarılı extract anı (gerçek maliyet).
 * super_admin/agency'siz (agencyId boş) → tüketme (O3). Cache HIT/demo çağıran tarafında elenir (O4).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function consumeAiCredit(client: any, agencyId: string | null | undefined, units = 1): Promise<void> {
  if (!agencyId) return;
  await bumpCounter(client, agencyId, "ai_credits", units);
}

/** WhatsApp gönderim sayacı — yalnız başarılı gönderimde (queueService). Yumuşak kota. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordWhatsAppSent(client: any, agencyId: string | null | undefined, count = 1): Promise<void> {
  if (!agencyId) return;
  await bumpCounter(client, agencyId, "wa_sent", count);
}

/** AI kredisi limitinde mi? (ön-kontrol — ≥%100 engelle). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aiCreditAvailable(client: any, agencyId: string, limit: number): Promise<boolean> {
  if (!Number.isFinite(limit) || limit <= 0) return true; // limit yok/tanımsız → engelleme yok
  const used = await getPeriodUsage(client, agencyId, "ai_credits");
  return used < limit;
}

/** 7 metriğin kullanım anlık görüntüsü (used + max). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUsageSnapshot(client: any, agencyId: string, limits: EffectiveLimits): Promise<UsageSnapshot> {
  const [users, customers, requests, policies, storageMb, ai, wa] = await Promise.all([
    countLive(client, agencyId, "profiles"),
    countLive(client, agencyId, "customers"),
    countLive(client, agencyId, "requests"),
    countLive(client, agencyId, "policies"),
    sumStorageMb(client, agencyId),
    getPeriodUsage(client, agencyId, "ai_credits"),
    getPeriodUsage(client, agencyId, "wa_sent"),
  ]);
  return {
    users:      { used: users,     max: limits.users },
    customers:  { used: customers, max: limits.customers },
    requests:   { used: requests,  max: limits.requests },
    policies:   { used: policies,  max: limits.policies },
    ai_credits: { used: ai,        max: limits.ai_credits },
    wa_monthly: { used: wa,        max: limits.wa_monthly },
    storage_mb: { used: storageMb, max: limits.storage_mb },
  };
}
