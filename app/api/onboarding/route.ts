/**
 * GET /api/onboarding — yeni acente kurulum checklist durumu.
 * Yalnız owner/manager; service-role ile kesin sayımlar (RLS'den bağımsız).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const agencyId = caller.agencyId;
    if (!agencyId || (caller.role !== "super_admin" && !isManagerial(caller.agencyRole))) {
      return NextResponse.json({ show: false });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = (table: string) => (admin.from(table) as any).select("id", { count: "exact", head: true }).eq("agency_id", agencyId);

    const [cust, pol, req, prof, wa] = await Promise.all([
      count("customers"), count("policies"), count("requests"), count("profiles"), count("whatsapp_queue"),
    ]);

    return NextResponse.json({
      show: true,
      customer:    (cust.count ?? 0) > 0,
      policy:      (pol.count ?? 0) > 0,
      opportunity: (req.count ?? 0) > 0,
      team:        (prof.count ?? 0) > 1,   // owner + en az bir personel
      whatsapp:    (wa.count ?? 0) > 0,      // WhatsApp kurulup en az bir mesaj kuyruğa girmiş
    });
  } catch (err) {
    console.error("[api/onboarding]", err);
    return NextResponse.json({ show: false });
  }
}
