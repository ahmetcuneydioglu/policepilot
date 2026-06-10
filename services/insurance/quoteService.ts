/**
 * PolicePilot — Quote Service
 *
 * Teklif verilerini poliçeleştirme akışı için hazırlar.
 * İleride: InsurGateway / şirket API entegrasyonları bu katmandan geçecek.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface QuoteResultDetail {
  id:              string;
  quote_run_id:    string;
  company_name:    string;
  company_code:    string | null;
  price:           number;
  installment:     string | null;
  note:            string | null;
  status:          string;
  source_type:     string | null;
  provider_name:   string | null;
  can_issue_policy: boolean;
  expires_at:      string | null;
  payment_status:  string;
  policy_status:   string;
}

export interface QuoteRunDetail {
  id:             string;
  agency_id:      string;
  customer_id:    string | null;
  customer_name:  string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_tc:    string | null;
  product_type:   string;
  product_data:   Record<string, string>;
  provider_type:  string | null;
  renewal_of_policy_id?: string | null; // yenileme akışından açıldıysa kaynak poliçe
}

export interface QuoteIssueContext {
  result: QuoteResultDetail;
  run:    QuoteRunDetail;
}

// ─── Company code mapping ─────────────────────────────────────────────────────
const COMPANY_CODE_MAP: Record<string, string> = {
  "Allianz Sigorta":   "ALZ",
  "AXA Sigorta":       "AXA",
  "Anadolu Sigorta":   "AND",
  "HDI Sigorta":       "HDI",
  "Mapfre Sigorta":    "MAP",
  "Sompo Sigorta":     "SMP",
  "Ray Sigorta":       "RAY",
  "Neova Sigorta":     "NEO",
  "Türkiye Sigorta":   "TSG",
  "Aksigorta":         "AKS",
  "Zurich Sigorta":    "ZUR",
  "Quick Sigorta":     "QCK",
  "Ergo Sigorta":      "ERG",
  "Groupama Sigorta":  "GRP",
  "Güneş Sigorta":     "GNS",
  "Unico Sigorta":     "UNC",
  "Acıbadem Sigorta":  "ACB",
  "Cigna Sigorta":     "CGN",
};

export function getCompanyCode(companyName: string): string {
  return COMPANY_CODE_MAP[companyName] ?? companyName.slice(0, 3).toUpperCase();
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Poliçeleştirme sayfası için teklif bağlamını çeker.
 * quote_result_id verilir; ilgili quote_run ile birlikte döner.
 */
export async function getQuoteIssueContext(quoteResultId: string): Promise<QuoteIssueContext | null> {
  const admin = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error: rErr } = await (admin.from("quote_results") as any)
    .select("*")
    .eq("id", quoteResultId)
    .maybeSingle();

  if (rErr || !result) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: run, error: runErr } = await (admin.from("quote_runs") as any)
    .select("*")
    .eq("id", result.quote_run_id)
    .maybeSingle();

  if (runErr || !run) return null;

  return {
    result: {
      id:               result.id,
      quote_run_id:     result.quote_run_id,
      company_name:     result.company_name,
      company_code:     result.company_code ?? getCompanyCode(result.company_name),
      price:            result.price,
      installment:      result.installment,
      note:             result.note,
      status:           result.status,
      source_type:      result.source_type,
      provider_name:    result.provider_name,
      can_issue_policy: result.can_issue_policy ?? false,
      expires_at:       result.expires_at,
      payment_status:   result.payment_status ?? "pending",
      policy_status:    result.policy_status  ?? "pending",
    },
    run: {
      id:             run.id,
      agency_id:      run.agency_id,
      customer_id:    run.customer_id,
      customer_name:  run.customer_name,
      customer_phone: run.customer_phone,
      customer_email: run.customer_email,
      customer_tc:    run.customer_tc,
      product_type:   run.product_type,
      product_data:   run.product_data ?? {},
      provider_type:  run.provider_type,
    },
  };
}

/**
 * Teklifin zaten poliçeye dönüştürülüp dönüştürülmediğini kontrol eder.
 */
export async function checkIfAlreadyIssued(quoteResultId: string): Promise<{
  issued: boolean;
  policyId?: string;
  policyNo?: string;
}> {
  const admin = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("policies") as any)
    .select("id, policy_no")
    .eq("quote_result_id", quoteResultId)
    .maybeSingle();

  if (data) return { issued: true, policyId: data.id, policyNo: data.policy_no };
  return { issued: false };
}
