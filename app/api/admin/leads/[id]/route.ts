/**
 * PATCH  /api/admin/leads/[id] — lead güncelle (kanban sürükle-bırak dahil)
 * DELETE /api/admin/leads/[id] — lead sil
 * (yalnız super_admin)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../../_lib/auth";
import { LEAD_STATUSES } from "../route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.status === "string" && (LEAD_STATUSES as readonly string[]).includes(body.status)) update.status = body.status;
    for (const k of ["name", "company", "phone", "email", "source", "note"] as const) {
      if (typeof body[k] === "string") update[k] = body[k].trim() || null;
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("platform_leads") as any).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/leads PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("platform_leads") as any).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/leads DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
