/**
 * GET /api/usage — çağıran acentenin kullanım/limit özeti
 *
 * Acente kendi panelinde kullanımını görür (ilerleme barları + uyarı).
 * Süper admin acenteye bağlı değilse boş döner.
 * Limit yorumu admin paneliyle aynı: users=profiles, customers, requests=quote_runs, policies.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAgencyLimits } from "@/lib/limits";
import { resolveCaller } from "../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ ok: true, agency: null });

    const admin = getSupabaseAdmin();
    const limits = await getAgencyLimits(admin, agencyId);
    if (!limits) return NextResponse.json({ ok: true, agency: null });

    const countRows = async (table: string): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (admin.from(table) as any)
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId);
      return count ?? 0;
    };

    const [users, customers, requests, policies] = await Promise.all([
      countRows("profiles"),
      countRows("customers"),
      countRows("quote_runs"),
      countRows("policies"),
    ]);

    return NextResponse.json({
      ok: true,
      agency: {
        plan: limits.plan,
        is_active: limits.is_active,
        limits: {
          users:     { used: users,     max: limits.max_users },
          customers: { used: customers, max: limits.max_customers },
          requests:  { used: requests,  max: limits.max_requests },
          policies:  { used: policies,  max: limits.max_policies },
        },
      },
    });
  } catch (err) {
    console.error("[api/usage]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
