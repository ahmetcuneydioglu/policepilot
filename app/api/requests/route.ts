/**
 * POST /api/requests
 * Server-side request creation with limit enforcement.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canAddRequest, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, request_type, price_offer, agency_id } = body;

    if (!customer_id || !request_type) {
      return NextResponse.json({ error: "Müşteri ve talep türü zorunludur." }, { status: 400 });
    }
    if (!agency_id) {
      return NextResponse.json({ error: "agency_id gerekli." }, { status: 400 });
    }

    // ── Verify caller session ─────────────────────────────────────────────
    const cookieHeader = request.headers.get("cookie") ?? "";
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieHeader.split(";").map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
          },
          setAll() {/* read-only */},
        },
      }
    );

    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    // ── Limit check ───────────────────────────────────────────────────────
    const admin = getSupabaseAdmin();
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

    // ── Insert ────────────────────────────────────────────────────────────
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
