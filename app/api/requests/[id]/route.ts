/**
 * PATCH /api/requests/[id] — satış fırsatı güncelle (statü/atama/not/takip).
 *
 * Scope: aynı acente + (yönetici VEYA fırsatın sorumlusu/oluşturanı).
 * Atama (assigned_to) yalnız yönetici tarafından değiştirilebilir.
 * Her statü/atama değişikliği activity_log'a yazılır (durum geçmişi).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";
import { isValidStage } from "@/lib/opportunities";
import { logActivity } from "@/lib/activity";

/** GET /api/requests/[id] — fırsat detayı + aktivite/durum geçmişi (drawer). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (admin.from("requests") as any)
      .select("id, agency_id, customer_id, request_type, status, price_offer, created_at, updated_at, assigned_to, created_by, next_follow_up_date, notes, policy_id, customers(name, phone, email, identity_no, insurance_type, note)")
      .eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Satış fırsatı bulunamadı." }, { status: 404 });

    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    if (caller.role !== "super_admin") {
      if (row.agency_id !== caller.agencyId)
        return NextResponse.json({ error: "Satış fırsatı bulunamadı." }, { status: 404 });
      if (!managerial && row.assigned_to !== caller.userId && row.created_by !== caller.userId)
        return NextResponse.json({ error: "Bu fırsat üzerinde yetkiniz yok." }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activity } = await (admin.from("activity_log") as any)
      .select("id, action, summary, actor_name, created_at")
      .eq("entity_type", "request").eq("entity_id", id)
      .order("created_at", { ascending: false }).limit(50);

    let assigned_name: string | null = null;
    if (row.assigned_to) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: p } = await (admin.from("profiles") as any).select("full_name").eq("id", row.assigned_to).maybeSingle();
      assigned_name = p?.full_name ?? null;
    }

    return NextResponse.json({ opportunity: { ...row, assigned_name }, activity: activity ?? [] });
  } catch (err) {
    console.error("[API /api/requests/[id] GET] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const body = await request.json();
    const admin = getSupabaseAdmin();

    // ── Mevcut kaydı çek + scope doğrula ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (admin.from("requests") as any)
      .select("id, agency_id, assigned_to, created_by, status, customers(name)")
      .eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Satış fırsatı bulunamadı." }, { status: 404 });

    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    if (caller.role !== "super_admin") {
      if (row.agency_id !== caller.agencyId)
        return NextResponse.json({ error: "Satış fırsatı bulunamadı." }, { status: 404 });
      if (!managerial && row.assigned_to !== caller.userId && row.created_by !== caller.userId)
        return NextResponse.json({ error: "Bu fırsat üzerinde yetkiniz yok." }, { status: 403 });
    }

    // ── İzinli alanları topla ─────────────────────────────────────────────────
    const update: Record<string, unknown> = {};
    const logs: string[] = [];

    if (typeof body.status === "string") {
      if (!isValidStage(body.status))
        return NextResponse.json({ error: "Geçersiz aşama." }, { status: 400 });
      if (body.status !== row.status) {
        update.status = body.status;
        logs.push(`Aşama "${row.status}" → "${body.status}"`);
      }
    }
    if (managerial && typeof body.assigned_to !== "undefined") {
      update.assigned_to = body.assigned_to || null;
      logs.push(body.assigned_to ? "Sorumlu personel değiştirildi" : "Atama kaldırıldı");
    }
    if (typeof body.notes === "string") update.notes = body.notes;
    if (typeof body.next_follow_up_date !== "undefined")
      update.next_follow_up_date = body.next_follow_up_date || null;
    if (typeof body.policy_id === "string") update.policy_id = body.policy_id;

    if (Object.keys(update).length === 0)
      return NextResponse.json({ ok: true, noop: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("requests") as any).update(update).eq("id", id);
    if (error) {
      console.error("[API /api/requests/[id] PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Activity log (durum geçmişi) — best-effort ───────────────────────────
    if (logs.length > 0) {
      const custName = row.customers?.name ?? "Müşteri";
      await logActivity({
        agencyId: row.agency_id ?? caller.agencyId ?? null,
        actorId: caller.userId,
        action: "update",
        entityType: "request",
        entityId: id,
        summary: `${custName}: ${logs.join(" · ")}`,
        metadata: update,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API /api/requests/[id] PATCH] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
