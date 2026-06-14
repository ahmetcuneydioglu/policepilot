/**
 * POST /api/customers
 * Server-side customer creation with limit enforcement.
 * Auth: reads session cookie via @supabase/ssr.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canAddCustomer, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";
import { logActivity } from "@/lib/activity";
import { resolveCaller, requirePermission } from "../whatsapp/_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, phone, email, insurance_type, note,
      identity_no, vehicle_plate, policy_end_date,
      extra_data, agency_id,
      // Poliçe bilgileri (gerçek poliçeden)
      policy_no, insurance_company, premium, policy_start_date,
    } = body;

    if (!name?.trim() || !phone?.trim() || !insurance_type) {
      return NextResponse.json({ error: "Ad, telefon ve sigorta türü zorunludur." }, { status: 400 });
    }

    // ── Verify caller session ─────────────────────────────────────────────
    const cookieHeader = request.headers.get("cookie") ?? "";
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieHeader.split(";").map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
          },
          setAll() {/* read-only in API route */},
        },
      }
    );

    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    // ── Yetki kontrolü ───────────────────────────────────────────────────────
    const caller = await resolveCaller(request);
    if (caller) {
      const denied = requirePermission(caller, "customer.edit");
      if (denied) return denied;
    }

    // ── Admin client ───────────────────────────────────────────────────────
    const admin = getSupabaseAdmin();

    // ── Agency: client göndermediyse profilden çöz ─────────────────────────
    // (AuthContext profili geç yüklenirse client null gönderebiliyor)
    let resolvedAgencyId: string | null = agency_id ?? null;
    if (!resolvedAgencyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (admin.from("profiles") as any)
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      resolvedAgencyId = prof?.agency_id ?? null;
    }
    if (!resolvedAgencyId) {
      return NextResponse.json(
        { error: "Acente bilgisi bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin." },
        { status: 400 }
      );
    }

    const limitCheck = await canAddCustomer(admin, resolvedAgencyId);

    if (!limitCheck.isActive) {
      return NextResponse.json({ error: INACTIVE_MESSAGE, code: "inactive" }, { status: 403 });
    }
    if (!limitCheck.ok) {
      return NextResponse.json({
        error: limitMessage("customer"),
        code: "limit_exceeded",
        current: limitCheck.current,
        max: limitCheck.max,
      }, { status: 403 });
    }

    // ── Insert customer ────────────────────────────────────────────────────
    const payload = {
      name:           name.trim(),
      phone:          phone.trim(),
      email:          email?.trim() || null,
      insurance_type,
      note:           note?.trim() || null,
      identity_no:    identity_no?.trim() || null,
      vehicle_plate:  vehicle_plate?.trim()?.toUpperCase() || null,
      policy_end_date:policy_end_date || null,
      extra_data:     extra_data ?? {},
      agency_id:      resolvedAgencyId,
      created_by:     user.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer, error: customerErr } = await (admin.from("customers") as any)
      .insert(payload).select("id").single();

    if (customerErr) {
      console.error("[API /api/customers] insert error:", customerErr);
      return NextResponse.json({ error: customerErr.message }, { status: 500 });
    }

    // ── Optionally create policy record ───────────────────────────────────
    // Gerçek poliçeden gelen alanlar da kaydedilir (poliçe no, şirket, prim).
    let policyId: string | null = null;
    if (policy_end_date && customer?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pol, error: polErr } = await (admin.from("policies") as any).insert({
        customer_id:       customer.id,
        agency_id:         resolvedAgencyId,
        policy_type:       insurance_type,
        start_date:        policy_start_date || new Date().toISOString().split("T")[0],
        end_date:          policy_end_date,
        status:            "Aktif",
        policy_no:         policy_no?.trim() || null,
        insurance_company: insurance_company?.trim() || null,
        premium:           premium != null && premium !== "" ? Number(premium) : null,
        source:            "manual",
        created_by:        user.id,
      }).select("id").single();
      if (polErr) console.error("[API /api/customers] policy insert error:", polErr.message);
      policyId = pol?.id ?? null;
      if (policyId) {
        await logActivity({
          agencyId: resolvedAgencyId, actorId: user.id,
          action: "create", entityType: "policy", entityId: policyId,
          summary: `Poliçe kaydı: ${insurance_type}${policy_no ? ` (${policy_no})` : ""}`,
        });
      }
    }

    await logActivity({
      agencyId: resolvedAgencyId, actorId: user.id,
      action: "create", entityType: "customer", entityId: customer?.id ?? null,
      summary: `Müşteri eklendi: ${name.trim()}`,
    });

    return NextResponse.json({ ok: true, customerId: customer?.id, policyId });
  } catch (err: unknown) {
    console.error("[API /api/customers] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
