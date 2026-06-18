/**
 * TR telefon yardımcıları — TEK kaynak.
 * Önceden normalizePhone 4 yerde kopyalanmıştı (biri diğerinden farklı → divergence
 * bug riski). Burada birleştirildi.
 */

/** 0532… → 90532…, 532… → 90532…, 90532… → 90532… (E.164-benzeri, + olmadan). */
export function normalizePhone(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 11) return "9" + d;
  if (d.length === 10) return "90" + d;
  return d;
}

/** Geçerli TR cep numarası mı? (905XXXXXXXXX = 90 + 5xx + 7 hane) */
export function isValidTrMobile(raw: string): boolean {
  return /^905[0-9]{9}$/.test(normalizePhone(raw));
}
