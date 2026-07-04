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
  // Aktive edilirken UI adı "Teklif Merkezi" → "Fiyat Çalışması" olacak
  // (ürün ilkesi: acente teklif ALMAZ; şirketlerden fiyat toplar, müşteriye teklif HAZIRLAR).
  quoteCenter: false,

  /**
   * phoneOtpGate: Yeni kayıtlarda telefon OTP doğrulama kapısı (verify-phone).
   *   v1.0'da KAPALI: SMS sağlayıcı henüz mock (kod gerçekte gönderilmiyor) —
   *   reviewer/gerçek kullanıcı kayıt olursa asla gelmeyecek kodu bekler (Guideline 2.1).
   *   Gerçek SMS/WhatsApp OTP sağlayıcısı canlıya alınınca `true` yap; gate,
   *   _layout.tsx'te otomatik devreye girer (backend + verify-phone ekranı hazır).
   */
  phoneOtpGate: false,
};
