/**
 * src/lib/renewals.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Yenilemeler Merkezi veri katmanı + tek-tık aksiyon yardımcıları.
 * Aktif poliçeleri bitiş penceresine göre çeker; cihaz WhatsApp/telefon linkleri
 * üretir (sunucu gerektirmez — Faz 1).
 */

import { supabase } from './supabase';

export type RenewalItem = {
  id: string;
  customer_id: string;
  policy_type: string;
  end_date: string;
  start_date: string | null;
  premium: number | null;
  commission: number | null;
  insurance_company: string | null;
  policy_no: string | null;
  customerName: string;
  customerPhone: string;
  daysLeft: number;
};

export type RenewalWindow = 3 | 7 | 15 | 30 | 'overdue';

const DAY = 86_400_000;

export function daysUntil(endDate: string, todayStr?: string): number {
  const today = todayStr ?? new Date().toISOString().slice(0, 10);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(t)) return Infinity;
  return Math.round((end - t) / DAY);
}

/**
 * Aktif + bitişi [bugün-60, bugün+30] aralığındaki poliçeleri getirir.
 * Geçmiş (overdue) dahil; ekran segment'e göre client-side filtreler.
 */
export async function fetchUpcomingRenewals(agencyId: string | null): Promise<RenewalItem[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const upper = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
  const lower = new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10);

  let q = (supabase.from('policies') as any)
    .select('id,customer_id,policy_type,end_date,start_date,premium,commission,insurance_company,policy_no,status,customers(name,phone)')
    .eq('status', 'Aktif')
    .gte('end_date', lower)
    .lte('end_date', upper)
    .order('end_date', { ascending: true });
  if (agencyId) q = q.eq('agency_id', agencyId);

  const { data } = await q;

  return (data ?? []).map((p: any): RenewalItem => ({
    id: p.id,
    customer_id: p.customer_id,
    policy_type: p.policy_type,
    end_date: p.end_date,
    start_date: p.start_date ?? null,
    premium: p.premium ?? null,
    commission: p.commission ?? null,
    insurance_company: p.insurance_company ?? null,
    policy_no: p.policy_no ?? null,
    customerName: p.customers?.name ?? 'Müşteri',
    customerPhone: p.customers?.phone ?? '',
    daysLeft: daysUntil(p.end_date, todayStr),
  }));
}

/** Segment'e göre filtre: 3/7/15/30 → [0,N] gün; 'overdue' → geçmiş. */
export function filterByWindow(items: RenewalItem[], w: RenewalWindow): RenewalItem[] {
  if (w === 'overdue') return items.filter((i) => i.daysLeft < 0);
  return items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= w);
}

// ─── Aksiyon linkleri (cihaz uygulamaları) ───────────────────────────────────

/** TR telefonunu wa.me formatına çevirir (90XXXXXXXXXX). */
export function normalizePhoneTR(phone: string): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('90')) return d;
  if (d.length === 10) return `90${d}`;
  return d;
}

export function buildCallUrl(phone: string): string {
  return `tel:${(phone ?? '').replace(/[^\d+]/g, '')}`;
}

export function buildRenewalWhatsappUrl(item: RenewalItem): string {
  const digits = normalizePhoneTR(item.customerPhone);
  const endTR = item.end_date
    ? new Date(item.end_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const msg =
    `Merhaba ${item.customerName}, ${item.policy_type} poliçenizin yenileme tarihi yaklaşıyor` +
    (endTR ? ` (${endTR})` : '') +
    `. Size en uygun yenileme teklifini hazırlayalım mı? 🙂`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
