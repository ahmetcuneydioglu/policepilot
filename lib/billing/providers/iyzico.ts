/**
 * lib/billing/providers/iyzico.ts — iyzico ödeme altyapısı HAZIRLIĞI (Faz 3).
 *
 * Türkiye SaaS standardı iyzico. Bu dosya soyutlama + iyzico istek/yanıt ŞEKİLLERİNİ
 * kurar; GERÇEK ağ çağrısı YOKTUR (resmi `iyzipay` SDK + canlı anahtarlar entegrasyon
 * anında eklenir). Varsayılan davranış DEĞİŞMEZ — sağlayıcı yalnız env ile açılır.
 *
 * Güvenlik:
 *  - Anahtarlar YALNIZ env'den okunur, asla kod içinde tutulmaz.
 *  - Webhook FAIL-CLOSED: doğru imza doğrulaması bağlanana (IYZICO_WIRED=true) kadar
 *    hiçbir olayı kabul etmez → sahte "ödendi" / yetkisiz tahsilat riski yok.
 *
 * Entegrasyon anında yapılacaklar (TODO — Faz 3, proje oturduktan sonra):
 *  1. `npm i iyzipay` (resmi SDK). buildCheckoutFormRequest payload'ı hazır.
 *  2. env: IYZICO_API_KEY / IYZICO_SECRET_KEY / IYZICO_BASE_URL / IYZICO_CALLBACK_URL /
 *     IYZICO_WEBHOOK_SECRET / IYZICO_WIRED=true.
 *  3. createCheckout → iyzipay.checkoutFormInitialize.create(payload) → paymentPageUrl.
 *  4. retrieveCheckout → iyzipay.checkoutForm.retrieve({ token }) → paymentStatus.
 *  5. verifyIyzicoSignature → iyzico'nun GÜNCEL bildirim imza şemasıyla doğrula.
 *  6. Aylık yinelenen tahsilat için iyzico "Abonelik (Subscription) API"si: plan_catalog
 *     → subscriptionProduct/subscriptionPricingPlan eşlemesi. Tek seferlik ek satın alımlar
 *     Checkout Form ile gider; ikisi de bu sağlayıcı arkasında toplanır.
 */

import crypto from "crypto";
import type { BillingProvider, CheckoutInput, CheckoutResult, WebhookVerification } from "../provider";

// ─── Yapılandırma (yalnız env) ───────────────────────────────────────────────────

export interface IyzicoConfig {
  apiKey:        string;
  secretKey:     string;
  baseUrl:       string;  // sandbox: https://sandbox-api.iyzipay.com · canlı: https://api.iyzipay.com
  callbackUrl:   string;  // iyzico, ödeme sonucu için buraya POST eder
  webhookSecret: string;  // bildirim imza doğrulama anahtarı
  wired:         boolean; // IYZICO_WIRED=true → SDK bağlandı (aksi halde tüm çağrılar fail-closed)
}

export function loadIyzicoConfig(): IyzicoConfig | null {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) return null; // anahtar yoksa sağlayıcı yapılandırılmamış
  return {
    apiKey,
    secretKey,
    baseUrl:       process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
    callbackUrl:   process.env.IYZICO_CALLBACK_URL || "",
    webhookSecret: process.env.IYZICO_WEBHOOK_SECRET || secretKey,
    wired:         (process.env.IYZICO_WIRED || "").toLowerCase() === "true",
  };
}

export function isIyzicoConfigured(): boolean {
  return loadIyzicoConfig() !== null;
}

// ─── iyzico Checkout Form istek şekli (payload builder — saf, SDK gerektirmez) ──────

export interface IyzicoBasketItem {
  id: string; name: string; category1: string; itemType: "VIRTUAL"; price: string;
}

export interface IyzicoCheckoutFormRequest {
  locale:              "tr";
  conversationId:      string;            // bizim external_ref ile eşleşir (mutabakat)
  price:               string;            // KDV dahil, 2 ondalık string (iyzico kuralı)
  paidPrice:           string;
  currency:            "TRY";
  basketId:            string;
  paymentGroup:        "SUBSCRIPTION" | "PRODUCT";
  callbackUrl:         string;
  enabledInstallments: number[];
  basketItems:         IyzicoBasketItem[];
}

