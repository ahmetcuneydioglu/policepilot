/**
 * Özellik bayrakları (web) — mobil karşılığı: mobile/src/lib/features.ts
 *
 * quoteCenter: Teklif Merkezi (quote-center) — şirketlerden fiyat toplama çalışması.
 *   KAPALI: bugün demo veriyle çalışıyor; gerçek şirket API entegrasyonları yok.
 *   Ürün ilkesi: panel OPERASYON dili konuşur; "Teklif Al" yalnız public
 *   müşteri yüzeylerinde (/teklif-al, /a/[slug]/teklif-al). Bu modül gerçek
 *   API'lerle aktive edilirken "Fiyat Çalışması" adıyla dönecek
 *   (acente şirketlerden fiyat toplar → müşteriye teklif HAZIRLAR).
 *   true yapınca sidebar spotlight'ı otomatik geri gelir.
 */
export const FEATURES = {
  quoteCenter: false,
};
