/**
 * PORTFÖY — Satış Hattı (deals) + Hesaplar (accounts): tipler, sabitler, veri erişimi.
 * Web karşılığı: lib/portfolio.ts — aşama anahtarları DB sözleşmesidir, birebir aynı.
 * İki Dünya: kısa döngü Fırsatlar'da (requests) kalır; uzun döngü burada yaşar.
 */

import { supabase } from './supabase';

export type DealStageKey =
  | 'lead' | 'ilk_gorusme' | 'ihtiyac_analizi' | 'teklif_hazirlaniyor'
  | 'teklif_gonderildi' | 'takip' | 'pazarlik' | 'onay_bekliyor'
  | 'policelesti' | 'referans_kazanildi';

/** Sıra = Satış Hattı akışı. Renkler 500 tonu — açık/koyu temada okunur. */
export const DEAL_STAGES: { key: DealStageKey; label: string; color: string }[] = [
  { key: 'lead',                label: 'Lead',                color: '#3B82F6' },
  { key: 'ilk_gorusme',         label: 'İlk Görüşme',         color: '#0EA5E9' },
  { key: 'ihtiyac_analizi',     label: 'İhtiyaç Analizi',     color: '#06B6D4' },
  { key: 'teklif_hazirlaniyor', label: 'Teklif Hazırlanıyor', color: '#8B5CF6' },
  { key: 'teklif_gonderildi',   label: 'Teklif Gönderildi',   color: '#A855F7' },
  { key: 'takip',               label: 'Takip',               color: '#F59E0B' },
  { key: 'pazarlik',            label: 'Pazarlık',            color: '#F97316' },
  { key: 'onay_bekliyor',       label: 'Onay Bekliyor',       color: '#6366F1' },
  { key: 'policelesti',         label: 'Poliçeleşti',         color: '#10B981' },
  { key: 'referans_kazanildi',  label: 'Referans Kazanıldı',  color: '#14B8A6' },
];

export function dealStageOf(key: string | null | undefined) {
  return DEAL_STAGES.find((s) => s.key === key) ?? DEAL_STAGES[0];
}

export const PORTFOLIO_PRODUCTS = ['Hayat', 'BES', 'Kurumsal Sağlık', 'Grup Hayat', 'Diğer'] as const;

export const DEAL_SOURCES = ['Referans', 'Soğuk Ziyaret', 'Telefon', 'Mevcut Müşteri', 'Diğer'] as const;

export const LOST_REASONS = [
  { key: 'fiyat',       label: 'Fiyat' },
  { key: 'rakip',       label: 'Rakibi seçti' },
  { key: 'vazgecti',    label: 'Vazgeçti' },
  { key: 'ulasilamadi', label: 'Ulaşılamadı' },
  { key: 'diger',       label: 'Diğer' },
] as const;

export function lostReasonLabel(key: string | null): string | null {
  return LOST_REASONS.find((r) => r.key === key)?.label ?? key;
}

export const ACCOUNT_KINDS: Record<string, { label: string; emoji: string }> = {
  hastane: { label: 'Hastane', emoji: '🏥' },
  fabrika: { label: 'Fabrika', emoji: '🏭' },
  sirket:  { label: 'Şirket',  emoji: '🏢' },
  okul:    { label: 'Okul',    emoji: '🏫' },
  diger:   { label: 'Diğer',   emoji: '📁' },
};

/** Bayat iş eşiği (gün) — web ile aynı. */
export const STALE_WARN_DAYS = 7;
export const STALE_DANGER_DAYS = 14;

export type Deal = {
  id: string;
  agency_id: string;
  account_id: string | null;
  customer_id: string | null;
  title: string;
  product_interest: string;
  stage: string;
  status: 'open' | 'lost';
  owner_id: string | null;
  owner_name: string | null;
  expected_premium: number | null;
  currency: string;
  source: string | null;
  note: string | null;
  lost_reason: string | null;
  policy_id: string | null;
  stage_changed_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; name: string; phone: string | null; title: string | null } | null;
  accounts?: { id: string; name: string; kind: string } | null;
  /** İşe bağlı son görüşme (bayat iş rozeti için) */
  last_touch_at?: string | null;
};

export function daysSinceTouch(deal: Pick<Deal, 'last_touch_at' | 'created_at'>): number {
  const ref = deal.last_touch_at ?? deal.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
}

// ── Veri erişimi (RLS acente izolasyonunu zaten uygular) ─────────────────────
export async function fetchDeals(agencyId: string | null, role: string | null): Promise<Deal[]> {
  let q = (supabase.from('deals') as any)
    .select('*, customers(id, name, phone, title), accounts(id, name, kind)')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (role === 'agency_user') {
    if (!agencyId) return [];
    q = q.eq('agency_id', agencyId);
  }
  const { data } = await q;
  const deals = (data ?? []) as Deal[];
  if (deals.length === 0) return deals;

  // Son temas: işe bağlı görüşmelerin en yenisi
  let tq = (supabase.from('customer_interactions') as any)
    .select('deal_id, occurred_at')
    .not('deal_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(1000);
  if (role === 'agency_user' && agencyId) tq = tq.eq('agency_id', agencyId);
  const { data: touches } = await tq;
  const last = new Map<string, string>();
  for (const t of (touches ?? []) as { deal_id: string; occurred_at: string }[]) {
    if (t.deal_id && !last.has(t.deal_id)) last.set(t.deal_id, t.occurred_at);
  }
  return deals.map((d) => ({ ...d, last_touch_at: last.get(d.id) ?? null }));
}

export type NewDeal = {
  agency_id: string;
  customer_id: string | null;
  account_id: string | null;
  title: string;
  product_interest: string;
  owner_id: string | null;
  owner_name: string | null;
  expected_premium: number | null;
  source: string | null;
  note: string | null;
};

export async function addDeal(input: NewDeal): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('deals') as any)
    .insert({ ...input, updated_by: input.owner_id });
  return { error: error ? error.message : null };
}

/** Aşama değiştir — geçiş logunu DB trigger'ı yazar (deal_stage_log). */
export async function updateDealStage(id: string, stage: DealStageKey, userId: string | null): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('deals') as any)
    .update({ stage, updated_by: userId })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export async function markDealLost(id: string, reason: string, userId: string | null): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('deals') as any)
    .update({ status: 'lost', lost_reason: reason, updated_by: userId })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export async function reopenDeal(id: string, userId: string | null): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('deals') as any)
    .update({ status: 'open', updated_by: userId })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export type Account = {
  id: string;
  name: string;
  kind: string;
};

export async function fetchAccounts(agencyId: string | null, role: string | null): Promise<Account[]> {
  let q = (supabase.from('accounts') as any).select('id, name, kind').order('name');
  if (role === 'agency_user') {
    if (!agencyId) return [];
    q = q.eq('agency_id', agencyId);
  }
  const { data } = await q;
  return (data ?? []) as Account[];
}
