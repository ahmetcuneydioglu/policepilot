/**
 * GET   /api/admin/plans — plan_catalog + addon_catalog (super_admin)
 * PATCH /api/admin/plans — plan veya eklenti güncelle (limit/fiyat/modül)
 *   Body: { type:"plan",  plan:"pro",      patch:{ monthly_price, base_users, ... } }
 *      veya { type:"addon", key:"addon_ai", patch:{ unit_price, grant_per_unit, is_active, label } }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";

const PLAN_NUM_FIELDS = [
  "monthly_price", "base_users", "base_customers", "base_requests",
  "base_policies", "base_storage_mb", "base_ai_credits", "base_wa_monthly",
];
const ADDON_NUM_FIELDS = ["unit_price", "grant_per_unit", "sort_order"];

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;
  try {
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [planRes, addonRes] = await Promise.all([
      (admin.from("plan_catalog") as any).select("*").order("monthly_price", { ascending: true }),
      (admin.from("addon_catalog") as any).select("*").order("sort_order", { ascending: true }),
    ]);
    return NextResponse.json({ plans: planRes.data ?? [], addons: addonRes.data ?? [] });
  } catch (err) {
    console.error("[api/admin/plans GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const admin = getSupabaseAdmin();

    if (body.type === "plan" && typeof body.plan === "string") {
      const patch: Record<string, unknown> = {};
      for (const f of PLAN_NUM_FIELDS) {
        if (body.patch?.[f] != null) {
          const n = parseInt(String(body.patch[f]), 10);
          if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `${f} sayısal olmalı.` }, { status: 400 });
          patch[f] = n;
        }
      }
      if (typeof body.patch?.label === "string" && body.patch.label.trim()) patch.label = body.patch.label.trim();
      if (Array.isArray(body.patch?.modules)) patch.modules = body.patch.modules;
      if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
      patch.updated_at = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin.from("plan_catalog") as any).update(patch).eq("plan", body.plan);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.type === "addon" && typeof body.key === "string") {
      const patch: Record<string, unknown> = {};
      for (const f of ADDON_NUM_FIELDS) {
        if (body.patch?.[f] != null) {
          const n = parseInt(String(body.patch[f]), 10);
          if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `${f} sayısal olmalı.` }, { status: 400 });
          patch[f] = n;
        }
      }
      if (typeof body.patch?.label === "string" && body.patch.label.trim()) patch.label = body.patch.label.trim();
      if (typeof body.patch?.unit_label === "string") patch.unit_label = body.patch.unit_label.trim();
      if (typeof body.patch?.is_active === "boolean") patch.is_active = body.patch.is_active;
      if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin.from("addon_catalog") as any).update(patch).eq("key", body.key);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz istek (type plan|addon)." }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/plans PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
