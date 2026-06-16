/**
 * lib/billing/types.ts — abonelik & limit motoru ortak tipleri.
 */

export type MetricKey =
  | "users" | "customers" | "requests" | "policies"   // anlık (canlı sayım)
  | "ai_credits" | "wa_monthly" | "storage_mb";       // dönemsel/SUM

export const LIMIT_METRICS: MetricKey[] = [
  "users", "customers", "requests", "policies", "ai_credits", "wa_monthly", "storage_mb",
];

/** Dönemsel sayaçların tutulduğu metrikler (usage_counters). */
export const PERIOD_METRICS = { ai_credits: "ai_credits", wa_monthly: "wa_sent" } as const;

export const WARN_THRESHOLD  = 0.8;   // ≥%80 sarı
export const BLOCK_THRESHOLD = 1.0;   // ≥%100 doldu

export type EffectiveLimits = Record<MetricKey, number>;

export interface EffectiveResolution {
  plan:         string;                 // 'starter'|'pro'|'enterprise'
  label:        string;                 // Starter|Growth|Enterprise
  status:       "active" | "inactive" | "expired";
  isActive:     boolean;                // is_active AND süre kapısı
  limits:       EffectiveLimits;        // etkin limit (taban + override + eklenti)
  monthlyPrice: number;
  periodEnd:    string | null;          // agencies.expires_at (sonraki ödeme/süre)
}

export interface UsageEntry { used: number; max: number }
export type UsageSnapshot = Record<MetricKey, UsageEntry>;
