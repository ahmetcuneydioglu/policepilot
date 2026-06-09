/**
 * PolicePilot — Payment Service (Mock)
 *
 * ⚠️  GÜVENLİK KURALI: Kart bilgileri (kart no, CVV, son kullanma tarihi)
 *     ASLA veritabanına kaydedilmez. Bu servis yalnızca işlem ID'si ve
 *     sonuç durumu döndürür.
 *
 * İleride: gerçek ödeme sağlayıcısı (İyzico, PayTR, Stripe) entegrasyonu
 *          bu servisten geçecek. Kart verisi yalnızca sağlayıcı SDK'sına
 *          iletilir; hiçbir zaman sunucumuza yazılmaz.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentInput {
  amount:      number;       // Ödeme tutarı (TRY)
  currency:    "TRY";       // Şimdilik sabit
  description: string;       // Poliçe / teklif açıklaması
  // ⚠️ Kart bilgisi bu servise GELMEZ — frontend tokenize eder (mock'ta da gelmez)
  cardToken?:  string;       // Tokenize kart referansı (gerçek entegrasyonda kullanılır)
}

export interface PaymentResult {
  success:        boolean;
  transactionId:  string;    // Ödeme sağlayıcısı işlem ID'si
  method:         "card";    // Genişletilebilir: "bank_transfer" | "cash"
  amount:         number;
  currency:       "TRY";
  processedAt:    string;    // ISO 8601
  errorMessage?:  string;
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function generateTransactionId(): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

/** Mock işlem süresi: 1.0 – 2.5 saniye */
function mockDelay(): Promise<void> {
  const ms = 1000 + Math.random() * 1500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Mock ödeme işlemi.
 *
 * Gerçek bir ödeme sağlayıcısıyla bağlantı kurulmaz.
 * Demo/geliştirme aşamasında %100 başarı döndürür.
 *
 * ⚠️  Kart numarası, CVV, son kullanma tarihi bu fonksiyona ASLA taşınmaz.
 *     Yalnızca tutar ve açıklama alınır.
 */
export async function processMockPayment(input: PaymentInput): Promise<PaymentResult> {
  // Gerçek API entegrasyonunda: burada sağlayıcı SDK'sı çağrılır
  await mockDelay();

  const transactionId = generateTransactionId();

  return {
    success:       true,
    transactionId,
    method:        "card",
    amount:        input.amount,
    currency:      "TRY",
    processedAt:   new Date().toISOString(),
  };
}

/**
 * Ödeme sonucunun doğrulanması (webhook / sağlayıcı callback).
 * Şimdilik mock — ileride gerçek sağlayıcı yanıtını doğrular.
 */
export async function verifyPayment(transactionId: string): Promise<{
  verified:   boolean;
  status:     "paid" | "failed" | "pending";
}> {
  // Mock: transaction ID varsa her zaman paid
  if (transactionId.startsWith("TXN-")) {
    return { verified: true, status: "paid" };
  }
  return { verified: false, status: "failed" };
}
