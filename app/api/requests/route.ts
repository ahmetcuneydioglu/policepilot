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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: reqErr } = await (admin.from("requests") as any).insert({
      customer_id,
      request_type,
      status:      "Yeni",
      price_offer: price_offer ? parseFloat(price_offer) : null,
      agency_id,
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
