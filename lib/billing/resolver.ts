/**
 * lib/billing/resolver.ts — ETKİN LİMİT çözümleme.
 *
 * getEffectiveLimits = plan tabanı ⊕ acente override ⊕ aktif eklentiler.
 *   • Legacy 4 (users/customers/requests/policies): agencies.max_* AUTHORITATIVE
 *     (admin override; mevcut davranış birebir korunur).
 *   • Yeni 3 (ai_credits/wa_monthly/storage_mb): plan_catalog tabanı.
 *   • + agency_addons (grants_metric × quantity × grant_per_unit; is_entitlement hariç).
 *   • isActive = is_active AND (expires_at boş VEYA gelecekte) → süre kapısı (K3).
 */

import { loadPlanRow } from "./catalog";
import type { EffectiveLimits, EffectiveResolution } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEffectiveLimits(client: any, agencyId: string): Promise<EffectiveResolution | null> {
  const [agRes, addonRes] = await Promise.all([
    client.from("agencies")
      .select("is_active, plan, expires_at, max_users, max_customers, max_requests, max_policies, max_ai_credits")
      .eq("id", agencyId).maybeSingle(),
    client.from("agency_addons")
      .select("quantity, addon_catalog(grants_metric, grant_per_unit, is_entitlement)")
      .eq("agency_id", agencyId).eq("status", "active"),
  ]);

  const ag = agRes.data;
  if (!ag) return null; // mevcut "agency_not_found" davranışı

  const planRow = await loadPlanRow(client, ag.plan ?? "starter");

  // Taban: legacy 4 = agencies.max_* (authoritative), yeni 3 = plan_catalog
  const limits: EffectiveLimits = {
    users:       ag.max_users     ?? planRow.base_users,
    customers:   ag.max_customers ?? planRow.base_customers,
    requests:    ag.max_requests  ?? planRow.base_requests,
    policies:    ag.max_policies  ?? planRow.base_policies,
    ai_credits:  ag.max_ai_credits ?? planRow.base_ai_credits,
    wa_monthly:  planRow.base_wa_monthly,
    storage_mb:  planRow.base_storage_mb,
  };

  // Aktif eklentiler — limit metriğine ekle (entitlement eklentileri Faz 4)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (addonRes.data ?? []) as any[]) {
    const cat = Array.isArray(a.addon_catalog) ? a.addon_catalog[0] : a.addon_catalog;
    if (!cat || cat.is_entitlement) continue;
    const metric = cat.grants_metric as keyof EffectiveLimits;
    if (metric in limits) limits[metric] += (a.quantity ?? 1) * (cat.grant_per_unit ?? 1);
  }

  // Aktiflik + süre kapısı
  const notExpired = !ag.expires_at || new Date(ag.expires_at).getTime() >= Date.now();
  const isActive = Boolean(ag.is_active) && notExpired;
  const status: EffectiveResolution["status"] = !ag.is_active ? "inactive" : !notExpired ? "expired" : "active";

  return {
    plan: ag.plan ?? "starter",
    label: planRow.label,
    status,
    isActive,
    limits,
    monthlyPrice: planRow.monthly_price,
    periodEnd: ag.expires_at ?? null,
  };
}
