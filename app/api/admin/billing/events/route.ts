/**
 * GET /api/admin/billing/events — platform geneli abonelik/fatura denetim akışı (super_admin).
 * Query: ?agency_id=... (opsiyonel filtre), ?limit=...
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../../_lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get("agency_id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10) || 200, 500);

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (admin.from("billing_events") as any)
      .select("id, agency_id, type, actor_id, amount, status, source, external_ref, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (agencyId) q = q.eq("agency_id", agencyId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("[api/admin/billing/events]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
