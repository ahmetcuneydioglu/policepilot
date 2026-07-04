/**
 * IRM — müşteri görüşme/ilişki kayıtları (customer_interactions).
 * Web karşılığı: lib/interactionTypes.ts — sabitler DB sözleşmesidir, birebir aynı.
 */

import { supabase } from './supabase';

export type Interaction = {
  id: string;
  agency_id: string;
  customer_id: string;
  staff_id: string | null;
  staff_name: string | null;
  occurred_at: string;
  kind: 'manual' | 'auto';
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
  created_at: string;
};

export const CHANNELS = [
  { key: 'phone',        label: 'Telefon',  emoji: '📞' },
  { key: 'whatsapp',     label: 'WhatsApp', emoji: '💬' },
  { key: 'face_to_face', label: 'Yüz yüze', emoji: '🤝' },
  { key: 'email',        label: 'E-posta',  emoji: '✉️' },
  { key: 'video',        label: 'Video',    emoji: '🎥' },
  { key: 'sms',          label: 'SMS',      emoji: '📱' },
  { key: 'other',        label: 'Diğer',    emoji: '•' },
] as const;

export const LOCATIONS = [
  { key: 'office',        label: 'Ofis' },
  { key: 'customer_home', label: 'Ev' },
  { key: 'workplace',     label: 'İşyeri' },
  { key: 'hospital',      label: 'Hastane' },
  { key: 'cafe',          label: 'Kafe' },
  { key: 'online',        label: 'Online' },
  { key: 'other',         label: 'Diğer' },
] as const;

export const INTERACTION_PRODUCTS = [
  'Trafik', 'Kasko', 'TSS', 'Özel Sağlık', 'DASK', 'Konut', 'Seyahat', 'Ferdi Kaza', 'Diğer',
] as const;

export const OUTCOMES = [
  { key: 'teklif_bekliyor', label: 'Teklif Bekliyor' },
  { key: 'dusunuyor',       label: 'Düşünüyor' },
  { key: 'tekrar_ara',      label: 'Tekrar Ara' },
  { key: 'policelesti',     label: 'Poliçeleşti' },
  { key: 'ilgilenmedi',     label: 'İlgilenmedi' },
  { key: 'rakip_teklif',    label: 'Rakipten Teklif' },
  { key: 'iptal',           label: 'İptal' },
] as const;

export const NEXT_ACTIONS = [
  { key: 'call',       label: 'Tekrar ara',    emoji: '📞' },
  { key: 'send_quote', label: 'Teklif gönder', emoji: '📄' },
  { key: 'whatsapp',   label: 'WhatsApp',      emoji: '💬' },
  { key: 'visit',      label: 'Ziyaret et',    emoji: '📍' },
  { key: 'reminder',   label: 'Hatırlatma',    emoji: '⏰' },
] as const;

export const CUSTOMER_TAGS = [
  { key: 'vip',               label: 'VIP',               emoji: '⭐' },
  { key: 'sadik',             label: 'Sadık',             emoji: '💙' },
  { key: 'yuksek_oncelik',    label: 'Yüksek öncelik',    emoji: '🔥' },
  { key: 'capraz_satis',      label: 'Çapraz satış',      emoji: '🎯' },
  { key: 'fiyat_hassas',      label: 'Fiyat hassas',      emoji: '💰' },
  { key: 'kararsiz',          label: 'Kararsız',          emoji: '🤔' },
  { key: 'rakiple_calisiyor', label: 'Rakiple çalışıyor', emoji: '⚔️' },
] as const;

export const AUTO_SOURCE_META: Record<string, { label: string; emoji: string }> = {
  policy_created:    { label: 'Poliçe kesildi',        emoji: '🛡' },
  quote_created:     { label: 'Fırsat açıldı',         emoji: '📄' },
  document_uploaded: { label: 'Evrak yüklendi',        emoji: '📷' },
  whatsapp_sent:     { label: 'WhatsApp gönderildi',   emoji: '💬' },
  renewal_reminder:  { label: 'Yenileme hatırlatması', emoji: '🔄' },
  ai_summary:        { label: 'AI özeti üretildi',     emoji: '🤖' },
};

export function outcomeLabel(key: string | null): string | null {
  return OUTCOMES.find((o) => o.key === key)?.label ?? null;
}
export function channelMeta(key: string | null) {
  return CHANNELS.find((c) => c.key === key) ?? { key: 'other', label: 'Görüşme', emoji: '•' };
}
export function nextActionMeta(key: string | null) {
  return NEXT_ACTIONS.find((n) => n.key === key) ?? null;
}
export function locationLabel(key: string | null): string | null {
  return LOCATIONS.find((l) => l.key === key)?.label ?? null;
}

export async function fetchInteractions(customerId: string): Promise<Interaction[]> {
  const { data } = await (supabase.from('customer_interactions') as any)
    .select('*')
    .eq('customer_id', customerId)
    .order('occurred_at', { ascending: false })
    .limit(200);
  return (data ?? []) as Interaction[];
}

export type NewInteraction = {
  agency_id: string;
  customer_id: string;
  staff_id: string | null;
  staff_name: string | null;
  occurred_at: string;
  channel: string;
  location: string | null;
  location_note: string | null;
  product: string | null;
  outcome: string | null;
  note: string | null;
  next_action: string | null;
  next_action_date: string | null;
};

export async function addInteraction(input: NewInteraction): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('customer_interactions') as any)
    .insert({ ...input, kind: 'manual' });
  return { error: error ? error.message : null };
}

export async function updateCustomerTags(customerId: string, tags: string[]): Promise<void> {
  await (supabase.from('customers') as any).update({ tags }).eq('id', customerId);
}
