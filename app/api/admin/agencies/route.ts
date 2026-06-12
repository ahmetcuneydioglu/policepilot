/**
 * GET /api/admin/agencies — kurumsal data grid satırları (yalnız super_admin)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSuperAdmin } from "../_lib/auth";
import { collectPlatformData } from "../_lib/stats";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const data = await collectPlatformData();

    const rows = data.perAgency.map(s => ({
      id:              s.agency.id,
      logo_url:        s.agency.logo_url,
      name:            s.agency.name,
      slug:            s.agency.slug,
      plan:            s.agency.plan,
      is_active:       s.agency.is_active,
      users:           s.users,
      customers:       s.customers,
      quotes:          s.quotes,
      policies:        s.policies,
      whatsapp:        s.whatsapp_total,
      monthly_revenue: s.monthly_revenue,
      last_activity:   s.last_activity,
      created_at:      s.agency.created_at,
      limit_usage:     Math.round(s.max_limit_usage * 100),
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[api/admin/agencies]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
