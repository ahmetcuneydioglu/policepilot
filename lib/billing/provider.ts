/**
 * lib/billing/provider.ts — ödeme sağlayıcı soyutlaması (iyzico hazırlığı).
 *
 * Faz 2: yalnız ManualProvider — gerçek tahsilat YOK, "fatura oluşturuldu (tahsilat
 * bekliyor)" akışı. Çağıran route'lar provider arayüzüne bağlanır; Faz 3'te
 * IyzicoProvider aynı arayüzü implemente eder, route'lar DEĞİŞMEZ.
 *
 * Sağlayıcı seçimi env ile: BILLING_PROVIDER=iyzico + IYZICO_* anahtarları → iyzico,
 * aksi halde varsayılan manuel. iyzico ayrıntısı lib/billing/providers/iyzico.ts.
 */

import { loadIyzicoConfig, IyzicoProvider } from "./providers/iyzico";

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

/** Webhook/callback doğrulama sonucu — Faz 3 (iyzico bildirim mutabakatı). */
export interface WebhookVerification {
  ok:         boolean;                          // imza doğrulandı + kabul edilebilir mi
  reference?: string;                           // mutabakat için external_ref (iyzico conversationId)
  status?:    "paid" | "failed" | "pending";    // çözülen ödeme durumu
  raw?:       unknown;                           // ham gövde (denetim/log)
}

export interface BillingProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Faz 3: sağlayıcı bildirim/callback gövdesini doğrula + sonucu çöz (opsiyonel). */
  verifyWebhook?(req: { headers: Record<string, string | null>; rawBody: string }): Promise<WebhookVerification>;
  /** Faz 3: checkout token'ından ödeme sonucunu çek (iyzico retrieve, opsiyonel). */
  retrieveCheckout?(reference: string): Promise<WebhookVerification>;
}

/** Manuel/simülasyon — anında onaylar, gerçek para çekmez. */
export class ManualProvider implements BillingProvider {
  readonly name = "manual";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const ref = `MANUAL-${input.agencyId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    return { autoApproved: true, url: null, reference: ref };
  }
}

/**
 * Aktif sağlayıcı. env BILLING_PROVIDER=iyzico ve iyzico anahtarları varsa iyzico,
 * aksi halde manuel (varsayılan — mevcut davranış). iyzico modülü yan etkisizdir
 * (yalnız `crypto` + saf builder'lar); sınıf yalnız seçildiğinde örneklenir.
 */
export function getBillingProvider(): BillingProvider {
  const which = (process.env.BILLING_PROVIDER || "manual").toLowerCase();
  if (which === "iyzico") {
    const cfg = loadIyzicoConfig();
    if (cfg) return new IyzicoProvider(cfg);
    // Anahtar yoksa sessizce manuele düşmek yerine açıkça uyar (yanlış yapılandırma fark edilsin)
    console.warn("[billing] BILLING_PROVIDER=iyzico ama IYZICO_API_KEY/SECRET_KEY yok → manuele düşülüyor.");
  }
  return new ManualProvider();
}
