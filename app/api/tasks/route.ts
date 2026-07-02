/**
 * /api/tasks — görev/hatırlatma sistemi (Sprint 4).
 * GET : açık görevler (yönetici acente geneli, diğerleri kendine atananlar).
 * POST: yeni görev; yönetici başkasına atayabilir; atanan ≠ oluşturan ise
 *       bildirim (notifications → bell'e realtime düşer).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ tasks: [] });

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (admin.from("tasks") as any)
      .select("id, title, due_date, status, customer_id, request_id, assigned_to, created_at, customers(name)")
      .eq("agency_id", agencyId).eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (!managerial) q = q.eq("assigned_to", caller.userId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    console.error("[api/tasks GET]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bağlamı yok." }, { status: 400 });

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Görev başlığı zorunlu." }, { status: 400 });

    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    const assigned_to =
      managerial && typeof body.assigned_to === "string" && body.assigned_to
        ? body.assigned_to
        : caller.userId;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("tasks") as any).insert({
      agency_id: agencyId,
      title,
      due_date: body.due_date || null,
      customer_id: body.customer_id || null,
      request_id: body.request_id || null,
      assigned_to,
      created_by: caller.userId,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Atanan ≠ oluşturan → bildirim (bell realtime)
    if (assigned_to && assigned_to !== caller.userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("notifications") as any).insert({
        agency_id: agencyId,
        type: "system",
        title: "Yeni görev atandı",
        body: title + (body.due_date ? ` · vade: ${body.due_date}` : ""),
        link: "/dashboard",
        ref_id: data?.id ?? null,
      }).then(() => {});
    }

    await logActivity({
      agencyId, actorId: caller.userId, action: "create", entityType: "task",
      entityId: data?.id ?? null, summary: `Görev oluşturuldu: ${title}`,
    });

    return NextResponse.json({ ok: true, taskId: data?.id });
  } catch (err) {
    console.error("[api/tasks POST]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
