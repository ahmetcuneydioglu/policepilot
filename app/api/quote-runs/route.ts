/**
 * GET  /api/quote-runs          — liste (service role, RLS bypass)
 * POST /api/quote-runs          — oluşturma
 * Agency_user ve super_admin için çalışır.
 */

import { NextResponse }          from "next/server";
import type { NextRequest }      from "next/server";
import { createServerClient }    from "@supabase/ssr";
import { getSupabaseAdmin }      from "@/lib/supabase-admin";

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
    const { data: { user } } = await sessionClient(request).auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const agency_id = searchParams.get("agency_id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin.from("quote_runs") as any)
      .select("*, quote_results(id, price)")
      .order("created_at", { ascending: false });

    if (agency_id) {
      query = query.eq("agency_id", agency_id);
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
      // Yeni müşteri oluşturmak için
      create_customer,   // boolean
      // Şirket teklifleri
      results,           // Array<{ company_name, price, installment, note, status }>
    } = body;

    // ── Temel doğrulama ───────────────────────────────────────────────────
    if (!agency_id) {
      return NextResponse.json(
        { error: "Acente bilgisi eksik. Lütfen tekrar giriş yapın." },
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

    // ── Service role client (RLS bypass) ──────────────────────────────────
    const admin = getSupabaseAdmin();

    // ── Gerekirse yeni müşteri oluştur ────────────────────────────────────
    let resolvedCustomerId = customer_id || null;

    if (create_customer && customer_name?.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newCustomer, error: custErr } = await (admin.from("customers") as any)
        .insert({
          agency_id,
          name:           customer_name.trim(),
          phone:          customer_phone?.trim() || "",
          insurance_type: product_type,
          note:           null,
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
        agency_id,
        customer_id:    resolvedCustomerId,
        product_type,
        product_data:   product_data ?? {},
        customer_name:  customer_name?.trim() || null,
        customer_phone: customer_phone?.trim() || null,
        customer_email: customer_email?.trim() || null,
        customer_tc:    customer_tc?.trim() || null,
        notes:          notes?.trim() || null,
        status:         "Yeni",
      })
      .select("id")
      .single();

    if (runErr) {
      console.error("[api/quote-runs] run insert error:", runErr);
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    // ── quote_results ekle (varsa) ────────────────────────────────────────
    if (Array.isArray(results) && results.length > 0) {
      const resultRows = results.map((r: {
        company_name: string;
        price?: number | null;
        installment?: string;
        note?: string;
        status?: string;
      }) => ({
        quote_run_id:  run.id,
        company_name:  r.company_name,
        price:         r.price ?? null,
        installment:   r.installment ?? "Peşin",
        note:          r.note ?? null,
        status:        r.status ?? "Aktif",
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
