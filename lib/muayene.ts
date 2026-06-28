/**
 * lib/muayene.ts — Araç muayene (TÜVTÜRK) bitiş tarihi hesabı.
 *
 * İlk tescil tarihinden, kullanım tarzına göre BİR SONRAKİ muayene tarihini
 * (bugünden ≥) üretir. Poliçeden çıkarılan tescil tarihiyle Faz 2 otomatik hesap.
 *
 * Kurallar (TÜVTÜRK — resmî):
 *   • Hususi (binek) otomobil + motosiklet: 2 yılda bir. Sıfır araç ilk 3 yıl muaf
 *     → ilk muayene tescil + 3 yıl, sonra her 2 yıl. (varsayılan)
 *   • Ticari (kamyon/kamyonet/taksi/otobüs/minibüs…): yıllık. Sıfır araç ilk 1 yıl muaf
 *     → ilk muayene tescil + 1 yıl, sonra her yıl.
 * Belirsizse hususi (otomobil) kuralı uygulanır; acente müşteri detayından düzeltebilir.
 */

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addYears(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/** Kullanım tarzı ticari mi? (yıllık muayene) */
export function isCommercialUsage(usage: string | null | undefined): boolean {
  const u = (usage ?? "").toLocaleLowerCase("tr-TR");
  if (!u) return false;
  return /(ticari|kamyon|kamyonet|otob|minib|midib|taksi|dolmu|kiral|çekici|cekici|tır|servis|nakliye|panelvan|pickup|kapal[ıi] kasa)/.test(u);
}

/**
 * İlk tescil tarihinden bir sonraki muayene tarihini (bugünden ≥) döndürür.
 * Geçersiz tarih → null.
 * @param firstRegISO  İlk tescil tarihi (YYYY-MM-DD)
 * @param usageType    Kullanım tarzı (Hususi|Ticari…) — ticarisi yıllık
 * @param today        (test için) referans gün
 */
export function computeMuayeneBitis(
  firstRegISO: string | null | undefined,
  usageType?: string | null,
  today: Date = new Date()
): string | null {
  if (!firstRegISO || !validIsoDate(firstRegISO)) return null;
  const todayISO = today.toISOString().slice(0, 10);

  const commercial = isCommercialUsage(usageType);
  const firstOffset = commercial ? 1 : 3; // ilk muayeneye kadar yıl
  const cycle = commercial ? 1 : 2;       // sonraki periyot (yıl)

  let next = addYears(firstRegISO, firstOffset);
  // Geçmişte kaldıysa bir sonraki periyoda ilerle (en fazla ~60 iterasyon güvenlik)
  let guard = 0;
  while (next < todayISO && guard < 80) {
    next = addYears(next, cycle);
    guard++;
  }
  return next;
}
