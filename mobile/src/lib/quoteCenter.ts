/**
 * src/lib/quoteCenter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Teklif Merkezi API katmanı — web /api/quote-runs + /api/policy-issue köprüsü
 * (bearer, zaten canlı). Demo motoru client-side (quoteDemo) çalışır, sonuçlar
 * burada POST edilip kalıcılaşır. Web mimarisiyle birebir.
 */

import { apiGet, apiPost, apiPatch } from './api';
import { runQuoteDemo } from './quoteDemo';
import { Colors } from './theme';

export type QuoteRun = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_tc: string | null;
  product_type: string;
  status: string;
  won_result_id: string | null;
  provider_type: string;
  success_count: number;
  error_count: number;
  renewal_of_policy_id: string | null;
  created_at: string;
  quote_results?: { id: string; price: number | null }[];
};

export type QuoteResult = {
  id: string;
  quote_run_id: string;
  company_name: string;
  company_code: string | null;
  price: number | null;
  installment: string | null;
  status: string;
  source_type: string | null;
  provider_name: string | null;
  error_source: string | null;
  error_code: string | null;
  error_message: string | null;
  action_hint: string | null;
};

export const RUN_STATUSES = ['Yeni', 'Teklif Verildi', 'Müşteri Düşünüyor', 'Kazanıldı', 'Kaybedildi', 'İptal'];

export function runStatusMeta(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'Kazanıldı': return { bg: Colors.successBg, fg: Colors.success };
    case 'Kaybedildi':
    case 'İptal': return { bg: Colors.dangerBg, fg: Colors.danger };
    case 'Teklif Verildi': return { bg: '#F5F3FF', fg: '#6D28D9' };
    case 'Müşteri Düşünüyor': return { bg: Colors.amberBg, fg: '#B45309' };
    default: return { bg: Colors.infoBg, fg: Colors.primary }; // Yeni
  }
}

export function isSuccessResult(r: QuoteResult): boolean {
  return r.status === 'success' || r.status === 'Aktif' || r.status === 'Seçildi';
}
export function isErrorResult(r: QuoteResult): boolean {
  return r.status === 'company_error' || r.status === 'sbm_error' || r.status === 'timeout';
}
export function resultStatusLabel(r: QuoteResult): { label: string; bg: string; fg: string } {
  if (isSuccessResult(r)) return { label: 'Teklif', bg: Colors.successBg, fg: Colors.success };
  if (r.status === 'no_offer' || r.status === 'Teklif Yok') return { label: 'Teklif Yok', bg: Colors.surface, fg: Colors.secondary };
  if (r.status === 'sbm_error') return { label: 'SBM Hatası', bg: Colors.amberBg, fg: '#B45309' };
  if (r.status === 'timeout') return { label: 'Zaman Aşımı', bg: Colors.amberBg, fg: '#B45309' };
  if (r.status === 'company_error') return { label: 'Şirket Hatası', bg: Colors.dangerBg, fg: Colors.danger };
  return { label: r.status, bg: Colors.surface, fg: Colors.secondary };
}

/** Başarılı sonuçların en düşük fiyatı (best price). */
export function bestPrice(results: { price: number | null; status?: string }[]): number | null {
  const prices = results.filter((r) => r.price != null).map((r) => Number(r.price));
  return prices.length ? Math.min(...prices) : null;
}

export async function listQuoteRuns(): Promise<QuoteRun[]> {
  const res = await apiGet<{ runs: QuoteRun[] }>('/api/quote-runs');
  return res.runs ?? [];
}

export async function getQuoteRun(id: string): Promise<{ run: QuoteRun; results: QuoteResult[] }> {
  return apiGet<{ run: QuoteRun; results: QuoteResult[] }>(`/api/quote-runs/${id}`);
}

export type StartQuoteParams = {
  customerId?: string | null;
  createCustomer: boolean;
  name: string;
  phone: string;
  tc?: string;
  plaka?: string;
  productType: string;
  renewalPolicyId?: string | null;
};

/** Demo motorunu çalıştır + /api/quote-runs'a POST et → runId döndür. */
export async function startQuoteRun(p: StartQuoteParams): Promise<string> {
  const seed = (p.tc || p.plaka || p.name || 'seed').trim();
  const results = runQuoteDemo(p.productType, seed);
  const success_count = results.filter((r) => r.status === 'success').length;
  const error_count = results.filter((r) => ['company_error', 'sbm_error', 'timeout'].includes(r.status)).length;

  const productData: Record<string, string> = {};
  if (p.plaka) productData.plaka = p.plaka.toUpperCase();

  const body = {
    customer_id: p.customerId ?? null,
    create_customer: p.createCustomer,
    customer_name: p.name,
    customer_phone: p.phone,
    customer_tc: p.tc ?? '',
    product_type: p.productType,
    product_data: productData,
    provider_type: 'demo',
    success_count,
    error_count,
    renewal_of_policy_id: p.renewalPolicyId ?? null,
    results,
  };
  const res = await apiPost<{ ok: boolean; runId: string }>('/api/quote-runs', body);
  return res.runId;
}

export async function updateRunStatus(id: string, status: string, wonResultId?: string | null): Promise<void> {
  await apiPatch(`/api/quote-runs/${id}`, { status, won_result_id: wonResultId ?? null });
}

/** quote_result → poliçe kes (demo ödeme). */
export async function issuePolicyFromResult(resultId: string, amount: number, description: string): Promise<{ policyNo: string }> {
  const res = await apiPost<{ ok: boolean; policyId: string; policyNo: string }>(`/api/policy-issue/${resultId}`, { amount, description });
  return { policyNo: res.policyNo };
}
