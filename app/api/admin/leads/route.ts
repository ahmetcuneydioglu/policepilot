/**
 * GET  /api/admin/leads — kanban lead listesi
 * POST /api/admin/leads — yeni lead
 * (yalnız super_admin; tablo: platform_leads)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";

export const LEAD_STATUSES = ["new", "contacted", "demo_planned", "demo_done", "proposal", "won", "lost"] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("platform_leads") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const hint = error.message.includes("platform_leads")
        ? " (platform_leads_migration.sql çalıştırıldı mı?)"
        : "";
      return NextResponse.json({ error: `${error.message}${hint}`, migration_required: true }, { status: 500 });
    }
    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    console.error("[api/admin/leads GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "İsim zorunlu." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("platform_leads") as any)
      .insert({
        name:    body.name.trim(),
        company: body.company?.trim() || null,
        phone:   body.phone?.trim() || null,
        email:   body.email?.trim() || null,
        source:  body.source?.trim() || null,
        note:    body.note?.trim() || null,
        status:  LEAD_STATUSES.includes(body.status) ? body.status : "new",
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ lead: data });
  } catch (err) {
    console.error("[api/admin/leads POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
