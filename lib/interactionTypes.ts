/**
 * IRM — müşteri görüşme/ilişki kayıtları: paylaşılan tipler + sabitler (client-safe).
 * Mobil karşılığı: mobile/src/lib/relationship.ts (aynı değerler — DB sözleşmesi).
 */

export type InteractionKind = "manual" | "auto";

export type Interaction = {
  id: string;
  agency_id: string;
  customer_id: string;
  staff_id: string | null;
  staff_name: string | null;
  occurred_at: string;
  kind: InteractionKind;
  auto_source: string | null;
  channel: string | null;
  location: string | null;
  location_note: string | null;
  product: string | null;
  outcome: string | null;
  note: string | null;
  next_action: string | null;
  next_action_date: string | null;
  next_action_done: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const CHANNELS = [
  { key: "phone",        label: "Telefon",   emoji: "📞" },
  { key: "whatsapp",     label: "WhatsApp",  emoji: "💬" },
  { key: "face_to_face", label: "Yüz yüze",  emoji: "🤝" },
  { key: "email",        label: "E-posta",   emoji: "✉️" },
  { key: "video",        label: "Video",     emoji: "🎥" },
  { key: "sms",          label: "SMS",       emoji: "📱" },
  { key: "other",        label: "Diğer",     emoji: "•" },
] as const;

export const LOCATIONS = [
  { key: "office",        label: "Ofis" },
  { key: "customer_home", label: "Ev" },
  { key: "workplace",     label: "İşyeri" },
  { key: "hospital",      label: "Hastane" },
  { key: "cafe",          label: "Kafe" },
  { key: "online",        label: "Online" },
  { key: "other",         label: "Diğer" },
] as const;

export const INTERACTION_PRODUCTS = [
  "Trafik", "Kasko", "TSS", "Özel Sağlık", "DASK", "Konut", "Seyahat", "Ferdi Kaza", "Diğer",
] as const;

export const OUTCOMES = [
  { key: "teklif_bekliyor", label: "Teklif Bekliyor", tone: "amber" },
  { key: "dusunuyor",       label: "Düşünüyor",       tone: "amber" },
  { key: "tekrar_ara",      label: "Tekrar Ara",      tone: "blue" },
  { key: "policelesti",     label: "Poliçeleşti",     tone: "green" },
  { key: "ilgilenmedi",     label: "İlgilenmedi",     tone: "slate" },
  { key: "rakip_teklif",    label: "Rakipten Teklif", tone: "red" },
  { key: "iptal",           label: "İptal",           tone: "red" },
] as const;

export const NEXT_ACTIONS = [
  { key: "call",       label: "Tekrar ara",     emoji: "📞" },
  { key: "send_quote", label: "Teklif gönder",  emoji: "📄" },
  { key: "whatsapp",   label: "WhatsApp",       emoji: "💬" },
  { key: "visit",      label: "Ziyaret et",     emoji: "📍" },
  { key: "reminder",   label: "Hatırlatma",     emoji: "⏰" },
] as const;

/** Müşteri analizi etiketleri (customers.tags) */
export const CUSTOMER_TAGS = [
  { key: "vip",               label: "VIP",                 emoji: "⭐" },
  { key: "sadik",             label: "Sadık müşteri",       emoji: "💙" },
  { key: "yuksek_oncelik",    label: "Yüksek öncelik",      emoji: "🔥" },
  { key: "capraz_satis",      label: "Çapraz satış",        emoji: "🎯" },
  { key: "fiyat_hassas",      label: "Fiyat hassasiyeti",   emoji: "💰" },
  { key: "kararsiz",          label: "Kararsız",            emoji: "🤔" },
  { key: "rakiple_calisiyor", label: "Rakiple çalışıyor",   emoji: "⚔️" },
] as const;

export function channelMeta(key: string | null) {
  return CHANNELS.find((c) => c.key === key) ?? { key: "other", label: "Görüşme", emoji: "•" };
}
export function outcomeMeta(key: string | null) {
  return OUTCOMES.find((o) => o.key === key) ?? null;
}
export function nextActionMeta(key: string | null) {
  return NEXT_ACTIONS.find((n) => n.key === key) ?? null;
}
export function locationMeta(key: string | null) {
  return LOCATIONS.find((l) => l.key === key) ?? null;
}
export function tagMeta(key: string) {
  return CUSTOMER_TAGS.find((t) => t.key === key) ?? { key, label: key, emoji: "🏷" };
}

/** Auto olay görselleri (Faz 2 kaynakları — okuma tarafı şimdiden hazır) */
export const AUTO_SOURCE_META: Record<string, { label: string; emoji: string }> = {
  policy_created:    { label: "Poliçe kesildi",           emoji: "🛡" },
  quote_created:     { label: "Fırsat açıldı",            emoji: "📄" },
  document_uploaded: { label: "Evrak yüklendi",           emoji: "📷" },
  whatsapp_sent:     { label: "WhatsApp gönderildi",      emoji: "💬" },
  renewal_reminder:  { label: "Yenileme hatırlatması",    emoji: "🔄" },
  ai_summary:        { label: "AI özeti üretildi",        emoji: "🤖" },
};
