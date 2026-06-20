/**
 * GET    /api/quote-runs/[id]  — tek çalışma + sonuçlar
 * PATCH  /api/quote-runs/[id]  — durum güncelleme
 * DELETE /api/quote-runs/[id]  — silme
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { getSupabaseAdmin }   from "@/lib/supabase-admin";
import { resolveCaller, requirePermission, type ApiCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

// caller hedef quote_run'a sahip mi? (super_admin / aynı acente / kişi-scope created_by)
function ownsRun(caller: ApiCaller, run: { agency_id: string | null; created_by?: string | null }): boolean {
  if (caller.role === "super_admin") return true;
  if (run.agency_id !== caller.agencyId) return false;
  if (!isManagerial(caller.agencyRole) && run.created_by !== caller.userId) return false;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: run, error: runError } = await (admin.from("quote_runs") as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
    if (!run)     return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    // Tenant/kişi izolasyonu (IDOR): başka acentenin/personelin çalışması okunamaz.
    if (!ownsRun(caller, run)) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: results, error: resError } = await (admin.from("quote_results") as any)
      .select("*")
      .eq("quote_run_id", id)
      .order("price", { ascending: true });

    if (resError) return NextResponse.json({ error: resError.message }, { status: 500 });

    return NextResponse.json({ run, results: results ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json();
    const { status, won_result_id } = body;

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "quote.edit");
    if (denied) return denied;

    const admin = getSupabaseAdmin();

    // Sahiplik doğrulaması (IDOR) — güncellemeden ÖNCE; renewal alanını da burada al.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin.from("quote_runs") as any)
      .select("agency_id, created_by, renewal_of_policy_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    if (!ownsRun(caller, existing)) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

    const update: Record<string, string | null> = {};
    if (status)         update.status         = status;
    if (won_result_id !== undefined) update.won_result_id = won_result_id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("quote_runs") as any)
      .update(update)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Yenileme akışı: run iptal edildiyse eski poliçeyi "pending"e döndür ──
    // Acente aynı müşteri için yeniden teklif çalışabilir hale gelir.
    if (status === "İptal" && existing.renewal_of_policy_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: polErr } = await (admin.from("policies") as any)
        .update({ renewal_status: "pending" })
        .eq("id", existing.renewal_of_policy_id)
        .eq("renewal_status", "quoted"); // completed olanı geri alma
      if (polErr) console.error("[api/quote-runs/[id]] renewal reset FAILED:", polErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "quote.delete");
    if (denied) return denied;

    const admin = getSupabaseAdmin();

    // Sahiplik doğrulaması (IDOR) — silmeden önce
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin.from("quote_runs") as any)
      .select("agency_id, created_by").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    if (!ownsRun(caller, existing)) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("quote_runs") as any).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
