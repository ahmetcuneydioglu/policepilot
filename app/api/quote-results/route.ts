/**
 * POST /api/quote-results — teklif sonucu ekle
 */

import { NextResponse }       from "next/server";
import type { NextRequest }   from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin }   from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quote_run_id, company_name, price, installment, note } = body;

    if (!quote_run_id || !company_name) {
      return NextResponse.json({ error: "quote_run_id ve şirket adı zorunludur." }, { status: 400 });
    }

    const cookieHeader = request.headers.get("cookie") ?? "";
    const session = createServerClient(
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

    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("quote_results") as any)
      .insert({
        quote_run_id,
        company_name,
        price:       price ? parseFloat(String(price)) : null,
        installment: installment ?? "Peşin",
        note:        note ?? null,
        status:      "Aktif",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, resultId: data.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
