/**
 * GET /api/team/performance — acente owner/manager için ekip performansı.
 *
 * Kişi-bazlı veri yalnız yöneticiye (owner/manager) açılır; super_admin de erişebilir.
 * Hesap mantığı lib/performance (admin paneliyle tek kaynak); agency = caller'ın acentesi.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeAgencyPerformance } from "@/lib/performance";
import { isManagerial } from "@/lib/tenant";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    // Kişi-bazlı performans yalnız yöneticiye (owner/manager) ve super_admin'e açık.
    if (caller.role !== "super_admin" && !isManagerial(caller.agencyRole)) {
      return NextResponse.json({ error: "Bu görünüm için yetkiniz yok." }, { status: 403 });
    }
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const admin = getSupabaseAdmin();
    const data = await computeAgencyPerformance(admin, agencyId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/team/performance]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
