/**
 * POST /api/billing/webhook — ödeme sağlayıcı bildirimi (Faz 3 HAZIRLIĞI).
 *
 * iyzico, ödeme sonucunu oturumsuz olarak buraya POST eder; güvenlik OTURUMLA değil
 * İMZAYLA sağlanır (provider.verifyWebhook). Bu route hazır ama FAIL-CLOSED:
 *  - Manuel modda (verifyWebhook yok) → sessizce yok sayar.
 *  - iyzico modunda imza doğrulanana (IYZICO_WIRED=true) kadar hiçbir olay kabul edilmez.
 *
 * Doğrulanan "paid" bildiriminde ilgili billing_events 'pending_payment' → 'paid'
 * yapılır (markBillingEventPaid, idempotent). external_ref = iyzico conversationId.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getBillingProvider } from "@/lib/billing/provider";
import { markBillingEventPaid, logBillingEvent } from "@/lib/billing/subscription";

export async function POST(request: NextRequest) {
  try {
    const provider = getBillingProvider();
    if (!provider.verifyWebhook) {
      // Manuel/simülasyon: webhook beklenmez. 200 ile sessizce kapat.
      return NextResponse.json({ ignored: true, reason: "provider webhook desteklemiyor" });
    }

    // İmza ham gövde üzerinden doğrulanır → text() ile oku (JSON parse provider'ın işi).
    const rawBody = await request.text();
    const headers: Record<string, string | null> = {
      "x-iyz-signature-v3": request.headers.get("x-iyz-signature-v3"),
      "x-iyz-signature":    request.headers.get("x-iyz-signature"),
    };

    const result = await provider.verifyWebhook({ headers, rawBody });
    if (!result.ok) {
      // Doğrulanamadı → bilgi sızdırma, 200 ile yut (sağlayıcı retry mantığını bozmadan).
      return NextResponse.json({ ignored: true });
    }

    const admin = getSupabaseAdmin();
    if (result.status === "paid" && result.reference) {
      const flipped = await markBillingEventPaid(admin, result.reference);
      await logBillingEvent(admin, {
        agencyId: null, type: "webhook", status: flipped ? "paid" : "logged",
        source: provider.name, external_ref: result.reference,
        metadata: { status: result.status, reconciled: flipped },
      });
    } else if (result.status === "failed" && result.reference) {
      await logBillingEvent(admin, {
        agencyId: null, type: "webhook", status: "failed",
        source: provider.name, external_ref: result.reference,
        metadata: { status: result.status },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/billing/webhook]", err);
    // Sağlayıcıya 200 dön (retry fırtınası önlenir); hata sunucu logunda.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
