/**
 * PolicePilot — Günlük WhatsApp Operasyon Özeti
 *
 * Acente başına yenileme tablosunu hesaplar, whatsapp_templates'taki
 * daily_summary şablonunu doldurur ve kuyruğa yazar.
 *
 * Dedup: "daily:{agency_id}:{YYYY-MM-DD}" anahtarı ile aynı gün ikinci
 * özet kuyruğa giremez (cron iki kez tetiklense bile).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { enqueue } from "./queueService";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://policepilot.vercel.app";

// ─── Types ────────────────────────────────────────────────────────────────────

type RenewalRow = {
  id: string;
  agency_id: string | null;
  policy_type: string;
  end_date: string;
  customers: { name: string } | null;
};

type AgencySettingsRow = {
  agency_id: string;
  whatsapp_enabled: boolean;
  whatsapp_phone: string | null;
  daily_summary_enabled: boolean;
};

export interface DailySummaryStats {
  agencies_checked: number;
  summaries_queued: number;
  skipped_no_phone: number;
  skipped_duplicate: number;
  skipped_empty: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Türkiye saatiyle bugünün YYYY-MM-DD karşılığı */
export function trToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtTr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function daysLeftLabel(endDate: string, today: string): string {
  const diff = Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 864e5
  );
  if (diff < 0)  return `${Math.abs(diff)} gün gecikti`;
  if (diff === 0) return "Bugün sona eriyor";
  return `${diff} gün kaldı`;
}

// ─── Template rendering ───────────────────────────────────────────────────────

async function getTemplate(): Promise<string> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("whatsapp_templates") as any)
    .select("content")
    .eq("template_key", "daily_summary")
    .eq("is_active", true)
    .maybeSingle();

  // Şablon DB'de yoksa/pasifse gömülü varsayılan kullanılır — özet asla aksamaz
  return data?.content ?? DEFAULT_TEMPLATE;
}

