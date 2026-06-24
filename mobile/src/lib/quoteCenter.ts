/**
 * src/lib/quoteCenter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Teklif Merkezi API katmanı — web /api/quote-runs + /api/policy-issue köprüsü
 * (bearer, zaten canlı). Demo motoru client-side (quoteDemo) çalışır, sonuçlar
 * burada POST edilip kalıcılaşır. Web mimarisiyle birebir.
 */

import { apiGet, apiPost, apiPatch } from './api';
import { runQuoteDemo } from './quoteDemo';
import { groupOf } from './quoteFields';
import { Colors } from './theme';

export type QuoteRun = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_tc: string | null;
  customer_email?: string | null;
  product_type: string;
  product_data?: Record<string, string> | null;
  notes?: string | null;
  status: string;
  won_result_id: string | null;
  provider_type: string;
  success_count: number;
  error_count: number;
  renewal_of_policy_id: string | null;
  run_started_at?: string | null;
  run_finished_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  quote_results?: { id: string; price: number | null }[];
};

/** Ürün tipi → ikon + renk (web'deki ikon/renk kodlamasıyla uyumlu). */
export function productMeta(type: string): { emoji: string; bg: string; fg: string } {
  const veh = { bg: '#E6F1FB', fg: '#185FA5' };
  const prop = { bg: '#FAEEDA', fg: '#854F0B' };
  const health = { bg: '#FBEAF0', fg: '#993556' };
  const travel = { bg: '#E1F5EE', fg: '#0F6E56' };
  switch (type) {
    case 'Trafik': return { emoji: '🚗', ...veh };
    case 'Kasko': return { emoji: '🚙', ...veh };
    case 'İMM': return { emoji: '🛡️', ...veh };
    case 'DASK': return { emoji: '🏠', ...prop };
    case 'Konut': return { emoji: '🏡', ...prop };
    case 'TSS': return { emoji: '❤️', ...health };
    case 'Ferdi Kaza': return { emoji: '🩹', ...health };
    case 'Özel Sağlık': return { emoji: '⚕️', ...health };
    case 'Seyahat': return { emoji: '✈️', ...travel };
    default: return { emoji: '📄', bg: Colors.surface, fg: Colors.secondary };
  }
}

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
  email?: string;
  plaka?: string;
  productType: string;
  productData?: Record<string, string>;
  notes?: string;
  renewalPolicyId?: string | null;
};

/** Demo motorunu çalıştır + /api/quote-runs'a POST et → runId döndür. */
export async function startQuoteRun(p: StartQuoteParams): Promise<string> {
  const productData: Record<string, string> = { ...(p.productData ?? {}), group: groupOf(p.productType) };
  if (p.plaka && !productData.plaka) productData.plaka = p.plaka.toUpperCase();

  const seed = (p.tc || productData.plaka || p.name || 'seed').trim();
  const results = runQuoteDemo(p.productType, seed);
  const success_count = results.filter((r) => r.status === 'success').length;
  const error_count = results.filter((r) => ['company_error', 'sbm_error', 'timeout'].includes(r.status)).length;

  const body = {
    customer_id: p.customerId ?? null,
    create_customer: p.createCustomer,
    customer_name: p.name,
    customer_phone: p.phone,
    customer_tc: p.tc ?? '',
    customer_email: p.email ?? '',
    product_type: p.productType,
    product_data: productData,
    notes: p.notes ?? '',
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

/** quote_result → poliçe kes (demo ödeme). Kart bilgisi GÖNDERİLMEZ — yalnız amount+description. */
export async function issuePolicyFromResult(resultId: string, amount: number, description: string): Promise<{ policyNo: string }> {
  const res = await apiPost<{ ok: boolean; policyId: string; policyNo: string }>(`/api/policy-issue/${resultId}`, { amount, description });
  return { policyNo: res.policyNo };
}

export type IssueContext = {
  context: {
    result: { id: string; company_name: string; price: number | null; installment: string | null; expires_at?: string | null; source_type?: string | null };
    run: {
      product_type: string;
      product_data?: Record<string, string> | null;
      customer_id?: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      customer_email?: string | null;
      customer_tc: string | null;
    };
  };
  alreadyIssued: { issued: boolean; policyNo?: string | null };
  isDemo: boolean;
  isManual: boolean;
  sourceType: string;
};

/** Poliçeleştirme ödeme ekranı için teklif bağlamını çek (GET /api/policy-issue/[id]). */
export async function getIssueContext(resultId: string): Promise<IssueContext> {
  return apiGet<IssueContext>(`/api/policy-issue/${resultId}`);
}
