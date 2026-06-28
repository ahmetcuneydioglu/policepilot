/**
 * src/lib/dashboard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Operasyon Merkezi (Ana Sayfa) metriklerini tek sorguda toplar.
 * RLS sayesinde agency_user yalnız kendi acentesini, super_admin tümünü görür;
 * agencyId verilirse ek olarak o acenteye filtrelenir.
 */

import { supabase } from './supabase';

export type OperationMetrics = {
  yenilemeSayisi: number;      // aktif + bitişe ≤30 gün (geçmiş dahil) → "Yenileme Takibi"
  bekleyenTeklif: number;      // Kazanıldı/Kaybedildi dışı satış hattı
  bugunKesilen: number;        // bugün oluşturulan poliçe
  potansiyelKomisyon: number;  // yenileme penceresindeki komisyon toplamı
  tahminiPrim: number;         // yenileme penceresindeki prim toplamı
  buAyPrim: number;            // bu ay oluşturulan poliçe primi
  buAyKomisyon: number;        // bu ay oluşturulan poliçe komisyonu
  gecenAyPrim: number;         // geçen ay primi (bu-aya-göre trend için)
  gecenAyKomisyon: number;     // geçen ay komisyonu
  aktifPolice: number;
  donusum: number;             // % (Kazanıldı / (Kazanıldı+Kaybedildi))
  yeniTalep: number;           // "Yeni Lead" aşamasındaki talepler
};

const DAY = 86_400_000;

/** 'YYYY-MM-DD' iki tarih arası gün farkı (tz-stable, UTC midnight bazlı). */
function daysUntil(endDate: string, todayStr: string): number {
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const today = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(today)) return Infinity;
  return Math.round((end - today) / DAY);
}

const WON = 'Kazanıldı';
const LOST = 'Kaybedildi';

export async function fetchOperationMetrics(
  agencyId: string | null
): Promise<OperationMetrics> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString().slice(0, 10);

  // ── Poliçeler (tek çekim → tüm poliçe metrikleri JS'te) ────────────────────
  let polQ = (supabase.from('policies') as any).select(
    'id,status,premium,commission,end_date,created_at'
  );
  if (agencyId) polQ = polQ.eq('agency_id', agencyId);
  const { data: policies } = await polQ;

  // ── Talepler (satış hattı) ─────────────────────────────────────────────────
  let reqQ = (supabase.from('requests') as any).select('id,status');
  if (agencyId) reqQ = reqQ.eq('agency_id', agencyId);
  const { data: requests } = await reqQ;

  const pols: any[] = policies ?? [];
  const reqs: any[] = requests ?? [];

  let aktifPolice = 0;
  let yenilemeSayisi = 0;
  let potansiyelKomisyon = 0;
  let tahminiPrim = 0;
  let buAyPrim = 0;
  let buAyKomisyon = 0;
  let gecenAyPrim = 0;
  let gecenAyKomisyon = 0;
  let bugunKesilen = 0;

  for (const p of pols) {
    const premium = Number(p.premium ?? 0);
    const commission = Number(p.commission ?? 0);
    const createdDay = (p.created_at ?? '').slice(0, 10);

    if (p.status === 'Aktif') {
      aktifPolice++;
      if (p.end_date) {
        const d = daysUntil(p.end_date, todayStr);
        if (d <= 30) {
          yenilemeSayisi++;
          potansiyelKomisyon += commission;
          tahminiPrim += premium;
        }
      }
    }
    if (createdDay >= monthStart) {
      buAyPrim += premium;
      buAyKomisyon += commission;
    } else if (createdDay >= lastMonthStart) {
      gecenAyPrim += premium;
      gecenAyKomisyon += commission;
    }
    if (createdDay === todayStr) bugunKesilen++;
  }

  let won = 0;
  let lost = 0;
  let bekleyenTeklif = 0;
  let yeniTalep = 0;
  for (const r of reqs) {
    if (r.status === WON) won++;
    else if (r.status === LOST) lost++;
    else bekleyenTeklif++;
    if (r.status === 'Yeni Lead' || r.status === 'Yeni') yeniTalep++;
  }
  const donusum = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  return {
    yenilemeSayisi,
    bekleyenTeklif,
    bugunKesilen,
    potansiyelKomisyon,
    tahminiPrim,
    buAyPrim,
    buAyKomisyon,
    gecenAyPrim,
    gecenAyKomisyon,
    aktifPolice,
    donusum,
    yeniTalep,
  };
}
