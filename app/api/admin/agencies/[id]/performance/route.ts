/**
 * GET /api/admin/agencies/[id]/performance — kişi bazlı performans (yalnız super_admin).
 * Hesap mantığı lib/performance (acente-tarafı /api/team/performance ile TEK kaynak).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeAgencyPerformance } from "@/lib/performance";
import { requireSuperAdmin } from "../../../_lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const admin = getSupabaseAdmin();
    const data = await computeAgencyPerformance(admin, id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/agencies/[id]/performance]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
