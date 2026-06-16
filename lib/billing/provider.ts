/**
 * lib/billing/provider.ts — ödeme sağlayıcı soyutlaması (Stripe/iyzico hazırlığı).
 *
 * Faz 2: yalnız ManualProvider — gerçek tahsilat YOK, "fatura oluşturuldu (tahsilat
 * bekliyor)" akışı. Çağıran route'lar provider arayüzüne bağlanır; Faz 3'te
 * StripeProvider/IyzicoProvider aynı arayüzü implemente eder, route'lar DEĞİŞMEZ.
 */

export interface CheckoutInput {
  agencyId:    string;
  kind:        "plan" | "addons";
  amount:      number;   // KDV dahil tahmini tutar (kuruş değil, ₺ tam)
  description: string;
}

export interface CheckoutResult {
  autoApproved: boolean;   // true → route değişikliği hemen uygular (manuel)
  url:          string | null;  // gerçek provider'da ödeme sayfası URL'i
  reference:    string;    // billing_events.external_ref
}

export interface BillingProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/** Manuel/simülasyon — anında onaylar, gerçek para çekmez. */
export class ManualProvider implements BillingProvider {
  readonly name = "manual";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const ref = `MANUAL-${input.agencyId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    return { autoApproved: true, url: null, reference: ref };
  }
}

/** Aktif sağlayıcı. Faz 3'te env BILLING_PROVIDER ile stripe/iyzico seçilir. */
export function getBillingProvider(): BillingProvider {
  // const which = process.env.BILLING_PROVIDER;
  // if (which === "stripe") return new StripeProvider();
  return new ManualProvider();
}
