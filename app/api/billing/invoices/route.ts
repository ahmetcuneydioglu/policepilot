/**
 * GET /api/billing/invoices — çağıran acentenin fatura/abonelik olayları (billing_events).
 * Faturalar bölümü için. Oturum gerekir; yalnız kendi acentesi.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (!caller.agencyId) return NextResponse.json({ ok: true, items: [] });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from("billing_events") as any)
      .select("id, type, amount, status, source, metadata, created_at")
      .eq("agency_id", caller.agencyId)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (err) {
    console.error("[api/billing/invoices]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
