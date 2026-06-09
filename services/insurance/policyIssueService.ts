/**
 * PolicePilot — Policy Issue Service
 *
 * Ödeme onaylandıktan sonra poliçe kaydını oluşturur.
 * Poliçe numarası: <şirket_kodu>-<yıl>-<random6haneli>
 *
 * İleride: şirket API entegrasyonu bu servisten geçecek.
 */

import { getSupabaseAdmin }    from "@/lib/supabase-admin";
import type { PaymentResult }  from "@/services/payment/paymentService";
import type { QuoteIssueContext } from "@/services/insurance/quoteService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssuePolicyInput {
  context:        QuoteIssueContext;
  paymentResult:  PaymentResult;
  agentUserId:    string;  // Poliçeyi kesen kullanıcı ID'si (audit log)
}

export interface IssuePolicyResult {
  policyId:   string;
  policyNo:   string;
  issuedAt:   string;
}

// ─── Policy number generation ─────────────────────────────────────────────────

function generatePolicyNo(companyCode: string): string {
  const year = new Date().getFullYear();
  const seq  = Math.floor(100_000 + Math.random() * 900_000); // 6 haneli
  return `${companyCode}-${year}-${seq}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * 1. policies tablosuna yeni satır ekler
 * 2. quote_results.policy_status → "issued"
 * 3. quote_results.payment_status → "paid"
 * 4. Oluşturulan poliçe bilgisini döndürür
 *
 * ⚠️  Kart bilgisi (kart no, CVV, son kullanma tarihi) ASLA buraya taşınmaz.
 *     Sadece paymentResult.transactionId kaydedilir.
 */
export async function issuePolicy(input: IssuePolicyInput): Promise<IssuePolicyResult> {
  const { context, paymentResult, agentUserId } = input;
  const { result, run }                          = context;

  const admin      = getSupabaseAdmin();
  const policyNo   = generatePolicyNo(result.company_code ?? "POL");
  const issuedAt   = new Date().toISOString();

  // ── 1. policies tablosuna yaz ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: policy, error: polErr } = await (admin.from("policies") as any)
    .insert({
      agency_id:       run.agency_id,
      customer_id:     run.customer_id ?? null,
      customer_name:   run.customer_name ?? null,
      customer_phone:  run.customer_phone ?? null,
      policy_no:       policyNo,
      insurance_type:  run.product_type,
      company:         result.company_name,
      premium:         result.price,
      status:          "Aktif",
      // Teklif & ödeme referansları
      quote_result_id: result.id,
      quote_run_id:    run.id,
      transaction_id:  paymentResult.transactionId,  // ✅ Sadece işlem ID'si
      payment_method:  paymentResult.method,
      issued_at:       issuedAt,
      source:          "quote_flow",
      // Genel alanlar
      notes:           `Teklif akışından kesildi. İşlem: ${paymentResult.transactionId}`,
      agent_id:        agentUserId,
    })
    .select("id")
    .single();

  if (polErr) {
    console.error("[policyIssueService] policy insert error:", polErr);
    throw new Error(`Poliçe kaydı oluşturulamadı: ${polErr.message}`);
  }

  // ── 2. quote_results güncelle ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (admin.from("quote_results") as any)
    .update({
      policy_status:  "issued",
      payment_status: "paid",
    })
    .eq("id", result.id);

  if (updErr) {
    console.warn("[policyIssueService] quote_result update warning:", updErr.message);
    // Poliçe kaydı başarılı, güncelleme hatası kritik değil — devam et
  }

  return {
    policyId:  policy.id,
    policyNo,
    issuedAt,
  };
}
