/**
 * src/lib/opportunities.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Satış hattı aşamaları (web lib/opportunities.ts ile birebir, RN renkleriyle).
 * DB tablosu geriye-uyum için "requests"; UI "Teklif / Satış Fırsatı" der.
 * requests.status CHECK constraint YALNIZCA bu 6 değeri kabul eder.
 */

import type { RequestStatus } from './types';

export type Stage = {
  key: RequestStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  dot: string;
};

export const STAGES: Stage[] = [
  { key: 'Yeni Lead',           label: 'Yeni Lead',           badgeBg: '#EFF6FF', badgeText: '#2563EB', dot: '#3B82F6' },
  { key: 'İletişime Geçildi',   label: 'İletişime Geçildi',   badgeBg: '#FFF7ED', badgeText: '#C2410C', dot: '#F97316' },
  { key: 'Teklif Hazırlanıyor', label: 'Teklif Hazırlanıyor', badgeBg: '#F5F3FF', badgeText: '#6D28D9', dot: '#8B5CF6' },
  { key: 'Takip Ediliyor',      label: 'Takip Ediliyor',      badgeBg: '#FFFBEB', badgeText: '#B45309', dot: '#F59E0B' },
  { key: 'Kazanıldı',           label: 'Kazanıldı',           badgeBg: '#ECFDF5', badgeText: '#047857', dot: '#10B981' },
  { key: 'Kaybedildi',          label: 'Kaybedildi',          badgeBg: '#FFF1F2', badgeText: '#BE123C', dot: '#F43F5E' },
];

export const STAGE_KEYS: RequestStatus[] = STAGES.map((s) => s.key);

const STAGE_MAP = new Map<string, Stage>(STAGES.map((s) => [s.key, s]));

/** Bilinmeyen/eski statü için güvenli düşüş (Yeni Lead görünümü). */
export function stageOf(status: string | null | undefined): Stage {
  return STAGE_MAP.get(status ?? '') ?? STAGES[0];
}

/** Satış hattı akışı — bir aşamadan geçilebilecek geçerli sonraki aşamalar. */
export function nextStages(status: RequestStatus): RequestStatus[] {
  switch (status) {
    case 'Yeni Lead':           return ['İletişime Geçildi', 'Kaybedildi'];
    case 'İletişime Geçildi':   return ['Teklif Hazırlanıyor', 'Kaybedildi'];
    case 'Teklif Hazırlanıyor': return ['Takip Ediliyor', 'Kazanıldı', 'Kaybedildi'];
    case 'Takip Ediliyor':      return ['Kazanıldı', 'Kaybedildi'];
    case 'Kazanıldı':           return [];
    case 'Kaybedildi':          return ['Yeni Lead'];
    default:                    return [];
  }
}

export function isActiveStage(status: string | null | undefined): boolean {
  return status !== 'Kazanıldı' && status !== 'Kaybedildi';
}

/** Sigorta türleri — teklif oluştururken (web ile aynı liste). */
export const OPPORTUNITY_TYPES = [
  'Kasko', 'Trafik', 'Konut', 'Sağlık', 'Hayat',
  'DASK', 'Ferdi Kaza', 'İMM', 'Yeşil Kart', 'Seyahat',
];
