/**
 * Poliçe durum & kaynak sözlüğü — TEK KAYNAK (Poliçe Yönetimi dönüşümü).
 * Mobil karşılığı: mobile/src/lib/policyStatus.ts (değerler DB sözleşmesidir, birebir aynı).
 *
 * Model:
 *  • Kayıtlı durumlar: Taslak → Teklif Hazırlanıyor → Şirkette Kesildi → Aktif → İptal
 *  • "Süresi Doldu" DB'de SAKLANMAZ — Aktif + end_date < bugün'den türetilir
 *    (effectivePolicyStatus). Böylece gece cron'una gerek kalmaz, veri yalan söylemez.
 *  • Legacy: 'Pasif' (eski kayıtlar — İptal gibi davranır), 'Yenilendi' (renewal akışı).
 *  • Yenileme motoru / dashboard / raporlar YALNIZ 'Aktif'i sayar — davranış değişmedi.
 */

export type StoredPolicyStatus =
  | "Taslak" | "Teklif Hazırlanıyor" | "Şirkette Kesildi" | "Aktif" | "İptal"
  | "Pasif" | "Yenilendi"; // legacy

/** Yeni kayıt/düzenlemede sunulan durumlar (legacy'ler listede yok). */
export const POLICY_STATUSES: { key: StoredPolicyStatus; label: string; emoji: string; badge: string; desc: string }[] = [
  { key: "Taslak",              label: "Taslak",              emoji: "📝", badge: "bg-slate-100 text-slate-600 border-slate-200",   desc: "Bilgiler giriliyor, henüz kesilmedi" },
  { key: "Teklif Hazırlanıyor", label: "Teklif Hazırlanıyor", emoji: "📄", badge: "bg-violet-100 text-violet-700 border-violet-200", desc: "Şirketten fiyat çalışılıyor" },
  { key: "Şirkette Kesildi",    label: "Şirkette Kesildi",    emoji: "🏢", badge: "bg-blue-100 text-blue-700 border-blue-200",     desc: "Şirket ekranından kesildi, kayıt tamamlanıyor" },
  { key: "Aktif",               label: "Aktif",               emoji: "✅", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", desc: "Yürürlükte — yenileme takibi yapılır" },
  { key: "İptal",               label: "İptal",               emoji: "⛔", badge: "bg-rose-100 text-rose-700 border-rose-200",     desc: "İptal edildi / vazgeçildi" },
];

/** Aktif öncesi hazırlık durumları (raporlarda "hazırlıkta" sayılır). */
export const PRE_ACTIVE_STATUSES: StoredPolicyStatus[] = ["Taslak", "Teklif Hazırlanıyor", "Şirkette Kesildi"];
export const CLOSED_STATUSES: StoredPolicyStatus[] = ["İptal", "Pasif"];

export function policyStatusMeta(key: string | null | undefined) {
  const found = POLICY_STATUSES.find((s) => s.key === key);
  if (found) return found;
  if (key === "Pasif")     return { key: "Pasif" as StoredPolicyStatus,     label: "Pasif",     emoji: "⚪", badge: "bg-gray-100 text-gray-500 border-gray-200",   desc: "Pasife alınmış (eski kayıt)" };
  if (key === "Yenilendi") return { key: "Yenilendi" as StoredPolicyStatus, label: "Yenilendi", emoji: "🔄", badge: "bg-teal-100 text-teal-700 border-teal-200",   desc: "Yeni poliçeyle yenilendi" };
  return POLICY_STATUSES[3]; // bilinmeyen → Aktif görünümü (güvenli)
}

/**
 * Görünen durum: DB durumu + bitiş tarihinden türetilir.
 * 'Süresi Doldu' yalnız burada doğar — asla DB'ye yazılmaz.
 */
export function effectivePolicyStatus(p: {
  status: string; end_date: string; renewal_status?: string | null;
}): { key: string; label: string; emoji: string; badge: string } {
  if (p.renewal_status === "completed" || p.status === "Yenilendi") {
    return { key: "Yenilendi", label: "Yenilendi", emoji: "🔄", badge: "bg-teal-100 text-teal-700 border-teal-200" };
  }
  if (p.status === "Aktif" && p.end_date < new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
    return { key: "Süresi Doldu", label: "Süresi Doldu", emoji: "⌛", badge: "bg-red-100 text-red-700 border-red-200" };
  }
  const m = policyStatusMeta(p.status);
  return { key: m.key, label: m.label, emoji: m.emoji, badge: m.badge };
}

/** Poliçenin oluşturulma kaynağı — API entegrasyonu geldiğinde yalnız bu genişler. */
export const POLICY_SOURCES: Record<string, { label: string; icon: string; badge: string }> = {
  manual: { label: "Manuel Kayıt", icon: "📋", badge: "bg-blue-100 text-blue-700 border-blue-300" },
  ocr:    { label: "PDF / OCR",    icon: "🧠", badge: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  api:    { label: "API",          icon: "🔗", badge: "bg-violet-100 text-violet-700 border-violet-300" },
};

export function policySourceMeta(src: string | null | undefined) {
  return POLICY_SOURCES[src ?? "manual"]
    ?? (src === "ocr_upload" ? POLICY_SOURCES.ocr : POLICY_SOURCES.manual);
}
