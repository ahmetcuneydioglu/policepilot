/**
 * Satış Fırsatları — satış hattı aşamaları (tek kaynak).
 * Liste rozeti, Kanban kolon aksanı, drawer ve performans hepsi buradan okur.
 * Not: DB tablosu geriye-uyum için "requests"; UI her yerde "Satış Fırsatı" der.
 */

import type { RequestStatus } from "@/lib/database.types";

export type OpportunityStage = {
  key: RequestStatus;
  badge: string;   // rozet: bg + text
  dot: string;     // nokta rengi
  accent: string;  // kanban kolon üst kenarı
  ring: string;    // hex (grafik/aksent)
};

/** Sıra = satış hattı akışı (soldan sağa). Renkler kullanıcı spec'i. */
export const STAGES: OpportunityStage[] = [
  { key: "Yeni Lead",           badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",    accent: "border-t-blue-500",    ring: "#3b82f6" },
  { key: "İletişime Geçildi",   badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500",  accent: "border-t-orange-500",  ring: "#f97316" },
  { key: "Teklif Hazırlanıyor", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500",  accent: "border-t-violet-500",  ring: "#8b5cf6" },
  { key: "Takip Ediliyor",      badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",   accent: "border-t-amber-500",   ring: "#f59e0b" },
  { key: "Kazanıldı",           badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", accent: "border-t-emerald-500", ring: "#10b981" },
  { key: "Kaybedildi",          badge: "bg-rose-100 text-rose-700",     dot: "bg-rose-500",    accent: "border-t-rose-500",    ring: "#f43f5e" },
];

export const STAGE_KEYS: RequestStatus[] = STAGES.map((s) => s.key);

const STAGE_MAP = new Map<string, OpportunityStage>(STAGES.map((s) => [s.key, s]));

/** Bilinmeyen statü için Yeni Lead görünümüne düş (güvenli). */
export function stageOf(status: string | null | undefined): OpportunityStage {
  return STAGE_MAP.get(status ?? "") ?? STAGES[0];
}

export function isValidStage(status: string): status is RequestStatus {
  return STAGE_MAP.has(status);
}

/** Sigorta türleri — fırsat oluştururken (AddRequestModal ile aynı liste). */
export const OPPORTUNITY_TYPES = [
  "Kasko", "Trafik", "Konut", "Sağlık", "Hayat",
  "DASK", "Ferdi Kaza", "İMM", "Yeşil Kart", "Seyahat",
];
