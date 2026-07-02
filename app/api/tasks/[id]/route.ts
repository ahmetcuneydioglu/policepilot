/**
 * PATCH /api/tasks/[id] — görevi tamamla / ertele / yeniden ata.
 * Scope: aynı acente + (yönetici VEYA görevin sahibi/oluşturanı).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (admin.from("tasks") as any)
      .select("id, agency_id, assigned_to, created_by").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });

    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    if (caller.role !== "super_admin") {
      if (row.agency_id !== caller.agencyId)
        return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });
      if (!managerial && row.assigned_to !== caller.userId && row.created_by !== caller.userId)
        return NextResponse.json({ error: "Bu görev üzerinde yetkiniz yok." }, { status: 403 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (body.status === "done") { update.status = "done"; update.completed_at = new Date().toISOString(); }
    if (body.status === "open") { update.status = "open"; update.completed_at = null; }
    if (typeof body.due_date !== "undefined") update.due_date = body.due_date || null;
    if (managerial && typeof body.assigned_to !== "undefined") update.assigned_to = body.assigned_to || null;
    if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true, noop: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("tasks") as any).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/tasks/[id] PATCH]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
