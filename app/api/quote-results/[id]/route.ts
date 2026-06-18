/**
 * PATCH /api/quote-results/[id]  — durum güncelleme (Seçildi / Aktif)
 * DELETE /api/quote-results/[id] — silme
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin }   from "@/lib/supabase-admin";
import { resolveCaller, requirePermission, type ApiCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

// caller, quote_result'ın bağlı olduğu run'a sahip mi? (super_admin / acente / kişi-scope)
function ownsRun(caller: ApiCaller, run: { agency_id: string | null; created_by?: string | null }): boolean {
  if (caller.role === "super_admin") return true;
  if (run.agency_id !== caller.agencyId) return false;
  if (!isManagerial(caller.agencyRole) && run.created_by !== caller.userId) return false;
  return true;
}

// quote_result → bağlı run'ı yükleyip sahiplik doğrular (IDOR koruması).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callerOwnsResult(admin: any, caller: ApiCaller, resultId: string): Promise<boolean> {
  const { data: row } = await admin.from("quote_results").select("quote_run_id").eq("id", resultId).maybeSingle();
  if (!row) return false;
  const { data: run } = await admin.from("quote_runs").select("agency_id, created_by").eq("id", row.quote_run_id).maybeSingle();
  return !!run && ownsRun(caller, run);
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json();
    const { status } = body;

    const { data: { user } } = await sessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "quote.edit");
    if (denied) return denied;

    const admin = getSupabaseAdmin();

    // Tenant/kişi izolasyonu (IDOR): bağlı run'ın acentesi/sahibi
    if (!(await callerOwnsResult(admin, caller, id))) {
      return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("quote_results") as any)
      .update({ status })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "quote.delete");
    if (denied) return denied;

    const admin = getSupabaseAdmin();

    // Tenant/kişi izolasyonu (IDOR)
    if (!(await callerOwnsResult(admin, caller, id))) {
      return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("quote_results") as any).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
