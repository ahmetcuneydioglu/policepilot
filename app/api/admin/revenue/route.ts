/**
 * GET /api/admin/revenue — Gelir Merkezi verisi (yalnız super_admin)
 * MRR/ARR plan haritasından türetilir (lib/planPricing) — gerçek ödeme
 * altyapısı bağlandığında yalnız veri kaynağı değişir.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PLAN_PRICING, PLAN_LABELS, planMonthlyRevenue } from "@/lib/planPricing";
import { requireSuperAdmin } from "../_lib/auth";
import { collectPlatformData } from "../_lib/stats";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const data = await collectPlatformData();

    const mrr = data.totals.monthly_revenue;
    const churned = data.agencies
      .filter(a => !a.is_active)
      .reduce((s, a) => s + planMonthlyRevenue(a.plan), 0);

    // Paket dağılımı
    const byPlan = Object.keys(PLAN_PRICING).map(plan => {
      const list = data.agencies.filter(a => a.plan === plan);
      return {
        plan,
        label: PLAN_LABELS[plan] ?? plan,
        count: list.length,
        active: list.filter(a => a.is_active).length,
        mrr: list.filter(a => a.is_active).length * PLAN_PRICING[plan],
      };
    });

    // Acente bazlı gelir
    const byAgency = data.perAgency
      .map(s => ({
        id: s.agency.id, name: s.agency.name, plan: s.agency.plan,
        is_active: s.agency.is_active, mrr: s.monthly_revenue,
        premium_volume: s.total_premium,
      }))
      .sort((a, b) => b.mrr - a.mrr || b.premium_volume - a.premium_volume);

    // Son 6 ay MRR serisi: acentenin kurulum ayından itibaren plan geliri sayılır
    const series: { month: string; mrr: number; agencies: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const activeThen = data.agencies.filter(a => new Date(a.created_at) <= monthEnd && a.is_active);
      series.push({
        month: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        mrr: activeThen.reduce((s, a) => s + planMonthlyRevenue(a.plan), 0),
        agencies: activeThen.length,
      });
    }

    return NextResponse.json({
      mrr,
      arr: mrr * 12,
      collected_this_month: mrr,            // ödeme altyapısı bağlanınca gerçek tahsilat
      churned_this_month: churned,
      note: "Gelir, acente planlarından türetilen tahmindir (ödeme altyapısı henüz bağlı değil).",
      by_plan: byPlan,
      by_agency: byAgency,
      series,
    });
  } catch (err) {
    console.error("[api/admin/revenue]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
