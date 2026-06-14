/**
 * PATCH /api/admin/agencies/[id]/users/[userId]
 *   Acente kullanıcısının SaaS rolü, durumu, telefonu ve yetki override'ları
 *   güncellenir (yalnız super_admin).
 *
 * GÜVENLİK:
 *  - Sistem rolü `role` ve `agency_id` BU ENDPOINT'TEN ASLA değiştirilmez
 *    → ayrıcalık yükseltme (super_admin yapma) ve tenant kaçışı imkansız.
 *  - Update çift filtre `.eq("id", userId).eq("agency_id", agencyId)` ile yapılır
 *    → başka acentenin kullanıcısı yanlışlıkla güncellenemez.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AGENCY_ROLES } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { requireSuperAdmin } from "../../../../_lib/auth";

const STATUSES = ["active", "suspended", "invited"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id: agencyId, userId } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = {};

    if (typeof body.agency_role === "string") {
      if (!AGENCY_ROLES.some((r) => r.value === body.agency_role)) {
        return NextResponse.json({ error: `Geçersiz rol: ${body.agency_role}` }, { status: 400 });
      }
      update.agency_role = body.agency_role;
    }

    if (typeof body.status === "string") {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Geçersiz durum: ${body.status}` }, { status: 400 });
      }
      update.status = body.status;
    }

    if (typeof body.phone === "string") {
      update.phone = body.phone.trim() || null;
    }

    // permissions: null (rol şablonuna dön) veya nesne (override haritası)
    if (body.permissions === null) {
      update.permissions = null;
    } else if (typeof body.permissions === "object" && !Array.isArray(body.permissions)) {
      update.permissions = body.permissions;
    }

    // ⚠️ role ve agency_id bilerek dışarıda — güncellenmez.

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("profiles") as any)
      .update(update)
      .eq("id", userId)
      .eq("agency_id", agencyId) // cross-tenant koruması
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı veya bu acenteye ait değil." },
        { status: 404 }
      );
    }

    await logActivity({
      agencyId,
      actorId: auth.caller.userId,
      action: "update",
      entityType: "user",
      entityId: userId,
      summary: "Kullanıcı yetkileri güncellendi",
      metadata: update,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/agencies/[id]/users/[userId] PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
