/**
 * src/lib/reports.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Üretim raporları — yönetim odaklı agregasyon (direct-supabase).
 * Tek/birkaç sorguyla policies + requests çekilir, hesaplar JS'te yapılır.
 * RLS sayesinde agency_user yalnız kendi acentesini görür; agencyId verilirse
 * ek olarak o acenteye filtrelenir (dashboard.ts ile aynı desen).
 */

import { supabase } from './supabase';

export type BransDilim = { type: string; count: number; pct: number };
export type TrendNoktasi = { ay: string; label: string; prim: number; police: number };

export type ProductionReport = {
  buAyPrim: number;
  buAyKomisyon: number;
  buAyPolice: number;
  buYilPrim: number;
  buYilKomisyon: number;
  buYilPolice: number;
  aktifPolice: number;
  donusum: number; // %
  bransDagilimi: BransDilim[]; // aktif poliçe policy_type kırılımı, azalan, top ~8
  aylikTrend: TrendNoktasi[]; // son 6 ay (policies.created_at'e göre)
};

const WON = 'Kazanıldı';
const LOST = 'Kaybedildi';

// Türkçe kısa ay etiketleri (0=Ocak)
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** 'YYYY-MM' anahtarı → kısa ay etiketi ('Oca' vb.) */
function ayEtiketi(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return AY_KISA[(m - 1 + 12) % 12] ?? ym;
}

/** Bugünden geriye doğru son N ayın 'YYYY-MM' anahtarları (eskiden yeniye). */
function sonAylar(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(ym);
  }
  return out;
}

export async function fetchProductionReport(
  agencyId: string | null
): Promise<ProductionReport> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 7)}-01`; // 'YYYY-MM-01'
  const yearStart = `${todayStr.slice(0, 4)}-01-01`; // 'YYYY-01-01'

  // ── Poliçeler (tek çekim → tüm poliçe metrikleri JS'te) ────────────────────
  let polQ = (supabase.from('policies') as any).select(
    'id,status,premium,commission,policy_type,created_at'
  );
  if (agencyId) polQ = polQ.eq('agency_id', agencyId);
  const { data: policies } = await polQ;

  // ── Talepler (satış hattı → dönüşüm) ───────────────────────────────────────
  let reqQ = (supabase.from('requests') as any).select('id,status');
  if (agencyId) reqQ = reqQ.eq('agency_id', agencyId);
  const { data: requests } = await reqQ;

  const pols: any[] = policies ?? [];
  const reqs: any[] = requests ?? [];

  let buAyPrim = 0;
  let buAyKomisyon = 0;
  let buAyPolice = 0;
  let buYilPrim = 0;
  let buYilKomisyon = 0;
  let buYilPolice = 0;
  let aktifPolice = 0;

  // Branş dağılımı (aktif poliçe policy_type kırılımı)
  const bransCount: Record<string, number> = {};

  // Aylık trend (son 6 ay)
  const aylar = sonAylar(now, 6);
  const trendPrim: Record<string, number> = {};
  const trendPolice: Record<string, number> = {};
  for (const ym of aylar) {
    trendPrim[ym] = 0;
    trendPolice[ym] = 0;
  }

  for (const p of pols) {
    const premium = Number(p.premium ?? 0);
    const commission = Number(p.commission ?? 0);
    const createdDay = (p.created_at ?? '').slice(0, 10); // 'YYYY-MM-DD'
    const createdYm = createdDay.slice(0, 7); // 'YYYY-MM'

    if (p.status === 'Aktif') {
      aktifPolice++;
      const t = (p.policy_type ?? '').toString().trim() || 'Diğer';
      bransCount[t] = (bransCount[t] ?? 0) + 1;
    }

    if (createdDay >= monthStart) {
      buAyPrim += premium;
      buAyKomisyon += commission;
      buAyPolice++;
    }
    if (createdDay >= yearStart) {
      buYilPrim += premium;
      buYilKomisyon += commission;
      buYilPolice++;
    }

    if (createdYm in trendPrim) {
      trendPrim[createdYm] += premium;
      trendPolice[createdYm] += 1;
    }
  }

  // Dönüşüm % (Kazanıldı / (Kazanıldı + Kaybedildi))
  let won = 0;
  let lost = 0;
  for (const r of reqs) {
    if (r.status === WON) won++;
    else if (r.status === LOST) lost++;
  }
  const donusum = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  // Branş dağılımı → azalan, top 8, yüzde
  const bransTotal = Object.values(bransCount).reduce((s, n) => s + n, 0);
  const bransDagilimi: BransDilim[] = Object.entries(bransCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, count]) => ({
      type,
      count,
      pct: bransTotal ? Math.round((count / bransTotal) * 100) : 0,
    }));

  const aylikTrend: TrendNoktasi[] = aylar.map((ym) => ({
    ay: ayEtiketi(ym),
    label: ym,
    prim: trendPrim[ym] ?? 0,
    police: trendPolice[ym] ?? 0,
  }));

  return {
    buAyPrim,
    buAyKomisyon,
    buAyPolice,
    buYilPrim,
    buYilKomisyon,
    buYilPolice,
    aktifPolice,
    donusum,
    bransDagilimi,
    aylikTrend,
  };
}
