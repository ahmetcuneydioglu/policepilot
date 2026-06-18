/**
 * GET /api/agency/members — acentenin kullanıcı listesi (id + ad).
 *
 * "Ekleyen" sütunu/filtresi için: müşteri listesinde created_by → kişi adı eşlemesi.
 * profiles SELECT RLS yalnız kendini okumaya izin verdiğinden client join yapamaz;
 * bu yüzden service-role ile döner. Yalnız managerial (owner/manager) erişir —
 * non-managerial zaten kendi kayıtlarını görür, eşlemeye ihtiyacı yok.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    // Yalnız managerial "ekleyen" haritasına ihtiyaç duyar; aksi halde boş dön.
    if (caller.role !== "super_admin" && !isManagerial(caller.agencyRole)) {
      return NextResponse.json({ members: [] });
    }
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ members: [] }); // super_admin acentesiz bağlam

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("profiles") as any)
      .select("id, full_name, agency_role")
      .eq("agency_id", agencyId)
      .order("full_name", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ members: data ?? [] });
  } catch (err) {
    console.error("[api/agency/members]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
