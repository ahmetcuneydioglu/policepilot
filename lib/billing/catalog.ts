/**
 * lib/billing/catalog.ts — plan tabanı yükleme + fallback.
 *
 * Tek fiyat kaynağı lib/planPricing.ts KORUNUR; bu modül plan_catalog'u sarmalar.
 * plan_catalog DB satırı yoksa PLAN_BASE fallback'i kullanılır (sessiz 20'ye düşme YOK).
 */

import { PLAN_PRICING } from "@/lib/planPricing";

export interface PlanCatalogRow {
  plan: string; label: string; monthly_price: number;
  base_users: number; base_customers: number; base_requests: number; base_policies: number;
  base_storage_mb: number; base_ai_credits: number; base_wa_monthly: number;
  modules: string[];
}

/** plan_catalog satırı bulunamazsa fallback (schema default'ları + spec yeni metrikler). */
export const PLAN_BASE: Record<string, PlanCatalogRow> = {
  starter:    { plan: "starter",    label: "Starter",    monthly_price: PLAN_PRICING.starter ?? 0,
                base_users: 5,   base_customers: 500,    base_requests: 500,    base_policies: 500,
                base_storage_mb: 10240,   base_ai_credits: 100,   base_wa_monthly: 1000,   modules: [] },
  pro:        { plan: "pro",        label: "Growth",     monthly_price: PLAN_PRICING.pro ?? 1490,
                base_users: 15,  base_customers: 5000,   base_requests: 5000,   base_policies: 5000,
                base_storage_mb: 102400,  base_ai_credits: 1000,  base_wa_monthly: 10000,  modules: [] },
  enterprise: { plan: "enterprise", label: "Enterprise", monthly_price: PLAN_PRICING.enterprise ?? 4990,
                base_users: 100, base_customers: 100000, base_requests: 100000, base_policies: 100000,
                base_storage_mb: 1048576, base_ai_credits: 10000, base_wa_monthly: 100000, modules: [] },
};

/** plan_catalog'tan plan satırını yükler; yoksa loglar ve PLAN_BASE'e düşer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlanRow(client: any, plan: string): Promise<PlanCatalogRow> {
  const { data } = await client.from("plan_catalog").select("*").eq("plan", plan).maybeSingle();
  if (data) return data as PlanCatalogRow;
  console.warn(`[billing] plan_catalog satırı yok: ${plan} → PLAN_BASE fallback`);
  return PLAN_BASE[plan] ?? PLAN_BASE.starter;
}
