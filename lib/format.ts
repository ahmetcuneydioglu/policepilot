/**
 * Para/tarih biçimlendirme — TEK kaynak.
 * Önceden admin/ui.tsx ve customer/types.ts'te yakın-aynı iki kopya vardı (drift riski).
 */

/** 1234 → "1.234 ₺" (TRY, tam sayıya yuvarlar). null → "—". */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
}

/** ISO → "18 Haz 2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/** ISO → "18 Haz 2026 14:30". */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
