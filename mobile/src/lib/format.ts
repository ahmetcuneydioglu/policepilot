/**
 * src/lib/format.ts — Para/sayı biçimlendirme yardımcıları (TR)
 */

/** ₺142.000 — tam, ondalıksız, binlik ayraçlı */
export function formatTRY(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `₺${Math.round(v).toLocaleString('tr-TR')}`;
}

/** ₺96B / ₺1,2M — kısa gösterim (kartlar için) */
export function formatShortTRY(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000) {
    return `₺${(v / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(v) >= 1_000) {
    return `₺${(v / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}B`;
  }
  return `₺${Math.round(v).toLocaleString('tr-TR')}`;
}

/** "20 Haziran Cuma" gibi uzun Türkçe tarih */
export function formatLongDateTR(d: Date = new Date()): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

/** Saate göre selamlama */
export function greetingTR(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
