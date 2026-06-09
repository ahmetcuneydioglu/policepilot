/**
 * GET  /api/policy-issue/[quote_result_id]  — teklif bağlamını döndür
 * POST /api/policy-issue/[quote_result_id]  — ödemeyi işle ve poliçeyi kes
 *
 * ⚠️  GÜVENLİK: Kart bilgileri (no, CVV, son kullanma) bu route'a GELMEMELİ.
 *     POST body'de yalnızca amount + description (tokenize akış için cardToken isteğe bağlı).
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getQuoteIssueContext, checkIfAlreadyIssued } from "@/services/insurance/quoteService";
import { processMockPayment }  from "@/services/payment/paymentService";
import { issuePolicy }         from "@/services/insurance/policyIssueService";

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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quote_result_id: string }> }
) {
  try {
    const { quote_result_id } = await params;

    const { data: { user } } = await getSessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const context = await getQuoteIssueContext(quote_result_id);
    if (!context) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }

    // Daha önce poliçe kesilmiş mi?
    const alreadyIssued = await checkIfAlreadyIssued(quote_result_id);

    return NextResponse.json({ context, alreadyIssued });
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

    // Body'den yalnızca tutar + açıklama alınır — kart bilgisi ASLA burada beklenmez
    const body = await request.json();
    const { amount, description } = body as { amount?: number; description?: string };

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz ödeme tutarı." }, { status: 400 });
    }

    // ── Teklif bağlamını al ───────────────────────────────────────────────────
    const context = await getQuoteIssueContext(quote_result_id);
    if (!context) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }

    // ── Daha önce kesilmiş mi? ────────────────────────────────────────────────
    const alreadyIssued = await checkIfAlreadyIssued(quote_result_id);
    if (alreadyIssued.issued) {
      return NextResponse.json(
        { error: "Bu teklif daha önce poliçeye dönüştürülmüş.", policyNo: alreadyIssued.policyNo },
        { status: 409 }
      );
    }

    // ── Poliçe kesilebilir mi? ────────────────────────────────────────────────
    if (!context.result.can_issue_policy) {
      return NextResponse.json(
        { error: "Bu teklif poliçeye dönüştürülemez." },
        { status: 400 }
      );
    }

    // ── Mock ödeme işlemi ─────────────────────────────────────────────────────
    // ⚠️  Kart bilgisi yok — sadece tutar iletildi
    const paymentResult = await processMockPayment({
      amount,
      currency:    "TRY",
      description: description ?? `${context.result.company_name} - ${context.run.product_type} poliçesi`,
    });

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.errorMessage ?? "Ödeme işlemi başarısız." },
        { status: 402 }
      );
    }

    // ── Poliçe oluştur ────────────────────────────────────────────────────────
    const issued = await issuePolicy({ context, paymentResult, agentUserId: user.id });

    return NextResponse.json({
      ok:             true,
      policyId:       issued.policyId,
      policyNo:       issued.policyNo,
      issuedAt:       issued.issuedAt,
      transactionId:  paymentResult.transactionId,  // Audit için — kart bilgisi değil
    });

  } catch (err) {
    console.error("[policy-issue POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
