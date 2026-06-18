/**
 * GET  /api/policy-issue/[quote_result_id]  — teklif bağlamını döndür
 * POST /api/policy-issue/[quote_result_id]  — poliçeyi kes (demo/manual/api)
 *
 * Kaynak tipi mantığı:
 *  demo    → can_issue_policy kontrolü yok, ödeme simülasyonu yok
 *  manual  → can_issue_policy kontrolü yok, ödeme simülasyonu yok
 *  api / gateway / robot → gerçek API entegrasyonu (ileride)
 *
 * ⚠️  Kart bilgileri (no, CVV, SKT) bu route'a GELMEMELİ.
 *     POST body'de yalnızca amount + description.
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getQuoteIssueContext, checkIfAlreadyIssued } from "@/services/insurance/quoteService";
import { processMockPayment }  from "@/services/payment/paymentService";
import { issuePolicy }         from "@/services/insurance/policyIssueService";
import type { PaymentResult }  from "@/services/payment/paymentService";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function getSessionClient(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieHeader.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll() {},
      },
    }
  );
}

// ─── Source type helper ───────────────────────────────────────────────────────
function isOfflineSource(sourceType: string): boolean {
  return sourceType === "demo" || sourceType === "manual";
}

function makeDemoPayment(amount: number): PaymentResult {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    success:       true,
    transactionId: `DEMO-TXN-${ts}-${rand}`,
    method:        "card",
    amount,
    currency:      "TRY",
    processedAt:   new Date().toISOString(),
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quote_result_id: string }> }
) {
  try {
    const { quote_result_id } = await params;

    const { data: { user } } = await getSessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const context = await getQuoteIssueContext(quote_result_id);
    if (!context) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }
    // Tenant izolasyonu (IDOR): başka acentenin teklifine erişim engellenir.
    if (caller.role !== "super_admin" && context.run.agency_id !== caller.agencyId) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }

    const alreadyIssued = await checkIfAlreadyIssued(quote_result_id);
    const sourceType    = context.result.source_type ?? "demo";
    const isDemo        = sourceType === "demo";
    const isManual      = sourceType === "manual";

    return NextResponse.json({ context, alreadyIssued, isDemo, isManual, sourceType });
  } catch (err) {
    console.error("[policy-issue GET]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quote_result_id: string }> }
) {
  try {
    const { quote_result_id } = await params;

    const { data: { user } } = await getSessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "policy.create");
    if (denied) return denied;

    // Body: yalnızca tutar + açıklama — kart bilgisi ASLA burada beklenmez
    const body = await request.json();
    const { amount, description } = body as { amount?: number; description?: string };

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz ödeme tutarı." }, { status: 400 });
    }

    // ── Teklif bağlamı ────────────────────────────────────────────────────────
    const context = await getQuoteIssueContext(quote_result_id);
    if (!context) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }
    // Tenant izolasyonu (IDOR): başka acentenin teklifinden poliçe kesilemez.
    if (caller.role !== "super_admin" && context.run.agency_id !== caller.agencyId) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }

    const sourceType = context.result.source_type ?? "demo";
    const offline    = isOfflineSource(sourceType); // demo | manual

    // ── Daha önce kesilmiş mi? ────────────────────────────────────────────────
    const alreadyIssued = await checkIfAlreadyIssued(quote_result_id);
    if (alreadyIssued.issued) {
      return NextResponse.json(
        { error: "Bu teklif daha önce poliçeye dönüştürülmüş.", policyNo: alreadyIssued.policyNo },
        { status: 409 }
      );
    }

    // ── Kesilebilirlik kontrolü ───────────────────────────────────────────────
    // Demo ve manual kaynaklar için can_issue_policy kontrolü atlanır.
    // Gerçek API/Gateway entegrasyonunda sağlayıcı bu bayrağı set eder.
    if (!offline && !context.result.can_issue_policy) {
      return NextResponse.json(
        { error: "Bu teklif poliçeye dönüştürülemez. Sağlayıcıdan onay alınamadı." },
        { status: 400 }
      );
    }

    // ── Ödeme işlemi ──────────────────────────────────────────────────────────
    // Demo/Manual → simüle et (kart verisi dahil edilmez, ödeme alınmaz)
    // API/Gateway → gerçek sağlayıcı çağrısı (ileride buraya eklenecek)
    let paymentResult: PaymentResult;

    if (offline) {
      // Demo/Manuel modda ödeme simülasyonu — kart verisi yok, gecikme yok
      paymentResult = makeDemoPayment(amount);
    } else {
      // Gelecek: gerçek ödeme sağlayıcısı (İyzico / PayTR)
      paymentResult = await processMockPayment({
        amount,
        currency:    "TRY",
        description: description ?? `${context.result.company_name} - ${context.run.product_type}`,
      });
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.errorMessage ?? "Ödeme işlemi başarısız." },
        { status: 402 }
      );
    }

    // ── Poliçeyi kes ─────────────────────────────────────────────────────────
    const issued = await issuePolicy({
      context,
      paymentResult,
      agentUserId: user.id,
      sourceType,
    });

    return NextResponse.json({
      ok:            true,
      policyId:      issued.policyId,
      policyNo:      issued.policyNo,
      issuedAt:      issued.issuedAt,
      startDate:     issued.startDate,
      endDate:       issued.endDate,
      isDemo:        issued.isDemo,
      transactionId: paymentResult.transactionId, // Audit — kart bilgisi değil
    });

  } catch (err) {
    console.error("[policy-issue POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
