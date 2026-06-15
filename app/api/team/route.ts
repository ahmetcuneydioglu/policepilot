/**
 * GET  /api/team — acente sahibinin kendi ekibini listeler
 * POST /api/team — kendi acentesine yeni personel davet eder
 *
 * Süper admin panelinin acente-içi karşılığı. KRİTİK fark: işlemler çağıranın
 * KENDİ acentesi (caller.agencyId) ile sınırlıdır — URL'den agency_id alınmaz,
 * başka acenteye dokunmak imkansız.
 *
 * Yetki: users.manage (owner/manager). super_admin acente bağlamı yoksa bu
 * endpoint'i kullanamaz (admin panelini kullanır).
 * Güvenlik: sistem rolü 'agency_user' sabit; 'owner' rolünü yalnız bir owner
 * atayabilir (manager kendi üstüne owner üretemez). Kullanıcı limiti uygulanır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AGENCY_ROLES } from "@/lib/permissions";
import { canAddUser, limitMessage } from "@/lib/limits";
import { logActivity } from "@/lib/activity";
import { resolveCaller, requirePermission } from "../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from("profiles") as any)
      .select("id, full_name, email, phone, role, agency_role, status, last_login_at, permissions, created_at")
      .eq("agency_id", caller.agencyId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      members: data ?? [],
      selfId: caller.userId,
      callerRole: caller.agencyRole ?? "owner",
    });
  } catch (err) {
    console.error("[api/team GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "users.manage");
    if (denied) return denied;
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const body = await request.json();
    const email      = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName   = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const agencyRole = typeof body.agency_role === "string" ? body.agency_role : "sales";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
    }
    if (!AGENCY_ROLES.some((r) => r.value === agencyRole)) {
      return NextResponse.json({ error: `Geçersiz rol: ${agencyRole}` }, { status: 400 });
    }
    // Yalnız owner, owner rolü atayabilir (manager ayrıcalık yükseltemez)
    if (agencyRole === "owner" && (caller.agencyRole ?? "owner") !== "owner") {
      return NextResponse.json({ error: "Yalnız acente sahibi 'Acente Sahibi' rolü atayabilir." }, { status: 403 });
    }

    const admin = getSupabaseAdmin();

    // ── Kullanıcı limiti ───────────────────────────────────────────────────────
    const limit = await canAddUser(admin, agencyId);
    if (!limit.ok) {
      return NextResponse.json({ error: limitMessage("user"), code: "limit", current: limit.current, max: limit.max }, { status: 403 });
    }

    // ── Davet linki üret (kullanıcıyı oluşturur) ──────────────────────────────
    const origin = new URL(request.url).origin;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName, agency_id: agencyId }, redirectTo: `${origin}/davet` },
    });
    if (linkErr || !linkData?.user?.id) {
      const msg = linkErr?.message ?? "Davet oluşturulamadı.";
      const code = /already.*registered|exists/i.test(msg) ? "email_exists" : "invite_failed";
      return NextResponse.json({ error: msg, code }, { status: 400 });
    }

    const newUserId: string = linkData.user.id;
    const inviteLink: string | null = linkData.properties?.action_link ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profErr } = await (admin.from("profiles") as any).upsert({
      id:          newUserId,
      agency_id:   agencyId,
      full_name:   fullName || null,
      email,
      role:        "agency_user",
      agency_role: agencyRole,
      status:      "invited",
    }, { onConflict: "id" });
    if (profErr) {
      return NextResponse.json({ error: `Kullanıcı oluşturuldu ancak profil bağlanamadı: ${profErr.message}` }, { status: 500 });
    }

    await logActivity({
      agencyId, actorId: caller.userId,
      action: "create", entityType: "user", entityId: newUserId,
      summary: `Ekip üyesi davet edildi: ${email}`,
      metadata: { agency_role: agencyRole },
    });

    return NextResponse.json({ ok: true, userId: newUserId, inviteLink });
  } catch (err) {
    console.error("[api/team POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
