/**
 * Plan fiyatlandırması (₺/ay) — gelir hesapları bu haritadan türetilir.
 * Gerçek ödeme altyapısı (Stripe/iyzico) bağlanana kadar "plan bazlı tahmini
 * gelir" olarak etiketlenir; bağlandığında tek değişecek yer burasıdır.
 */

export const PLAN_PRICING: Record<string, number> = {
  starter:    0,      // deneme / ücretsiz katman
  pro:        1490,
  enterprise: 4990,
};

export const PLAN_LABELS: Record<string, string> = {
  starter:    "Starter",
  pro:        "Growth",   // plan kodu 'pro' korunur; etiket Growth (abonelik spec'i)
  enterprise: "Enterprise",
};

export function planMonthlyRevenue(plan: string | null | undefined): number {
  return PLAN_PRICING[plan ?? "starter"] ?? 0;
}
