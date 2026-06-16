/**
 * GET /api/billing/summary — çağıran acentenin abonelik özeti.
 * Etkin limit + kullanım + aktif eklentiler + abonelik durumu + aylık tutar.
 * Ek Satın Alım Merkezi steppers'ı mevcut adetlerden başlatmak için kullanılır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getEffectiveLimits } from "@/lib/billing/resolver";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getSubscription, getActiveAddons } from "@/lib/billing/subscription";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ ok: true, agency: null });

    const admin = getSupabaseAdmin();
    const eff = await getEffectiveLimits(admin, agencyId);
    if (!eff) return NextResponse.json({ ok: true, agency: null });

    const [usage, subscription, addons] = await Promise.all([
      getUsageSnapshot(admin, agencyId, eff.limits),
      getSubscription(admin, agencyId),
      getActiveAddons(admin, agencyId),
    ]);

    // Aktif eklenti adetleri (key → quantity) — UI stepper başlangıcı
    const addonQuantities: Record<string, number> = {};
    let addonsMonthly = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of addons as any[]) {
      addonQuantities[a.addon_key] = a.quantity ?? 0;
      addonsMonthly += (a.quantity ?? 0) * (a.unit_price_snapshot ?? 0);
    }

    return NextResponse.json({
      ok: true,
      agency: {
        plan: eff.plan, label: eff.label, status: eff.status, is_active: eff.isActive,
        monthly_price: eff.monthlyPrice, addons_monthly: addonsMonthly,
        monthly_total: eff.monthlyPrice + addonsMonthly,
        next_payment: eff.periodEnd,
        limits: usage,
        addon_quantities: addonQuantities,
        subscription: subscription
          ? { status: subscription.status, period_start: subscription.period_start, period_end: subscription.period_end, provider: subscription.provider }
          : null,
      },
    });
  } catch (err) {
    console.error("[api/billing/summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