/** CheckoutInput → iyzico Checkout Form init payload. Gerçek çağrı entegrasyonda eklenir. */
export function buildCheckoutFormRequest(
  input: CheckoutInput, cfg: IyzicoConfig, conversationId: string
): IyzicoCheckoutFormRequest {
  const amount = Math.max(0, input.amount).toFixed(2);
  return {
    locale:              "tr",
    conversationId,
    price:               amount,
    paidPrice:           amount,
    currency:            "TRY",
    basketId:            `${input.kind}-${input.agencyId.slice(0, 8)}`,
    paymentGroup:        input.kind === "plan" ? "SUBSCRIPTION" : "PRODUCT",
    callbackUrl:         cfg.callbackUrl,
    enabledInstallments: [1],
    basketItems: [
      { id: input.kind, name: input.description, category1: "Abonelik", itemType: "VIRTUAL", price: amount },
    ],
  };
}

/**
 * Bildirim imza doğrulama — HMAC-SHA256 (base64), sabit-zaman karşılaştırma.
 * NOT: iyzico'nun imzaladığı alanların birleşimi doküman sürümüne göre DEĞİŞİR;
 * entegrasyonda güncel şema ile teyit edilecek. Bu helper raw gövde üzerinden doğrular.
 */
export function verifyIyzicoSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // uzunluk uyuşmazlığı vb. → reddet
  }
}

// ─── Sağlayıcı ────────────────────────────────────────────────────────────────────

export class IyzicoProvider implements BillingProvider {
  readonly name = "iyzico";
  private cfg: IyzicoConfig;
  constructor(cfg: IyzicoConfig) { this.cfg = cfg; }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const conversationId = `IYZ-${input.agencyId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const payload = buildCheckoutFormRequest(input, this.cfg, conversationId);
    void payload; // entegrasyonda iyzipay.checkoutFormInitialize.create(payload)'a verilecek
    if (!this.cfg.wired) {
      throw new Error("iyzico henüz bağlanmadı (Faz 3): `iyzipay` SDK + IYZICO_WIRED=true gerekir.");
    }
    // TODO Faz 3:
    //   const res = await iyzipay.checkoutFormInitialize.create(payload);
    //   return { autoApproved: false, url: res.paymentPageUrl, reference: conversationId };
    throw new Error("iyzico.checkoutFormInitialize entegrasyonu Faz 3'te tamamlanacak.");
  }

  /** Checkout Form token'ından ödeme sonucunu çek (iyzico retrieve). */
  async retrieveCheckout(reference: string): Promise<WebhookVerification> {
    if (!this.cfg.wired) return { ok: false, reference, status: "pending" };
    // TODO Faz 3: iyzipay.checkoutForm.retrieve({ token: reference }) → paymentStatus==="SUCCESS"
    return { ok: false, reference, status: "pending" };
  }

  /** iyzico bildirim/callback gövdesini doğrula + sonucu çöz. FAIL-CLOSED. */
  async verifyWebhook(req: { headers: Record<string, string | null>; rawBody: string }): Promise<WebhookVerification> {
    const sig = req.headers["x-iyz-signature-v3"] ?? req.headers["x-iyz-signature"] ?? null;
    if (!this.cfg.wired || !verifyIyzicoSignature(req.rawBody, sig, this.cfg.webhookSecret)) {
      return { ok: false }; // imza doğrulanana/bağlanana kadar hiçbir olayı kabul etme
    }
    // TODO Faz 3: JSON.parse(rawBody) → { iyziEventType, status, paymentConversationId }
    //   const body = JSON.parse(req.rawBody);
    //   return { ok: true, reference: body.paymentConversationId,
    //            status: body.status === "SUCCESS" ? "paid" : "failed", raw: body };
    return { ok: false };
  }
}
