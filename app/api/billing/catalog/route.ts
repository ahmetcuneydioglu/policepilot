/**
 * GET /api/billing/catalog — plan + eklenti kataloğu (fiyatlar).
 * Ek Satın Alım Merkezi'nin canlı fiyat hesabı için. Oturum gerekir.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [planRes, addonRes] = await Promise.all([
      (admin.from("plan_catalog") as any).select("*").order("monthly_price", { ascending: true }),
      (admin.from("addon_catalog") as any).select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    ]);

    return NextResponse.json({ plans: planRes.data ?? [], addons: addonRes.data ?? [] });
  } catch (err) {
    console.error("[api/billing/catalog]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
