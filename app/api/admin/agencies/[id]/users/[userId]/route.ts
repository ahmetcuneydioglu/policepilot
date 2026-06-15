/**
 * PATCH  /api/admin/agencies/[id]/users/[userId] — rol/durum/telefon/yetki güncelle
 * POST   /api/admin/agencies/[id]/users/[userId] — davet/parola linkini yeniden üret
 * DELETE /api/admin/agencies/[id]/users/[userId] — kullanıcıyı sil (profil + auth)
 * (yalnız super_admin)
 *
 * GÜVENLİK:
 *  - Sistem rolü `role` ve `agency_id` BU ENDPOINT'TEN ASLA değiştirilmez.
 *  - super_admin kullanıcı bu endpoint'ten SİLİNEMEZ (kazara platform kilidi yok).
 *  - Tüm işlemler çift filtre `.eq("id", userId).eq("agency_id", agencyId)` ile
 *    → başka acentenin kullanıcısına dokunulamaz.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AGENCY_ROLES } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getAppOrigin } from "@/lib/appUrl";
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

// ─── POST — davet/parola linkini yeniden üret ─────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id: agencyId, userId } = await params;
    const admin = getSupabaseAdmin();

    // Kullanıcı bu acenteye ait mi + e-posta?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (admin.from("profiles") as any)
      .select("email, agency_id").eq("id", userId).eq("agency_id", agencyId).maybeSingle();
    if (!prof) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    if (!prof.email) return NextResponse.json({ error: "Kullanıcının e-postası kayıtlı değil." }, { status: 400 });

    const origin = getAppOrigin(request);
    // recovery: mevcut kullanıcı için parola belirleme/sıfırlama linki (aktivasyon)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
      type: "recovery",
      email: prof.email,
      options: { redirectTo: `${origin}/davet` },
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    await logActivity({
      agencyId, actorId: auth.caller.userId,
      action: "update", entityType: "user", entityId: userId,
      summary: `Davet/parola linki yeniden üretildi: ${prof.email}`,
    });

    return NextResponse.json({ ok: true, inviteLink: linkData?.properties?.action_link ?? null });
  } catch (err) {
    console.error("[api/admin/agencies/[id]/users/[userId] POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── DELETE — kullanıcıyı sil (profil + auth user) ────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id: agencyId, userId } = await params;
    if (userId === auth.caller.userId) {
      return NextResponse.json({ error: "Kendinizi silemezsiniz." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Hedef bu acenteye ait + sistem rolü kontrolü (super_admin silinemez)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (admin.from("profiles") as any)
      .select("role, agency_id").eq("id", userId).eq("agency_id", agencyId).maybeSingle();
    if (!prof) return NextResponse.json({ error: "Kullanıcı bulunamadı veya bu acenteye ait değil." }, { status: 404 });
    if (prof.role === "super_admin") {
      return NextResponse.json({ error: "Platform yöneticisi bu ekrandan silinemez." }, { status: 403 });
    }

    // Profil sil (çift filtre)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profErr } = await (admin.from("profiles") as any)
      .delete().eq("id", userId).eq("agency_id", agencyId);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    // Auth kullanıcısını sil (best-effort — profil zaten silindi)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: authErr } = await (admin.auth.admin as any).deleteUser(userId);
    if (authErr) console.warn("[users DELETE] auth deleteUser:", authErr.message);

    await logActivity({
      agencyId, actorId: auth.caller.userId,
      action: "delete", entityType: "user", entityId: userId,
      summary: "Kullanıcı silindi",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/agencies/[id]/users/[userId] DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
