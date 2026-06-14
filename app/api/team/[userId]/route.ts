/**
 * PATCH  /api/team/[userId] — ekip üyesinin rol/durum/telefon/yetki günceller
 * POST   /api/team/[userId] — davet/parola linkini yeniden üret
 * DELETE /api/team/[userId] — ekip üyesini sil (profil + auth)
 *
 * Hepsi çağıranın KENDİ acentesi (caller.agencyId) ile sınırlı; yetki: users.manage.
 * GÜVENLİK:
 *  - Sistem rolü `role` ve `agency_id` ASLA değişmez.
 *  - super_admin üye bu ekrandan değiştirilemez/silinemez.
 *  - 'owner' rolündeki üye yalnız bir owner tarafından düzenlenebilir/silinebilir;
 *    'owner' rolü yalnız bir owner tarafından atanabilir.
 *  - Kişi kendini silemez.
 *  - Tüm yazımlar `.eq("id",userId).eq("agency_id", caller.agencyId)` ile.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AGENCY_ROLES } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

const STATUSES = ["active", "suspended", "invited"];

// Hedef üyeyi çağıranın acentesinde doğrula + koruma kontrolleri
async function loadTarget(agencyId: string, userId: string) {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("profiles") as any)
    .select("role, agency_role, agency_id, email")
    .eq("id", userId).eq("agency_id", agencyId).maybeSingle();
  return data as { role: string; agency_role: string | null; agency_id: string; email: string | null } | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const { userId } = await params;
    const callerIsOwner = (caller.agencyRole ?? "owner") === "owner";

    const target = await loadTarget(caller.agencyId, userId);
    if (!target) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
    if (target.role === "super_admin") return NextResponse.json({ error: "Platform yöneticisi düzenlenemez." }, { status: 403 });
    if (target.agency_role === "owner" && !callerIsOwner) {
      return NextResponse.json({ error: "Acente sahibini yalnız bir acente sahibi düzenleyebilir." }, { status: 403 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (typeof body.agency_role === "string") {
      if (!AGENCY_ROLES.some((r) => r.value === body.agency_role)) {
        return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
      }
      if (body.agency_role === "owner" && !callerIsOwner) {
        return NextResponse.json({ error: "Yalnız acente sahibi 'Acente Sahibi' rolü atayabilir." }, { status: 403 });
      }
      update.agency_role = body.agency_role;
    }
    if (typeof body.status === "string") {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
      update.status = body.status;
    }
    if (typeof body.phone === "string") update.phone = body.phone.trim() || null;
    if (body.permissions === null || typeof body.permissions === "object") {
      update.permissions = body.permissions;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("profiles") as any)
      .update(update).eq("id", userId).eq("agency_id", caller.agencyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      agencyId: caller.agencyId, actorId: caller.userId,
      action: "update", entityType: "user", entityId: userId,
      summary: "Ekip üyesi güncellendi", metadata: update,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/team/[userId] PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const { userId } = await params;
    const target = await loadTarget(caller.agencyId, userId);
    if (!target) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
    if (!target.email) return NextResponse.json({ error: "Üyenin e-postası kayıtlı değil." }, { status: 400 });

    const origin = new URL(request.url).origin;
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
      type: "recovery", email: target.email, options: { redirectTo: `${origin}/login` },
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    await logActivity({
      agencyId: caller.agencyId, actorId: caller.userId,
      action: "update", entityType: "user", entityId: userId,
      summary: `Davet/parola linki yeniden üretildi: ${target.email}`,
    });

    return NextResponse.json({ ok: true, inviteLink: linkData?.properties?.action_link ?? null });
  } catch (err) {
    console.error("[api/team/[userId] POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const { userId } = await params;
    if (userId === caller.userId) return NextResponse.json({ error: "Kendinizi silemezsiniz." }, { status: 400 });

    const callerIsOwner = (caller.agencyRole ?? "owner") === "owner";
    const target = await loadTarget(caller.agencyId, userId);
    if (!target) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
    if (target.role === "super_admin") return NextResponse.json({ error: "Platform yöneticisi silinemez." }, { status: 403 });
    if (target.agency_role === "owner" && !callerIsOwner) {
      return NextResponse.json({ error: "Acente sahibini yalnız bir acente sahibi silebilir." }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profErr } = await (admin.from("profiles") as any)
      .delete().eq("id", userId).eq("agency_id", caller.agencyId);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: authErr } = await (admin.auth.admin as any).deleteUser(userId);
    if (authErr) console.warn("[api/team DELETE] auth deleteUser:", authErr.message);

    await logActivity({
      agencyId: caller.agencyId, actorId: caller.userId,
      action: "delete", entityType: "user", entityId: userId,
      summary: "Ekip üyesi silindi",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/team/[userId] DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
