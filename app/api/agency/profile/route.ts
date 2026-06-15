/**
 * GET   /api/agency/profile — çağıranın KENDİ acente profilini döndürür
 * PATCH /api/agency/profile — şirket bilgilerini günceller (settings.manage)
 *
 * Acente sahibi/yöneticisi kendi şirket bilgisini Ayarlar > Şirket Bilgileri'nden
 * düzenler. İşlem yalnız `caller.agencyId` ile sınırlıdır.
 * GÜVENLİK: slug, plan, limitler, is_active BU ENDPOINT'TEN değişmez (admin işi).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

const SELECT = "id, name, slug, phone, email, website, logo_url, primary_color, tax_no, address, city, plan, is_active";

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("agencies") as any)
      .select(SELECT).eq("id", caller.agencyId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Acente bulunamadı." }, { status: 404 });

    return NextResponse.json({ agency: data });
  } catch (err) {
    console.error("[api/agency/profile GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "settings.manage");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const body = await request.json();
    const update: Record<string, unknown> = {};
    // Yalnız düzenlenebilir şirket profili alanları
    for (const key of ["name", "phone", "email", "website", "tax_no", "address", "city"] as const) {
      if (typeof body[key] === "string") update[key] = body[key].trim() || null;
    }
    if (typeof body.primary_color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primary_color)) {
      update.primary_color = body.primary_color;
    }
    // Ad gönderildiyse boş olamaz
    if ("name" in update && update.name === null) {
      return NextResponse.json({ error: "Acente adı boş olamaz." }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("agencies") as any)
      .update(update).eq("id", caller.agencyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/agency/profile PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
