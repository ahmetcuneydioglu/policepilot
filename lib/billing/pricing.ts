/**
 * lib/billing/pricing.ts — saf fiyat hesabı (UI canlı önizleme + server doğrulama).
 *
 * Tek fiyat girdisi DB'den (plan_catalog.monthly_price + addon_catalog.unit_price).
 * Client'ın gönderdiği fiyata ASLA güvenilmez — server bu fonksiyonla yeniden hesaplar.
 */

export const VAT_RATE = 0.20; // %20 KDV (TR)

export interface QuoteLineItem {
  key: string; label: string; quantity: number; unitPrice: number; total: number;
}

export interface PriceQuote {
  lineItems:           QuoteLineItem[];
  planPrice:           number;
  addonsTotal:         number;
  monthlyTotal:        number;  // plan + eklentiler (KDV hariç)
  vat:                 number;
  monthlyTotalWithVat: number;
  nextInvoiceEstimate: number;  // tam dönem (= monthlyTotalWithVat)
  proration?:          { remainingDays: number; periodDays: number; immediateCharge: number };
}

export interface QuoteInput {
  planLabel: string;
  planPrice: number;
  addons:    { key: string; label: string; quantity: number; unitPrice: number }[];
}

/**
 * Aylık tutar + KDV + (opsiyonel) kıst hesabı.
 * Kıst yalnız YÜKSELTMEDE anlık alınır (deltaMonthly>0); düşüşte sonraki döneme bırakılır.
 */
export function quotePrice(
  input: QuoteInput,
  proration?: { remainingDays: number; periodDays: number; previousMonthlyTotal: number }
): PriceQuote {
  const addonLines: QuoteLineItem[] = input.addons
    .filter((a) => a.quantity > 0)
    .map((a) => ({ key: a.key, label: a.label, quantity: a.quantity, unitPrice: a.unitPrice, total: a.quantity * a.unitPrice }));
  const addonsTotal = addonLines.reduce((s, l) => s + l.total, 0);
  const planPrice = Math.max(0, input.planPrice);
  const monthlyTotal = planPrice + addonsTotal;
  const vat = Math.round(monthlyTotal * VAT_RATE);
  const monthlyTotalWithVat = monthlyTotal + vat;

  const lineItems: QuoteLineItem[] = [
    { key: "plan", label: `${input.planLabel} planı`, quantity: 1, unitPrice: planPrice, total: planPrice },
    ...addonLines,
  ];

  const quote: PriceQuote = {
    lineItems, planPrice, addonsTotal, monthlyTotal, vat, monthlyTotalWithVat,
    nextInvoiceEstimate: monthlyTotalWithVat,
  };

  if (proration && proration.periodDays > 0) {
    const deltaMonthly = monthlyTotal - proration.previousMonthlyTotal;
    const ratio = Math.max(0, Math.min(1, proration.remainingDays / proration.periodDays));
    const amount = Math.max(0, Math.round(deltaMonthly * ratio));
    quote.proration = {
      remainingDays: proration.remainingDays,
      periodDays: proration.periodDays,
      immediateCharge: Math.round(amount * (1 + VAT_RATE)),
    };
  }

  return quote;
}
