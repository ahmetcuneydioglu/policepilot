/**
 * src/lib/inspections.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Araç Muayene (TÜVTÜRK) takip veri katmanı — yenileme motorunun (renewals.ts)
 * ikizi. Müşterinin muayene_bitis tarihini pencereye göre çeker; cihaz
 * WhatsApp/telefon linkleri üretir. Tarih/telefon yardımcıları renewals.ts'ten
 * paylaşılır (tek kaynak).
 */

import { supabase } from './supabase';
import { daysUntil, normalizePhoneTR, buildCallUrl } from './renewals';

export type InspectionItem = {
  id: string;               // müşteri id
  customerName: string;
  customerPhone: string;
  vehiclePlate: string | null;
  muayene_bitis: string;
  muayeneTahmini: boolean;
  daysLeft: number;
};

export type InspectionWindow = 30 | 60 | 90 | 'all' | 'overdue';

const DAY = 86_400_000;

/** Muayenesi [bugün-60, bugün+90] aralığındaki müşteriler (geçmiş dahil). */
export async function fetchUpcomingInspections(agencyId: string | null): Promise<InspectionItem[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  // Muayene tarihleri 2 yıla kadar ileride olabilir → ÜST SINIR YOK (tüm takip).
  const lower = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10);

  let q = (supabase.from('customers') as any)
    .select('id,name,phone,vehicle_plate,muayene_bitis,muayene_tahmini')
    .not('muayene_bitis', 'is', null)
    .gte('muayene_bitis', lower)
    .order('muayene_bitis', { ascending: true });
  if (agencyId) q = q.eq('agency_id', agencyId);

  const { data } = await q;
  return (data ?? []).map((c: any): InspectionItem => ({
    id: c.id,
    customerName: c.name ?? 'Müşteri',
    customerPhone: c.phone ?? '',
    vehiclePlate: c.vehicle_plate ?? null,
    muayene_bitis: c.muayene_bitis,
    muayeneTahmini: !!c.muayene_tahmini,
    daysLeft: daysUntil(c.muayene_bitis, todayStr),
  }));
}

/** Segment'e göre filtre: 30/60/90 → [0,N] gün; 'all' → tümü; 'overdue' → geçmiş. */
export function filterByWindow(items: InspectionItem[], w: InspectionWindow): InspectionItem[] {
  if (w === 'overdue') return items.filter((i) => i.daysLeft < 0);
  if (w === 'all') return items;
  return items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= w);
}

/** Muayene hatırlatma WhatsApp mesajı (cihaz wa.me). */
export function buildInspectionWhatsappUrl(item: InspectionItem): string {
  const digits = normalizePhoneTR(item.customerPhone);
  const dateTR = item.muayene_bitis
    ? new Date(item.muayene_bitis).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const plate = item.vehiclePlate ? `${item.vehiclePlate} plakalı ` : '';
  const msg =
    `Merhaba ${item.customerName}, ${plate}aracınızın muayene süresi` +
    (dateTR ? ` ${dateTR} tarihinde` : '') +
    ` doluyor. İşlemleriniz için size yardımcı olalım mı? 🙂`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export { buildCallUrl };
