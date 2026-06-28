/**
 * POST /api/muayene/backfill — eski araç müşterileri için TAHMİNİ muayene doldur.
 *
 * Muayenesi boş + araç bilgisi (vehicle_year) olan müşterilerde, model yılından
 * (tescil ≈ {yıl}-01-01) muayene tarihini tahmin edip yazar ve muayene_tahmini=true
 * işaretler. Mevcut/teyitli tarihleri ASLA ezmez (yalnız muayene_bitis null olanlar).
 *
 * Acente kapsamlı (manager): caller.agencyId. Super admin: body.agency_id.
 * Yetki: customer.edit.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";
import { computeMuayeneBitis } from "@/lib/muayene";

export const maxDuration = 60;

/** "2006", "2006 Model", "Model: 2018" → 2006/2018; geçersiz → null. */
function yearFrom(v: unknown): number | null {
  const m = String(v ?? "").match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number(m[0]);
  const now = new Date().getUTCFullYear();
  return y >= 1950 && y <= now + 1 ? y : null;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "customer.edit");
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const agencyId = caller.role === "super_admin"
      ? (typeof body.agency_id === "string" ? body.agency_id : null)
      : caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bilgisi gerekli." }, { status: 400 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("customers") as any)
      .select("id, vehicle_plate, extra_data, muayene_bitis")
      .eq("agency_id", agencyId)
      .is("muayene_bitis", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let updated = 0;
    let skipped = 0;
    for (const c of (data ?? []) as { id: string; vehicle_plate: string | null; extra_data: Record<string, string> | null }[]) {
      const extra = c.extra_data ?? {};
      const year = yearFrom(extra.vehicle_year);
      const hasVehicle = Boolean(c.vehicle_plate || extra.vehicle_plate);
      if (!year || !hasVehicle) { skipped++; continue; }

      const muayene = computeMuayeneBitis(`${year}-01-01`, extra.vehicle_usage ?? null);
      if (!muayene) { skipped++; continue; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upErr } = await (admin.from("customers") as any)
        .update({ muayene_bitis: muayene, muayene_tahmini: true })
        .eq("id", c.id)
        .is("muayene_bitis", null); // yarış güvenli — bu arada elle girildiyse ezme
      if (upErr) { skipped++; continue; }
      updated++;
    }

    return NextResponse.json({ ok: true, updated, skipped });
  } catch (err) {
    console.error("[muayene/backfill]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
