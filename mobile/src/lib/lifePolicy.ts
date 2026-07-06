/**
 * Hayat Sigortası — tipler, sabitler ve prim takvimi yardımcıları.
 * Veri modeli: policies satırı (policy_type='Hayat Sigortası') + policies.details (jsonb)
 * + policy_payments (prim takvimi, satır bazlı Ödendi takibi).
 * Aktüeryal alan YOK — acentenin günlük kullandığı operasyon alanları.
 */

import { supabase } from './supabase';

// ── details (jsonb) sözleşmesi ────────────────────────────────────────────────
export type LifeBeneficiary = {
  name: string;
  relation: string;
  share: number | null;   // pay oranı (%)
  phone: string | null;
};

export type LifeDetails = {
  kind: 'life';
  product_name: string | null;      // ör. "Birikimli Hayat Plus"
  policyholder: string | null;      // sigorta ettiren
  insured: string | null;           // sigortalı
  insured_relation: string | null;  // sigortalının ettirene yakınlığı
  currency: string;                 // TRY | USD | EUR
  payment_period: string;           // monthly | quarterly | semiannual | annual
  coverages: string[];              // teminat adları (serbest liste)
  beneficiaries: LifeBeneficiary[];
};

export type PolicyPayment = {
  id: string;
  agency_id: string;
  policy_id: string;
  seq: number;
  due_date: string;
  amount: number | null;
  currency: string;
  paid_at: string | null;
};

export type PaymentStatus = 'paid' | 'overdue' | 'pending';

// ── Sabitler ──────────────────────────────────────────────────────────────────
export const LIFE_POLICY_TYPE = 'Hayat Sigortası';

export const COVERAGE_PRESETS = [
  'Vefat Teminatı',
  'Kritik Hastalık',
  'Kalıcı Maluliyet',
  'Kaza Sonucu Vefat',
  'Hastane Teminatı',
] as const;

export const PAYMENT_PERIODS = [
  { key: 'monthly',    label: 'Aylık',   months: 1 },
  { key: 'quarterly',  label: '3 Aylık', months: 3 },
  { key: 'semiannual', label: '6 Aylık', months: 6 },
  { key: 'annual',     label: 'Yıllık',  months: 12 },
] as const;

export const CURRENCIES = [
  { key: 'TRY', label: '₺ TL' },
  { key: 'USD', label: '$ USD' },
  { key: 'EUR', label: '€ EUR' },
] as const;

export const RELATIONS = ['Kendisi', 'Eş', 'Çocuk', 'Anne', 'Baba', 'Kardeş', 'Diğer'] as const;

/** "1.500,50" / "1500.50" / "1500,5" → 1500.5 (binlik ayraç güvenli). */
export function parseAmount(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

export function currencySymbol(c: string) {
  return c === 'USD' ? '$' : c === 'EUR' ? '€' : '₺';
}
export function periodLabel(key: string | null) {
  return PAYMENT_PERIODS.find((p) => p.key === key)?.label ?? key ?? '';
}

// ── Prim takvimi ──────────────────────────────────────────────────────────────
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(y, m - 1 + months, 1);
  // Ay sonu taşmasını önle (31 Oca + 1 ay → 28/29 Şub)
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/** Başlangıç→bitiş arası ödeme takvimi (ilk ödeme = başlangıç günü). Güvenlik tavanı 360 taksit (30 yıl aylık). */
export function generateSchedule(startISO: string, endISO: string, periodKey: string): string[] {
  const months = PAYMENT_PERIODS.find((p) => p.key === periodKey)?.months ?? 12;
  const dates: string[] = [];
  let cur = startISO;
  while (cur < endISO && dates.length < 360) {
    dates.push(cur);
    cur = addMonths(startISO, months * (dates.length));
  }
  return dates.length ? dates : [startISO];
}

/** Ödeme durumu: paid_at varsa ödendi; vadesi geçtiyse gecikti; değilse bekliyor. */
export function paymentStatus(p: Pick<PolicyPayment, 'paid_at' | 'due_date'>, todayISO?: string): PaymentStatus {
  if (p.paid_at) return 'paid';
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = todayISO ?? localToday;
  return p.due_date < today ? 'overdue' : 'pending';
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; icon: string }> = {
  paid:    { label: 'Ödendi',    icon: '✓' },
  pending: { label: 'Bekliyor',  icon: '•' },
  overdue: { label: 'Gecikti',   icon: '!' },
};

// ── Veri erişimi ──────────────────────────────────────────────────────────────
export async function fetchPayments(policyId: string): Promise<PolicyPayment[]> {
  const { data } = await (supabase.from('policy_payments') as any)
    .select('*')
    .eq('policy_id', policyId)
    .order('seq', { ascending: true });
  return (data ?? []) as PolicyPayment[];
}

export async function setPaymentPaid(paymentId: string, paid: boolean): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('policy_payments') as any)
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', paymentId);
  return { error: error ? error.message : null };
}

export async function insertSchedule(
  agencyId: string,
  policyId: string,
  dates: string[],
  amount: number | null,
  currency: string
): Promise<{ error: string | null }> {
  const rows = dates.map((d, i) => ({
    agency_id: agencyId,
    policy_id: policyId,
    seq: i + 1,
    due_date: d,
    amount,
    currency,
  }));
  const { error } = await (supabase.from('policy_payments') as any).insert(rows);
  return { error: error ? error.message : null };
}
