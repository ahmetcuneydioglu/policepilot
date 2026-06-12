/**
 * GET /api/admin/analytics — büyüme serileri + dağılımlar (yalnız super_admin)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";
import { collectPlatformData } from "../_lib/stats";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const data = await collectPlatformData();
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: polTypes } = await (admin.from("policies") as any).select("policy_type");

    // Son 6 ay aylık seri
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
      });
    }
    const monthKey = (iso: string) => iso.slice(0, 7);

    const series = months.map(m => ({
      month:     m.label,
      customers: data.raw.customers.filter(c => monthKey(c.created_at) === m.key).length,
      quotes:    data.raw.quoteRuns.filter(q => monthKey(q.created_at) === m.key).length,
      policies:  data.raw.policies.filter(p => monthKey(p.created_at) === m.key).length,
      whatsapp:  data.raw.whatsapp.filter(w => monthKey(w.created_at) === m.key).length,
    }));

    // Ürün dağılımı
    const typeCount = new Map<string, number>();
    for (const p of (polTypes ?? []) as { policy_type: string }[]) {
      typeCount.set(p.policy_type, (typeCount.get(p.policy_type) ?? 0) + 1);
    }
    const product_distribution = [...typeCount.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Teklif durum hunisi
    const statusCount = new Map<string, number>();
    for (const q of data.raw.quoteRuns) statusCount.set(q.status, (statusCount.get(q.status) ?? 0) + 1);
    const quote_funnel = [...statusCount.entries()].map(([status, count]) => ({ status, count }));

    return NextResponse.json({ series, product_distribution, quote_funnel, totals: data.totals });
  } catch (err) {
    console.error("[api/admin/analytics]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
