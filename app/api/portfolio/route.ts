/**
 * PORTFÖY — Satış Hattı API.
 *
 * GET  /api/portfolio — caller scope'undaki işler (deals) + hesaplar + üyeler
 *                       + iş başına son temas (deal'e bağlı görüşme).
 * POST /api/portfolio — yeni iş. Güvenlik: agency_id body'den ALINMAZ; müşteri/hesap
 *                       sahipliği (IDOR) doğrulanır. Yönetici olmayan yalnız kendine açar.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";
import { isValidDealStage, PORTFOLIO_PRODUCTS } from "@/lib/portfolio";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const agencyId = caller.agencyId;
    if (!agencyId) {
      return NextResponse.json({ deals: [], accounts: [], members: [], selfId: caller.userId, managerial: caller.role === "super_admin" });
    }

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dealsQ = (admin.from("deals") as any)
      .select("*, customers(id, name, phone, title), accounts(id, name, kind)")
      .eq("agency_id", agencyId)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (!managerial) dealsQ = dealsQ.eq("owner_id", caller.userId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountsQ = (admin.from("accounts") as any)
      .select("*").eq("agency_id", agencyId).order("name");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersQ = (admin.from("profiles") as any)
      .select("id, full_name").eq("agency_id", agencyId).order("full_name");

    const [dealsRes, accRes, memRes] = await Promise.all([dealsQ, accountsQ, membersQ]);
    if (dealsRes.error) {
      console.error("[API /api/portfolio GET]", dealsRes.error);
      return NextResponse.json({ error: dealsRes.error.message }, { status: 500 });
    }

    // Son temas: işe bağlı görüşmelerin en yenisi (bayat iş uyarısı için)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals = (dealsRes.data ?? []) as any[];
    const lastTouch = new Map<string, string>();
    if (deals.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: touches } = await (admin.from("customer_interactions") as any)
        .select("deal_id, occurred_at")
        .eq("agency_id", agencyId)
        .not("deal_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(2000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (touches ?? []) as any[]) {
        if (t.deal_id && !lastTouch.has(t.deal_id)) lastTouch.set(t.deal_id, t.occurred_at);
      }
    }

    return NextResponse.json({
      deals: deals.map((d) => ({ ...d, last_touch_at: lastTouch.get(d.id) ?? null })),
      accounts: accRes.data ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members: ((memRes.data ?? []) as any[]).map((m) => ({ id: m.id, full_name: m.full_name ?? "İsimsiz" })),
      selfId: caller.userId,
      managerial,
    });
  } catch (e) {
    console.error("[API /api/portfolio GET]", e);
    return NextResponse.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (caller.status === "suspended" || caller.agencyRole === "viewer") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Bağlı acente bulunamadı." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "İş başlığı zorunludur." }, { status: 400 });

    const product = (PORTFOLIO_PRODUCTS as readonly string[]).includes(body?.product_interest)
      ? (body.product_interest as string) : "Diğer";
    const stage = typeof body?.stage === "string" && isValidDealStage(body.stage) ? body.stage : "lead";

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);

    // IDOR: müşteri/hesap caller'ın acentesine ait mi?
    const customerId = typeof body?.customer_id === "string" ? body.customer_id : null;
    if (customerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cust } = await (admin.from("customers") as any)
        .select("id").eq("id", customerId).eq("agency_id", agencyId).maybeSingle();
      if (!cust) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    }
    const accountId = typeof body?.account_id === "string" ? body.account_id : null;
    if (accountId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: acc } = await (admin.from("accounts") as any)
        .select("id").eq("id", accountId).eq("agency_id", agencyId).maybeSingle();
      if (!acc) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });
    }

    // Sahip: yönetici başkasına atayabilir, diğerleri kendine açar
    let ownerId = caller.userId;
    if (managerial && typeof body?.owner_id === "string" && body.owner_id) ownerId = body.owner_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ownerProf } = await (admin.from("profiles") as any)
      .select("full_name").eq("id", ownerId).maybeSingle();

    const premium = typeof body?.expected_premium === "number" && Number.isFinite(body.expected_premium)
      ? body.expected_premium : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal, error } = await (admin.from("deals") as any)
      .insert({
        agency_id: agencyId,
        account_id: accountId,
        customer_id: customerId,
        title,
        product_interest: product,
        stage,
        owner_id: ownerId,
        owner_name: ownerProf?.full_name ?? null,
        expected_premium: premium,
        currency: typeof body?.currency === "string" && body.currency ? body.currency : "TRY",
        source: typeof body?.source === "string" && body.source ? body.source : null,
        note: typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null,
        created_by: caller.userId,
        updated_by: caller.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[API /api/portfolio POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: deal.id });
  } catch (e) {
    console.error("[API /api/portfolio POST]", e);
    return NextResponse.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}
