/**
 * POST /api/public/submit
 * Public teklif form submission — no auth required.
 * Uses service role to enforce agency limits server-side.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canAddCustomer, canAddRequest, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";
import { notifyAgency } from "@/lib/push/notify";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agencySlug,
      name, phone, email, insurance_type, note,
      identity_no, vehicle_plate, policy_end_date,
      extra_data,
    } = body;

    if (!agencySlug || !name?.trim() || !phone?.trim() || !insurance_type) {
      return NextResponse.json({
        error: "Zorunlu alanlar eksik (agencySlug, name, phone, insurance_type)."
      }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // ── Look up agency by slug ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agency } = await (admin.from("agencies") as any)
      .select("id, is_active, max_customers, max_requests")
      .eq("slug", agencySlug)
      .maybeSingle();

    if (!agency) {
      return NextResponse.json({ error: "Acente bulunamadı.", code: "not_found" }, { status: 404 });
    }
    if (!agency.is_active) {
      return NextResponse.json({ error: INACTIVE_MESSAGE, code: "inactive" }, { status: 403 });
    }

    const agencyId: string = agency.id;

    // ── Enforce customer limit ────────────────────────────────────────────
    const custLimit = await canAddCustomer(admin, agencyId);
    if (!custLimit.ok) {
      return NextResponse.json({
        error: limitMessage("customer"),
        code: "customer_limit_exceeded",
        current: custLimit.current,
        max: custLimit.max,
      }, { status: 403 });
    }

    // ── Enforce request limit ─────────────────────────────────────────────
    const reqLimit = await canAddRequest(admin, agencyId);
    if (!reqLimit.ok) {
      return NextResponse.json({
        error: limitMessage("request"),
        code: "request_limit_exceeded",
        current: reqLimit.current,
        max: reqLimit.max,
      }, { status: 403 });
    }

    // ── Insert customer ────────────────────────────────────────────────────
    const customerPayload = {
      name:           name.trim(),
      phone:          phone.trim(),
      email:          email?.trim() || null,
      insurance_type,
      note:           note?.trim() || null,
      identity_no:    identity_no?.trim() || null,
      vehicle_plate:  vehicle_plate?.trim()?.toUpperCase() || null,
      policy_end_date:policy_end_date || null,
      extra_data:     extra_data ?? {},
      agency_id:      agencyId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer, error: customerErr } = await (admin.from("customers") as any)
      .insert(customerPayload).select("id").single();

    if (customerErr) {
      console.error("[API /api/public/submit] customer insert:", customerErr);
      return NextResponse.json({ error: "Müşteri kaydı oluşturulamadı." }, { status: 500 });
    }

    // ── Insert request ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: requestErr } = await (admin.from("requests") as any).insert({
      customer_id:  customer.id,
      request_type: insurance_type,
      status:       "Yeni Lead",
      price_offer:  null,
      agency_id:    agencyId,
    });

    if (requestErr) {
      console.error("[API /api/public/submit] request insert:", requestErr);
      // Customer already created — return partial success so user isn't confused
      return NextResponse.json({
        ok: true,
        warning: "Talep kaydı oluşturulamadı ancak müşteri kaydedildi.",
        customerId: customer.id,
      });
    }

    // Acente kullanıcılarına push — uygulama kapalıyken de haberdar olsunlar
    await notifyAgency(agencyId, {
      title: "Yeni Teklif Talebi",
      body: `${name.trim()} · ${insurance_type}`,
      data: { customerId: String(customer.id) },
    });

    return NextResponse.json({ ok: true, customerId: customer.id });
  } catch (err: unknown) {
    console.error("[API /api/public/submit] unexpected:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
