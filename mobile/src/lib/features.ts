/**
 * Özellik bayrakları (mobil).
 *
 * quoteCenter: Teklif Merkezi — canlı teklif (quoteDemo) + kredi kartı ödeme akışı.
 *   v1.0 App Store sürümünde KAPALI: sahte/çalışmayan kart formu + demo teklifler
 *   Guideline 2.1 (App Completeness) reddine yol açar. Sigorta API entegrasyonları
 *   ve gerçek ödeme sağlayıcısı hazır olunca `true` yap → tüm giriş noktaları
 *   (orta FAB, Fırsatlar hero, Yenileme satır aksiyonu, dashboard hızlı aksiyon)
 *   otomatik geri gelir. Kod silinmedi; yalnızca girişler bayrağa bağlı.
 */
export const FEATURES = {
  quoteCenter: false,
};
