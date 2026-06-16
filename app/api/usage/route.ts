/**
 * GET /api/usage — çağıran acentenin kullanım/limit özeti (7 metrik)
 *
 * Etkin limit motorundan (lib/billing) plan tabanı + acente override + aktif
 * eklenti çözümlenir; kullanım anlık görüntüsü (used+max) döner.
 * Metrikler: users, customers, requests, policies, ai_credits, wa_monthly, storage_mb.
 * Süper admin acenteye bağlı değilse boş döner.
 *
 * Not: 'requests' metriği gerçekten 'requests' (Teklif Talepleri) tablosunu sayar —
 *      eski 'quote_runs' sayımı (canlı hata) düzeltildi.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getEffectiveLimits } from "@/lib/billing/resolver";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { resolveCaller } from "../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ ok: true, agency: null });

    const admin = getSupabaseAdmin();
    const eff = await getEffectiveLimits(admin, agencyId);
    if (!eff) return NextResponse.json({ ok: true, agency: null });

    const limits = await getUsageSnapshot(admin, agencyId, eff.limits);

    return NextResponse.json({
      ok: true,
      agency: {
        plan:          eff.plan,
        label:         eff.label,
        is_active:     eff.isActive,
        status:        eff.status,
        monthly_price: eff.monthlyPrice,
        next_payment:  eff.periodEnd,   // agencies.expires_at (sonraki ödeme/süre)
        limits,                          // 7 metrik {used,max}
        addons:        [],               // Faz 2 (satın alım)
      },
    });
  } catch (err) {
    console.error("[api/usage]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
