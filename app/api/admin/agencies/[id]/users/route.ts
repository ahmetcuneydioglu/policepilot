/**
 * POST /api/admin/agencies/[id]/users — acenteye yeni personel davet et (yalnız super_admin)
 *
 * Supabase admin.auth.admin.generateLink (type: 'invite') ile kullanıcı oluşturur
 * ve bir davet (action) linki üretir. SMTP yapılandırılmamış olsa bile link döner
 * → super_admin linki personele elle iletebilir (team davet akışıyla aynı mantık).
 *
 * Ardından profiles satırı upsert edilir: agency_id + agency_role + status='invited'.
 * Sistem rolü daima 'agency_user' (super_admin BURADAN üretilemez — güvenlik).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AGENCY_ROLES } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getAppOrigin, buildDavetLink } from "@/lib/appUrl";
import { requireSuperAdmin } from "../../../_lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id: agencyId } = await params;
    const body = await request.json();

    const email     = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName  = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const agencyRole = typeof body.agency_role === "string" ? body.agency_role : "sales";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
    }
    if (!AGENCY_ROLES.some((r) => r.value === agencyRole)) {
      return NextResponse.json({ error: `Geçersiz rol: ${agencyRole}` }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Acentenin var olduğunu doğrula
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agency } = await (admin.from("agencies") as any).select("id, name").eq("id", agencyId).maybeSingle();
    if (!agency) return NextResponse.json({ error: "Acente bulunamadı." }, { status: 404 });

    // ── Davet linki üret (kullanıcıyı da oluşturur) ───────────────────────────
    const origin = getAppOrigin(request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name: fullName, agency_id: agencyId },
        redirectTo: `${origin}/davet`,
      },
    });

    if (linkErr || !linkData?.user?.id) {
      const msg = linkErr?.message ?? "Davet oluşturulamadı.";
      const code = /already.*registered|exists/i.test(msg) ? "email_exists" : "invite_failed";
      return NextResponse.json({ error: msg, code }, { status: 400 });
    }

    const newUserId: string = linkData.user.id;
    const inviteLink: string | null = buildDavetLink(origin, linkData.properties, "invite");

    // ── profiles satırını acenteye bağla (trigger oluşturduysa da upsert düzeltir) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profErr } = await (admin.from("profiles") as any).upsert({
      id:          newUserId,
      agency_id:   agencyId,
      full_name:   fullName || null,
      email,
      role:        "agency_user",   // sistem rolü sabit
      agency_role: agencyRole,
      status:      "invited",
    }, { onConflict: "id" });

    if (profErr) {
      return NextResponse.json({ error: `Kullanıcı oluşturuldu ancak profil bağlanamadı: ${profErr.message}` }, { status: 500 });
    }

    await logActivity({
      agencyId, actorId: auth.caller.userId,
      action: "create", entityType: "user", entityId: newUserId,
      summary: `Personel davet edildi: ${email}`,
      metadata: { agency_role: agencyRole },
    });

    return NextResponse.json({ ok: true, userId: newUserId, inviteLink });
  } catch (err) {
    console.error("[api/admin/agencies/[id]/users POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
