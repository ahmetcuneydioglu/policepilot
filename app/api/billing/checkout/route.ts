/**
 * POST /api/billing/checkout — eklenti satın alma (Faz 2: manuel/simülasyon).
 *
 * Body: { addons: { key: quantity }, plan?: string }
 * Akış: yetki (billing.manage) → server fiyat → ManualProvider (auto-approve) →
 *       setAddon/changePlan uygula → billing_event (pending_payment). Gerçek para ÇEKİLMEZ.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildServerQuote } from "@/lib/billing/quoteServer";
import { setAddon, changePlan, logBillingEvent } from "@/lib/billing/subscription";
import { getBillingProvider } from "@/lib/billing/provider";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "billing.manage");
    if (denied) return denied;
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const addons: Record<string, number> = body.addons && typeof body.addons === "object" ? body.addons : {};
    const plan: string | undefined = typeof body.plan === "string" ? body.plan : undefined;

    const admin = getSupabaseAdmin();
    // Fiyatı SERVER hesaplar (client tutarına güvenilmez)
    const quote = await buildServerQuote(admin, agencyId, { plan, addons });

    const provider = getBillingProvider();
    const checkout = await provider.createCheckout({
      agencyId, kind: plan ? "plan" : "addons",
      amount: quote.proration?.immediateCharge ?? quote.monthlyTotalWithVat,
      description: plan ? `Plan: ${plan}` : "Ek modül satın alımı",
    });

    if (!checkout.autoApproved) {
      // Gerçek provider (Faz 3): ödeme URL'i döndür, webhook uygular
      return NextResponse.json({ ok: true, requiresPayment: true, url: checkout.url });
    }

    // Manuel: değişiklikleri uygula — yalnız GERÇEK değişim varsa fatura yaz.
    let changed = false;
    if (plan) changed = (await changePlan(admin, agencyId, plan, caller.userId)) || changed;
    for (const [key, qty] of Object.entries(addons)) {
      changed = (await setAddon(admin, agencyId, key, Number(qty) || 0, caller.userId)) || changed;
    }

    if (!changed) {
      // Dokunulan adet zaten mevcut değerle aynı → fatura üretme (hayalet tahsilat yok).
      return NextResponse.json({
        ok: true, noChange: true, quote,
        message: "Mevcut paketinizde bir değişiklik yapılmadı.",
      });
    }

    // Tek fatura olayı = bu satın alımın bütünü (immediate/kıst tutar). Denetim izi addon_change'tedir.
    await logBillingEvent(admin, {
      agencyId, type: "checkout", actorId: caller.userId,
      amount: quote.proration?.immediateCharge ?? quote.monthlyTotalWithVat,
      status: "pending_payment", source: "manual",
      external_ref: checkout.reference, metadata: { plan: plan ?? null, addons },
    });

    return NextResponse.json({
      ok: true, reference: checkout.reference, quote,
      message: "Talebiniz alındı, faturanız oluşturuldu (tahsilat bekliyor).",
    });
  } catch (err) {
    console.error("[api/billing/checkout]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
