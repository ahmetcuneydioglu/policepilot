/**
 * GET  /api/quote-runs          — liste (service role, RLS bypass)
 * POST /api/quote-runs          — oluşturma
 * Agency_user ve super_admin için çalışır.
 */

import { NextResponse }          from "next/server";
import type { NextRequest }      from "next/server";
import { createServerClient }    from "@supabase/ssr";
import { getSupabaseAdmin }      from "@/lib/supabase-admin";
import { logActivity }           from "@/lib/activity";
import { resolveCaller, requirePermission } from "../whatsapp/_lib/auth";
import { scopeByUser } from "@/lib/tenant";

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

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const renewal_of_policy_id = searchParams.get("renewal_of_policy_id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin.from("quote_runs") as any)
      .select("*, quote_results(id, price)")
      .order("created_at", { ascending: false });

    // Kapsam: agency_user kendi acentesi; non-managerial yalnız kendi created_by.
    // super_admin acente parametresine göre filtreleyebilir.
    if (caller.role === "agency_user") {
      query = query.eq("agency_id", caller.agencyId ?? "00000000-0000-0000-0000-000000000000");
      if (scopeByUser(caller)) query = query.eq("created_by", caller.userId);
    } else {
      const agency_id = searchParams.get("agency_id");
      if (agency_id) query = query.eq("agency_id", agency_id);
    }
    if (renewal_of_policy_id) {
      query = query.eq("renewal_of_policy_id", renewal_of_policy_id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ runs: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      agency_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_tc,
      product_type,
      product_data,
      notes,
      // Engine v2 fields
      provider_type,     // demo | manual | api | robot | gateway
      success_count,     // integer
      error_count,       // integer
      // Yeni müşteri oluşturmak için
      create_customer,   // boolean
      // Şirket teklifleri
      results,           // Array<{ company_name, price, installment, note, status, source_type, ... }>
      // Yenileme akışı: bu run hangi poliçenin yenilemesi?
      renewal_of_policy_id,
    } = body;

    // ── Oturum doğrulama ──────────────────────────────────────────────────
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
          setAll() { /* read-only in API route */ },
        },
      }
    );

    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    }

    // ── Yetki kontrolü ────────────────────────────────────────────────────
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "quote.create");
    if (denied) return denied;

    // ── Service role client (RLS bypass) ──────────────────────────────────
    const admin = getSupabaseAdmin();

    // ── Agency: tenant izolasyonu — body'ye GÜVENİLMEZ. ────────────────────
    // agency_user daima KENDİ acentesine yazar; yalnız super_admin body verebilir.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvedAgencyId: string | null =
      caller.role === "super_admin" ? (agency_id ?? null) : (caller.agencyId ?? null);
    if (!resolvedAgencyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (admin.from("profiles") as any)
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      resolvedAgencyId = prof?.agency_id ?? null;
    }

    // ── Temel doğrulama ───────────────────────────────────────────────────
    if (!resolvedAgencyId) {
      return NextResponse.json(
        { error: "Acente bilgisi bulunamadı. Lütfen tekrar giriş yapın." },
        { status: 400 }
      );
    }
    if (!product_type) {
      return NextResponse.json(
        { error: "Sigorta türü seçilmedi." },
        { status: 400 }
      );
    }
    if (!customer_name?.trim() && !customer_id) {
      return NextResponse.json(
        { error: "Müşteri bilgisi gerekli." },
        { status: 400 }
      );
    }

    // ── Gerekirse yeni müşteri oluştur ────────────────────────────────────
    let resolvedCustomerId = customer_id || null;

    if (create_customer && customer_name?.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newCustomer, error: custErr } = await (admin.from("customers") as any)
        .insert({
          agency_id: resolvedAgencyId,
          name:           customer_name.trim(),
          phone:          customer_phone?.trim() || "",
          insurance_type: product_type,
          note:           null,
          created_by:     user.id,
        })
        .select("id")
        .single();

      if (custErr) {
        console.error("[api/quote-runs] customer insert error:", custErr);
        return NextResponse.json({ error: custErr.message }, { status: 500 });
      }
      resolvedCustomerId = newCustomer.id;
    }

    // ── quote_run ekle ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: run, error: runErr } = await (admin.from("quote_runs") as any)
      .insert({
        agency_id:      resolvedAgencyId,
        customer_id:    resolvedCustomerId,
        product_type,
        product_data:   product_data ?? {},
        customer_name:  customer_name?.trim() || null,
        customer_phone: customer_phone?.trim() || null,
        customer_email: customer_email?.trim() || null,
        customer_tc:    customer_tc?.trim() || null,
        notes:          notes?.trim() || null,
        status:         "Yeni",
        // Engine v2
        provider_type:   provider_type  ?? "demo",
        success_count:   success_count  ?? 0,
        error_count:     error_count    ?? 0,
        run_started_at:  new Date().toISOString(),
        run_finished_at: new Date().toISOString(),
        // Yenileme ilişkisi
        renewal_of_policy_id: renewal_of_policy_id ?? null,
        created_by:      user.id,
      })
      .select("id")
      .single();

    if (runErr) {
      console.error("[api/quote-runs] run insert error:", runErr);
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    await logActivity({
      agencyId: resolvedAgencyId, actorId: user.id,
      action: "create", entityType: "quote_run", entityId: run.id,
      summary: `Teklif çalışıldı: ${product_type}${customer_name ? ` — ${customer_name}` : ""}`,
    });

    // ── Yenileme akışı: eski poliçeyi "quoted" işaretle ───────────────────
    if (renewal_of_policy_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: renErr } = await (admin.from("policies") as any)
        .update({ renewal_status: "quoted" })
        .eq("id", renewal_of_policy_id)
        .neq("renewal_status", "completed"); // tamamlanmışı geri alma
      if (renErr) console.warn("[api/quote-runs] renewal_status update warning:", renErr.message);
    }

    // ── quote_results ekle (varsa) ────────────────────────────────────────
    if (Array.isArray(results) && results.length > 0) {
      const resultRows = results.map((r: {
        company_name:  string;
        price?:        number | null;
        installment?:  string;
        note?:         string;
        status?:       string;
        source_type?:  string;
        provider_name?: string;
        error_source?: string | null;
        error_code?:   string | null;
        error_message?: string | null;
        action_hint?:  string | null;
        raw_response?: Record<string, unknown>;
      }) => ({
        quote_run_id:  run.id,
        company_name:  r.company_name,
        price:         r.price ?? null,
        installment:   r.installment ?? "Peşin",
        note:          r.note ?? null,
        status:        r.status ?? "Aktif",
        // Engine v2
        source_type:   r.source_type   ?? "demo",
        provider_name: r.provider_name ?? null,
        error_source:  r.error_source  ?? null,
        error_code:    r.error_code    ?? null,
        error_message: r.error_message ?? null,
        action_hint:   r.action_hint   ?? null,
        raw_response:  r.raw_response  ?? {},
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: resErr } = await (admin.from("quote_results") as any)
        .insert(resultRows);

      if (resErr) {
        console.error("[api/quote-runs] results insert error:", resErr);
        // quote_run oluştu ama results hata verdi — run'ı döndür, frontend devam etsin
        return NextResponse.json(
          { ok: true, runId: run.id, resultsError: resErr.message },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ ok: true, runId: run.id });

  } catch (err: unknown) {
    console.error("[api/quote-runs] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
