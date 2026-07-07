/**
 * PORTFÖY — tek iş (deal) API.
 * PATCH /api/portfolio/[id] — aşama/alan güncelleme, Kaybedildi çıkışı, geri açma.
 * Aşama geçiş logu DB trigger'ında (deal_stage_log) — burada yalnız updated_by taşınır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";
import { isValidDealStage, PORTFOLIO_PRODUCTS, LOST_REASONS } from "@/lib/portfolio";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (caller.status === "suspended" || caller.agencyRole === "viewer") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const { id } = await params;
    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal } = await (admin.from("deals") as any)
      .select("id, agency_id, owner_id").eq("id", id).maybeSingle();
    if (!deal) return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 });
    if (caller.role !== "super_admin" && deal.agency_id !== caller.agencyId) {
      return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 });
    }
    if (!managerial && deal.owner_id !== caller.userId) {
      return NextResponse.json({ error: "Yalnız kendi işlerinizi güncelleyebilirsiniz." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { updated_by: caller.userId };

    if (typeof body.stage === "string") {
      if (!isValidDealStage(body.stage)) return NextResponse.json({ error: "Geçersiz aşama." }, { status: 400 });
      patch.stage = body.stage;
    }
    if (body.status === "lost") {
      const reason = LOST_REASONS.some((r) => r.key === body.lost_reason) ? body.lost_reason : "diger";
      patch.status = "lost";
      patch.lost_reason = reason;
    } else if (body.status === "open") {
      patch.status = "open"; // kayıptan geri açma — trigger lost_reason/closed_at'i temizler
    }
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.product_interest === "string" && (PORTFOLIO_PRODUCTS as readonly string[]).includes(body.product_interest)) {
      patch.product_interest = body.product_interest;
    }
    if ("expected_premium" in body) {
      patch.expected_premium = typeof body.expected_premium === "number" && Number.isFinite(body.expected_premium)
        ? body.expected_premium : null;
    }
    if ("note" in body) patch.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (typeof body.source === "string" && body.source) patch.source = body.source;
    if (typeof body.policy_id === "string" && body.policy_id) patch.policy_id = body.policy_id;

    // Sahip değişimi: yalnız yönetici; owner_name denormalize güncellenir
    if (managerial && typeof body.owner_id === "string" && body.owner_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (admin.from("profiles") as any)
        .select("full_name").eq("id", body.owner_id).maybeSingle();
      patch.owner_id = body.owner_id;
      patch.owner_name = prof?.full_name ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("deals") as any).update(patch).eq("id", id);
    if (error) {
      console.error("[API /api/portfolio PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /api/portfolio PATCH]", e);
    return NextResponse.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}
