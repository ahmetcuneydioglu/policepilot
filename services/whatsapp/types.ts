/**
 * PolicePilot — WhatsApp Provider Abstraction
 *
 * Tüm WhatsApp otomasyonlarının (günlük özet, yenileme uyarısı, teklif hazır,
 * poliçe kesildi, tahsilat, eksik evrak…) ortak gönderim katmanı.
 *
 * Kod hiçbir yerde doğrudan Meta/Twilio çağırmaz — yalnız bu interface'i kullanır.
 */

export type WhatsAppProviderName = "mock" | "meta_cloud" | "twilio" | "dialog360" | "wati";

export interface WhatsAppMessage {
  /** E.164 benzeri numara: 905xxxxxxxxx */
  phone:   string;
  message: string;
}

export interface WhatsAppSendResult {
  success:      boolean;
  /** Sağlayıcının döndürdüğü mesaj/işlem id'si */
  providerId?:  string;
  errorMessage?: string;
}

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  send(msg: WhatsAppMessage): Promise<WhatsAppSendResult>;
}

export interface ProviderConfig {
  provider: WhatsAppProviderName;
  apiKey?:  string | null;
  /** Meta Cloud API için phone_number_id; diğer sağlayıcılarda kullanılmaz */
  senderId?: string | null;
}