export const DEFAULT_TEMPLATE =
  "📊 *PolicePilot Günlük Operasyon Özeti*\n\n" +
  "Tarih: {{date}}\n\n" +
  "👥 Toplam Müşteri: *{{total_customers}}*\n" +
  "📄 Aktif Poliçe: *{{active_policies}}*\n" +
  "🔄 Bugün Yenilenecek: *{{today_count}}*\n" +
  "📅 Bu Hafta Yenilenecek: *{{week_count}}*\n" +
  "⚠️ Geciken Yenileme: *{{overdue_count}}*\n" +
  "📨 Açık Teklif: *{{open_quotes}}*\n" +
  "🆕 Yeni Talep: *{{new_requests}}*\n\n" +
  "{{urgent_list}}\n" +
  "PolicePilot'a giriş yap:\n{{app_url}}";

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generateDailySummaries(): Promise<DailySummaryStats> {
  const admin = getSupabaseAdmin();
  const today = trToday();

  const stats: DailySummaryStats = {
    agencies_checked: 0, summaries_queued: 0,
    skipped_no_phone: 0, skipped_duplicate: 0, skipped_empty: 0,
  };

  // ── 1. Günlük özet açık olan acenteler ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRows, error: setErr } = await (admin.from("agency_settings") as any)
    .select("agency_id, whatsapp_enabled, whatsapp_phone, daily_summary_enabled")
    .eq("whatsapp_enabled", true)
    .eq("daily_summary_enabled", true);

  if (setErr) throw new Error(`agency_settings fetch: ${setErr.message}`);

  const agencies = (settingsRows ?? []) as AgencySettingsRow[];
  if (agencies.length === 0) return stats;

  // ── 2. Yenileme penceresi: 60 gün geçmiş → 7 gün gelecek ─────────────────
  // (Yenilemeler ekranıyla aynı mantık: Aktif + completed olmayan)
  const from = addDays(today, -60);
  const to   = addDays(today, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: polRows, error: polErr } = await (admin.from("policies") as any)
    .select("id, agency_id, policy_type, end_date, customers(name)")
    .eq("status", "Aktif")
    .neq("renewal_status", "completed")
    .gte("end_date", from)
    .lte("end_date", to)
    .in("agency_id", agencies.map(a => a.agency_id))
    .order("end_date", { ascending: true });

  if (polErr) throw new Error(`policies fetch: ${polErr.message}`);

  const byAgency = new Map<string, RenewalRow[]>();
  for (const p of (polRows ?? []) as RenewalRow[]) {
    if (!p.agency_id) continue;
    const list = byAgency.get(p.agency_id) ?? [];
    list.push(p);
    byAgency.set(p.agency_id, list);
  }

  // ── Genişletilmiş metrikler: müşteri, aktif poliçe, açık teklif, yeni talep
  // Toplu çekilir (acente başına ayrı sorgu yok), JS'te acenteye göre sayılır.
  const agencyIds = agencies.map(a => a.agency_id);
  const OPEN_QUOTE_STATUSES = ["Yeni", "Teklif Verildi", "Müşteri Düşünüyor"];

  const [custRows, activePolRows, quoteRows, reqRows] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("customers") as any).select("agency_id").in("agency_id", agencyIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("policies") as any).select("agency_id").eq("status", "Aktif").in("agency_id", agencyIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("quote_runs") as any).select("agency_id").in("status", OPEN_QUOTE_STATUSES).in("agency_id", agencyIds),
    // Talepler acenteye müşteri üzerinden bağlı (requests tablosunda agency_id yok)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("requests") as any).select("id, status, customers!inner(agency_id)").eq("status", "Yeni").in("customers.agency_id", agencyIds),
  ]);

  const countBy = (rows: { agency_id?: string | null }[] | null | undefined): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.agency_id) continue;
      m.set(r.agency_id, (m.get(r.agency_id) ?? 0) + 1);
    }
    return m;
  };
  const customerCounts = countBy(custRows.data);
  const policyCounts   = countBy(activePolRows.data);
  const quoteCounts    = countBy(quoteRows.data);
  const requestCounts  = new Map<string, number>();
  type ReqRow = { customers: { agency_id: string | null } | { agency_id: string | null }[] };
  for (const r of (reqRows.data ?? []) as ReqRow[]) {
    const c  = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    const ag = c?.agency_id;
    if (ag) requestCounts.set(ag, (requestCounts.get(ag) ?? 0) + 1);
  }

  const template = await getTemplate();
  const weekEnd  = addDays(today, 7);

  // ── 3. Acente başına özet üret + kuyruğa yaz ──────────────────────────────
  for (const agency of agencies) {
    stats.agencies_checked++;

    if (!agency.whatsapp_phone) { stats.skipped_no_phone++; continue; }

    const pols    = byAgency.get(agency.agency_id) ?? [];
    const overdue = pols.filter(p => p.end_date <  today);
    const todays  = pols.filter(p => p.end_date === today);
    const week    = pols.filter(p => p.end_date >= today && p.end_date <= weekEnd);

    // Not: yenileme olmasa da özet gönderilir — acente sistemin çalıştığını
    // ilk günden görür (toplam müşteri/poliçe/teklif metrikleri her zaman anlamlı).

    // En acil 3 müşteri: gecikenler önce, sonra en yakın bitiş
    const urgent = [...overdue, ...pols.filter(p => p.end_date >= today)].slice(0, 3);
    const urgentList = urgent
      .map(p =>
        `⚠️ *${p.customers?.name ?? "Müşteri"}*\n` +
        `${p.policy_type}\n` +
        `${daysLeftLabel(p.end_date, today)}\n`
      )
      .join("\n");

    const message = render(template, {
      date:            fmtTr(today),
      total_customers: String(customerCounts.get(agency.agency_id) ?? 0),
      active_policies: String(policyCounts.get(agency.agency_id) ?? 0),
      today_count:     String(todays.length),
      week_count:      String(week.length),
      overdue_count:   String(overdue.length),
      open_quotes:     String(quoteCounts.get(agency.agency_id) ?? 0),
      new_requests:    String(requestCounts.get(agency.agency_id) ?? 0),
      urgent_list:     urgentList ? `${urgentList}\n` : "",
      app_url:         APP_URL,
    });

    const { queued, reason } = await enqueue({
      agencyId:    agency.agency_id,
      phone:       agency.whatsapp_phone,
      message,
      templateKey: "daily_summary",
      dedupKey:    `daily:${agency.agency_id}:${today}`,
    });

    if (queued) stats.summaries_queued++;
    else if (reason === "duplicate") stats.skipped_duplicate++;
  }

  return stats;
}
