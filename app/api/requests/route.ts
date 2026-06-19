/**
 * POST /api/requests — talep oluşturma (limit + sahiplik kontrolü).
 *
 * Güvenlik: agency_id body'den ALINMAZ — talep, caller'ın erişebildiği müşterinin
 * acentesine yazılır. Müşteri sahipliği (IDOR) doğrulanır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canAddRequest, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

/**
 * GET /api/requests — caller'ın scope'undaki satış fırsatları + atama üyeleri.
 * Yönetici (owner/manager): acentenin tüm fırsatları. Diğer: kendine atanan.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const agencyId = caller.agencyId;
    if (!agencyId) {
      return NextResponse.json({ opportunities: [], members: [], selfId: caller.userId, managerial: false });
    }

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (admin.from("requests") as any)
      .select("id, customer_id, request_type, status, price_offer, created_at, updated_at, assigned_to, created_by, next_follow_up_date, notes, policy_id, customers(name, phone, email, identity_no, insurance_type)")
      .eq("agency_id", agencyId)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (!managerial) q = q.eq("assigned_to", caller.userId);

    // Atama için acente üyeleri (yalnız yönetici atayabilir)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersQ = (admin.from("profiles") as any)
      .select("id, full_name, agency_role")
      .eq("agency_id", agencyId)
      .order("full_name");

    const [reqRes, memRes] = await Promise.all([q, membersQ]);
    if (reqRes.error) {
      console.error("[API /api/requests GET]", reqRes.error);
      return NextResponse.json({ error: reqRes.error.message }, { status: 500 });
    }

    const members = (memRes.data ?? []) as { id: string; full_name: string | null; agency_role: string | null }[];
    const nameById = new Map(members.map((m) => [m.id, m.full_name ?? "İsimsiz"]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opportunities = (reqRes.data ?? []).map((r: any) => ({
      ...r,
      assigned_name: r.assigned_to ? nameById.get(r.assigned_to) ?? null : null,
    }));

    return NextResponse.json({
      opportunities,
      members: members.map((m) => ({ id: m.id, full_name: m.full_name ?? "İsimsiz" })),
      selfId: caller.userId,
      managerial,
    });
  } catch (err) {
    console.error("[API /api/requests GET] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, request_type, price_offer } = body;

    if (!customer_id || !request_type) {
      return NextResponse.json({ error: "Müşteri ve talep türü zorunludur." }, { status: 400 });
    }

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();

    // ── Müşteri sahipliği (IDOR) + agency_id'yi müşteriden türet ───────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cust } = await (admin.from("customers") as any)
      .select("agency_id, created_by").eq("id", customer_id).maybeSingle();
    if (!cust) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    if (caller.role !== "super_admin") {
      const sameAgency = cust.agency_id === caller.agencyId;
      const ownsCustomer = isManagerial(caller.agencyRole) || cust.created_by === caller.userId;
      if (!sameAgency || !ownsCustomer) {
        return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
      }
    }
    const agency_id: string | null = cust.agency_id ?? null;
    if (!agency_id) return NextResponse.json({ error: "Müşterinin acentesi tanımsız." }, { status: 400 });

    // ── Limit kontrolü (müşterinin acentesi üzerinden) ─────────────────────
    const limitCheck = await canAddRequest(admin, agency_id);
    if (!limitCheck.isActive) {
      return NextResponse.json({ error: INACTIVE_MESSAGE, code: "inactive" }, { status: 403 });
    }
    if (!limitCheck.ok) {
      return NextResponse.json({
        error: limitMessage("request"),
        code: "limit_exceeded",
        current: limitCheck.current,
        max: limitCheck.max,
      }, { status: 403 });
    }

    // ── Insert ──────────────────────────────────────────────────────────────
    // assigned_to: yönetici başkasına atayabilir (body.assigned_to); aksi halde
    // fırsat oluşturana (created_by) atanır.
    const assigned_to =
      isManagerial(caller.agencyRole) && typeof body.assigned_to === "string"
        ? body.assigned_to
        : caller.userId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: reqErr } = await (admin.from("requests") as any).insert({
      customer_id,
      request_type,
      status:      "Yeni Lead",
      price_offer: price_offer ? parseFloat(price_offer) : null,
      agency_id,
      created_by:  caller.userId,
      assigned_to,
    }).select("id").single();

    if (reqErr) {
      console.error("[API /api/requests] insert error:", reqErr);
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requestId: data?.id });
  } catch (err: unknown) {
    console.error("[API /api/requests] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
