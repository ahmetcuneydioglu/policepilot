/**
 * PORTFÖY — uzun satış döngüsü dünyası (Satış Hattı + Hesaplar): tipler + sabitler.
 * Mobil karşılığı: mobile/src/lib/portfolio.ts (sabitler DB sözleşmesidir, birebir aynı).
 * Kısa döngü (Fırsatlar/requests) AYRI yaşar — bkz lib/opportunities.ts.
 */

export type DealStageKey =
  | "lead" | "ilk_gorusme" | "ihtiyac_analizi" | "teklif_hazirlaniyor"
  | "teklif_gonderildi" | "takip" | "pazarlik" | "onay_bekliyor"
  | "policelesti" | "referans_kazanildi";

export type DealStage = {
  key: DealStageKey;
  label: string;
  badge: string;   // rozet: bg + text
  dot: string;     // nokta rengi
  accent: string;  // kanban kolon üst kenarı
};

/** Sıra = Satış Hattı akışı (soldan sağa). Kaybedildi kolon değil, çıkıştır. */
export const DEAL_STAGES: DealStage[] = [
  { key: "lead",                label: "Lead",                badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500",    accent: "border-t-blue-500" },
  { key: "ilk_gorusme",         label: "İlk Görüşme",         badge: "bg-sky-100 text-sky-700",         dot: "bg-sky-500",     accent: "border-t-sky-500" },
  { key: "ihtiyac_analizi",     label: "İhtiyaç Analizi",     badge: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-500",    accent: "border-t-cyan-500" },
  { key: "teklif_hazirlaniyor", label: "Teklif Hazırlanıyor", badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500",  accent: "border-t-violet-500" },
  { key: "teklif_gonderildi",   label: "Teklif Gönderildi",   badge: "bg-purple-100 text-purple-700",   dot: "bg-purple-500",  accent: "border-t-purple-500" },
  { key: "takip",               label: "Takip",               badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500",   accent: "border-t-amber-500" },
  { key: "pazarlik",            label: "Pazarlık",            badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-500",  accent: "border-t-orange-500" },
  { key: "onay_bekliyor",       label: "Onay Bekliyor",       badge: "bg-indigo-100 text-indigo-700",   dot: "bg-indigo-500",  accent: "border-t-indigo-500" },
  { key: "policelesti",         label: "Poliçeleşti",         badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", accent: "border-t-emerald-500" },
  { key: "referans_kazanildi",  label: "Referans Kazanıldı",  badge: "bg-teal-100 text-teal-700",       dot: "bg-teal-500",    accent: "border-t-teal-500" },
];

export const DEAL_STAGE_KEYS = DEAL_STAGES.map((s) => s.key);

const STAGE_MAP = new Map<string, DealStage>(DEAL_STAGES.map((s) => [s.key, s]));

/** Bilinmeyen aşama için Lead görünümüne düş (güvenli). */
export function dealStageOf(key: string | null | undefined): DealStage {
  return STAGE_MAP.get(key ?? "") ?? DEAL_STAGES[0];
}
export function isValidDealStage(key: string): key is DealStageKey {
  return STAGE_MAP.has(key);
}

/** Uzun döngü ürünleri (kısa döngü ürünleri Operasyon/Fırsatlar'da yaşar). */
export const PORTFOLIO_PRODUCTS = ["Hayat", "BES", "Kurumsal Sağlık", "Grup Hayat", "Diğer"] as const;

export const DEAL_SOURCES = ["Referans", "Soğuk Ziyaret", "Telefon", "Mevcut Müşteri", "Diğer"] as const;

export const LOST_REASONS = [
  { key: "fiyat",        label: "Fiyat" },
  { key: "rakip",        label: "Rakibi seçti" },
  { key: "vazgecti",     label: "Vazgeçti" },
  { key: "ulasilamadi",  label: "Ulaşılamadı" },
  { key: "diger",        label: "Diğer" },
] as const;

export function lostReasonLabel(key: string | null): string | null {
  return LOST_REASONS.find((r) => r.key === key)?.label ?? key;
}

export const ACCOUNT_KINDS = [
  { key: "hastane", label: "Hastane",  emoji: "🏥" },
  { key: "fabrika", label: "Fabrika",  emoji: "🏭" },
  { key: "sirket",  label: "Şirket",   emoji: "🏢" },
  { key: "okul",    label: "Okul",     emoji: "🏫" },
  { key: "diger",   label: "Diğer",    emoji: "📁" },
] as const;

export function accountKindMeta(key: string | null) {
  return ACCOUNT_KINDS.find((k) => k.key === key) ?? ACCOUNT_KINDS[4];
}

/** Bayat iş eşiği: son temastan bu yana gün. */
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
  status: "open" | "lost";
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
  /** API'nin hesapladığı son temas (deal'e bağlı görüşme) */
  last_touch_at?: string | null;
};

export type Account = {
  id: string;
  agency_id: string;
  name: string;
  kind: string;
  city: string | null;
  phone: string | null;
  note: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
};

/** Son temastan bu yana geçen gün (temas yoksa oluşturmadan itibaren). */
export function daysSinceTouch(deal: Pick<Deal, "last_touch_at" | "created_at">): number {
  const ref = deal.last_touch_at ?? deal.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
}
