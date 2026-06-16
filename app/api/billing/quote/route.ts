/**
 * POST /api/billing/quote — {plan?, addons:{key:qty}} → server fiyat hesabı.
 * Client'ın hesabı yalnız gösterim; bu endpoint otoritedir.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildServerQuote } from "@/lib/billing/quoteServer";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const quote = await buildServerQuote(admin, caller.agencyId, {
      plan: typeof body.plan === "string" ? body.plan : undefined,
      addons: body.addons && typeof body.addons === "object" ? body.addons : {},
    });
    return NextResponse.json({ ok: true, quote });
  } catch (err) {
    console.error("[api/billing/quote]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
