/**
 * GET    /api/quote-runs/[id]  — tek çalışma + sonuçlar
 * PATCH  /api/quote-runs/[id]  — durum güncelleme
 * DELETE /api/quote-runs/[id]  — silme
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin }   from "@/lib/supabase-admin";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

function sessionClient(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return createServerClient(
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
        setAll() {},
      },
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: { user } } = await sessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: run, error: runError } = await (admin.from("quote_runs") as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
    if (!run)     return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

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

    const { data: { user } } = await sessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const caller = await resolveCaller(request);
    if (caller) { const denied = requirePermission(caller, "quote.edit"); if (denied) return denied; }

    const admin = getSupabaseAdmin();

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
    if (status === "İptal") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: run } = await (admin.from("quote_runs") as any)
        .select("renewal_of_policy_id")
        .eq("id", id)
        .maybeSingle();

      if (run?.renewal_of_policy_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: polErr } = await (admin.from("policies") as any)
          .update({ renewal_status: "pending" })
          .eq("id", run.renewal_of_policy_id)
          .eq("renewal_status", "quoted"); // completed olanı geri alma
        if (polErr) console.error("[api/quote-runs/[id]] renewal reset FAILED:", polErr.message);
      }
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

    const { data: { user } } = await sessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const caller = await resolveCaller(request);
    if (caller) { const denied = requirePermission(caller, "quote.delete"); if (denied) return denied; }

    const admin = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("quote_runs") as any).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
