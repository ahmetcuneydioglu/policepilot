/**
 * Poliçe durum & kaynak sözlüğü — web karşılığı: lib/policyStatus.ts (birebir aynı değerler).
 * "Süresi Doldu" DB'de SAKLANMAZ — Aktif + end_date < bugün'den türetilir.
 * Yenileme motoru / dashboard yalnız 'Aktif'i sayar.
 * Renkler 500-700 tonu — açık/koyu temada okunur (hardcoded pastel YOK).
 */

export type StoredPolicyStatus =
  | 'Taslak' | 'Teklif Hazırlanıyor' | 'Şirkette Kesildi' | 'Aktif' | 'İptal'
  | 'Pasif' | 'Yenilendi'; // legacy

export const POLICY_STATUSES: { key: StoredPolicyStatus; label: string; emoji: string; color: string; desc: string }[] = [
  { key: 'Taslak',              label: 'Taslak',              emoji: '📝', color: '#64748B', desc: 'Bilgiler giriliyor, henüz kesilmedi' },
  { key: 'Teklif Hazırlanıyor', label: 'Teklif Hazırlanıyor', emoji: '📄', color: '#8B5CF6', desc: 'Şirketten fiyat çalışılıyor' },
  { key: 'Şirkette Kesildi',    label: 'Şirkette Kesildi',    emoji: '🏢', color: '#3B82F6', desc: 'Şirket ekranından kesildi' },
  { key: 'Aktif',               label: 'Aktif',               emoji: '✅', color: '#10B981', desc: 'Yürürlükte — yenileme takibi yapılır' },
  { key: 'İptal',               label: 'İptal',               emoji: '⛔', color: '#F43F5E', desc: 'İptal edildi / vazgeçildi' },
];

export function policyStatusMeta(key: string | null | undefined) {
  const found = POLICY_STATUSES.find((s) => s.key === key);
  if (found) return found;
  if (key === 'Pasif')     return { key: 'Pasif' as StoredPolicyStatus,     label: 'Pasif',     emoji: '⚪', color: '#94A3B8', desc: 'Pasife alınmış (eski kayıt)' };
  if (key === 'Yenilendi') return { key: 'Yenilendi' as StoredPolicyStatus, label: 'Yenilendi', emoji: '🔄', color: '#14B8A6', desc: 'Yeni poliçeyle yenilendi' };
  return POLICY_STATUSES[3]; // bilinmeyen → Aktif görünümü (güvenli)
}

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Görünen durum: 'Süresi Doldu' yalnız burada doğar — asla DB'ye yazılmaz. */
export function effectivePolicyStatus(p: {
  status: string; end_date: string | null; renewal_status?: string | null;
}): { key: string; label: string; emoji: string; color: string } {
  if (p.renewal_status === 'completed' || p.status === 'Yenilendi') {
    return { key: 'Yenilendi', label: 'Yenilendi', emoji: '🔄', color: '#14B8A6' };
  }
  if (p.status === 'Aktif' && p.end_date && p.end_date < localToday()) {
    return { key: 'Süresi Doldu', label: 'Süresi Doldu', emoji: '⌛', color: '#EF4444' };
  }
  const m = policyStatusMeta(p.status);
  return { key: m.key, label: m.label, emoji: m.emoji, color: m.color };
}

/** Poliçenin oluşturulma kaynağı — API entegrasyonunda yalnız bu genişler. */
export function policySourceMeta(src: string | null | undefined): { label: string; icon: string } {
  if (src === 'ocr' || src === 'ocr_upload') return { label: 'PDF / OCR', icon: '🧠' };
  if (src === 'api') return { label: 'API', icon: '🔗' };
  return { label: 'Manuel Kayıt', icon: '📋' };
}
