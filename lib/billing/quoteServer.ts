/**
 * lib/billing/quoteServer.ts — server-side fiyat hesabı (client fiyatına güvenmez).
 * Plan + eklenti adetlerini DB kataloğundan fiyatlayıp PriceQuote döner.
 */

import { quotePrice, type PriceQuote } from "./pricing";
import { loadPlanRow } from "./catalog";

export interface QuoteRequest { plan?: string; addons?: Record<string, number> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildServerQuote(client: any, agencyId: string, req: QuoteRequest): Promise<PriceQuote> {
  const { data: ag } = await client.from("agencies").select("plan, expires_at").eq("id", agencyId).maybeSingle();
  const currentPlan = ag?.plan ?? "starter";
  const targetPlan  = req.plan ?? currentPlan;

  const [targetPlanRow, currentPlanRow, addonCatRes, curAddonsRes] = await Promise.all([
    loadPlanRow(client, targetPlan),
    loadPlanRow(client, currentPlan),
    client.from("addon_catalog").select("key, label, unit_price, is_active"),
    client.from("agency_addons").select("quantity, unit_price_snapshot").eq("agency_id", agencyId).eq("status", "active"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catMap = new Map<string, any>(((addonCatRes.data ?? []) as any[]).map((a) => [a.key, a]));
  const addons = Object.entries(req.addons ?? {})
    .filter(([, q]) => (q ?? 0) > 0)
    .map(([key, quantity]) => {
      const c = catMap.get(key);
      return { key, label: c?.label ?? key, quantity: quantity as number, unitPrice: c?.unit_price ?? 0 };
    });

  // Önceki aylık (kıst için): mevcut plan + mevcut aktif eklentiler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevAddons = ((curAddonsRes.data ?? []) as any[]).reduce((s, a) => s + (a.quantity ?? 0) * (a.unit_price_snapshot ?? 0), 0);
  const previousMonthlyTotal = currentPlanRow.monthly_price + prevAddons;

  let proration: { remainingDays: number; periodDays: number; previousMonthlyTotal: number } | undefined;
  if (ag?.expires_at) {
    const remainingDays = Math.max(0, Math.ceil((new Date(ag.expires_at).getTime() - Date.now()) / 864e5));
    proration = { remainingDays, periodDays: 30, previousMonthlyTotal };
  }

  return quotePrice({ planLabel: targetPlanRow.label, planPrice: targetPlanRow.monthly_price, addons }, proration);
}
