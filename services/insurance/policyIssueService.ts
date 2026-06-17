/**
 * SigortaOS — Policy Issue Service
 *
 * Poliçe kaydını oluşturur. Kaynak türüne göre farklı davranır:
 *
 *  source_type = "demo"    → DEMO-YYYYMMDD-XXXX no, gerçek ödeme yok
 *  source_type = "manual"  → MAN-{şirket}-YYYYMMDD-XXXX, manuel kayıt
 *  source_type = "api" / "gateway" / "robot" → {şirket}-{yıl}-XXXXXX (gerçek entegrasyon)
 *
 * ⚠️  Kart bilgisi ASLA buraya taşınmaz. Sadece transactionId kaydedilir.
 */

import { getSupabaseAdmin }       from "@/lib/supabase-admin";
import { logActivity }            from "@/lib/activity";
import type { PaymentResult }     from "@/services/payment/paymentService";
import type { QuoteIssueContext } from "@/services/insurance/quoteService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssuePolicyInput {
  context:      QuoteIssueContext;
  paymentResult: PaymentResult;
  agentUserId:  string;    // Audit log için
  sourceType:   string;    // "demo" | "manual" | "api" | "gateway" | "robot"
}

export interface IssuePolicyResult {
  policyId:   string;
  policyNo:   string;
  issuedAt:   string;
  startDate:  string;     // ISO 8601 — poliçe başlangıç tarihi
  endDate:    string;     // ISO 8601 — poliçe bitiş tarihi (1 yıl)
  isDemo:     boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function datePart(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function rand4(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

/**
 * Kaynak türüne göre poliçe numarası üretir.
 *
 * demo    → DEMO-20250609-A3F2
 * manual  → MAN-ALZ-20250609-A3F2
 * api/…   → ALZ-2025-123456
 */
function generatePolicyNo(sourceType: string, companyCode: string): string {
  const dp = datePart();

  if (sourceType === "demo") {
    return `DEMO-${dp}-${rand4()}`;
  }
  if (sourceType === "manual") {
    return `MAN-${companyCode}-${dp}-${rand4()}`;
  }
  // api / gateway / robot → gerçek format
  const year = new Date().getFullYear();
  const seq  = Math.floor(100_000 + Math.random() * 900_000);
  return `${companyCode}-${year}-${seq}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * 1. policies tablosuna yeni satır ekler
 * 2. quote_results.policy_status → "issued", payment_status → "paid"
 * 3. quote_runs.status → "Kazanıldı", won_result_id → result.id
 *
 * ⚠️  Kart no / CVV / SKT ASLA işlenmez. Sadece paymentResult.transactionId saklanır.
 */
export async function issuePolicy(input: IssuePolicyInput): Promise<IssuePolicyResult> {
  const { context, paymentResult, agentUserId, sourceType } = input;
  const { result, run } = context;

  const admin      = getSupabaseAdmin();
  const isDemo     = sourceType === "demo";
  const policyNo   = generatePolicyNo(sourceType, result.company_code ?? "POL");
  const issuedAt   = new Date().toISOString();

  // Poliçe geçerlilik süresi: 1 yıl
  const startDate  = new Date();
  const endDate    = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  // ── 1. policies tablosuna yaz ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: policy, error: polErr } = await (admin.from("policies") as any)
    .insert({
      agency_id:         run.agency_id,
      customer_id:       run.customer_id ?? null,
      policy_no:         policyNo,
      policy_type:       run.product_type,
      insurance_company: result.company_name,
      premium:           result.price,
      status:            "Aktif",
      start_date:        startDate.toISOString().slice(0, 10),
      end_date:          endDate.toISOString().slice(0, 10),
      // Teklif & ödeme referansları
      quote_result_id: result.id,
      quote_run_id:    run.id,
      transaction_id:  paymentResult.transactionId, // ✅ Sadece işlem ID'si
      payment_method:  paymentResult.method,
      issued_at:       issuedAt,
      source:          sourceType,   // "demo" | "manual" | "api" | …
      // Yenileme ilişkisi: bu poliçe eski bir poliçenin yenilemesi mi?
      renewed_from_policy_id: run.renewal_of_policy_id ?? null,
      // Kişi bazlı performans/audit izi
      created_by: agentUserId,
      // Notlar
      note: isDemo
        ? `Demo poliçe. Gerçek poliçe değildir. İşlem: ${paymentResult.transactionId}`
        : `Teklif akışından kesildi. İşlem: ${paymentResult.transactionId}`,
    })
    .select("id")
    .single();

  if (polErr) {
    console.error("[policyIssueService] policy insert error:", polErr);
    throw new Error(`Poliçe kaydı oluşturulamadı: ${polErr.message}`);
  }

  await logActivity({
    agencyId: run.agency_id, actorId: agentUserId,
    action: "create", entityType: "policy", entityId: policy.id,
    summary: `Poliçe kesildi: ${policyNo} (${result.company_name})`,
    metadata: { source: sourceType, premium: result.price },
  });

  // ── 2. quote_results güncelle ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: resUpdErr } = await (admin.from("quote_results") as any)
    .update({ policy_status: "issued", payment_status: "paid" })
    .eq("id", result.id);

  if (resUpdErr) {
    console.warn("[policyIssueService] quote_result update warning:", resUpdErr.message);
  }

  // ── 3. quote_run → Kazanıldı + won_result_id ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: runUpdErr } = await (admin.from("quote_runs") as any)
    .update({ status: "Kazanıldı", won_result_id: result.id })
    .eq("id", run.id);

  if (runUpdErr) {
    console.warn("[policyIssueService] quote_run status update warning:", runUpdErr.message);
  }

  // ── 4. Yenileme akışı: eski poliçeyi kapat ────────────────────────────────
  // renewal_status=completed → Yenilemeler listesinden düşer
  // status=Yenilendi         → Poliçeler ekranında "✅ Yenilendi" rozeti
  if (run.renewal_of_policy_id) {
    // Kritik alan önce: renewal_status=completed → Yenilemeler listesinden düşer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: renewErr } = await (admin.from("policies") as any)
      .update({ renewal_status: "completed", renewed_at: issuedAt })
      .eq("id", run.renewal_of_policy_id);

    if (renewErr) {
      // Yenileme kapanışı poliçe kesimini engellememeli; ama sessizce de yutulmamalı
      console.error("[policyIssueService] renewal completion FAILED:", renewErr.message);
    }

    // status=Yenilendi ayrı update: check constraint migration'ı çalıştırılmadıysa
    // bu adım başarısız olsa bile completed işareti korunur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: statusErr } = await (admin.from("policies") as any)
      .update({ status: "Yenilendi" })
      .eq("id", run.renewal_of_policy_id);

    if (statusErr) {
      console.error(
        "[policyIssueService] old policy status update FAILED (renewal_completion_fix_migration.sql çalıştırıldı mı?):",
        statusErr.message
      );
    }
  }

  return {
    policyId:  policy.id,
    policyNo,
    issuedAt,
    startDate: startDate.toISOString(),
    endDate:   endDate.toISOString(),
    isDemo,
  };
}
