/**
 * POST /api/customers/from-policy
 *
 * OCR flow save endpoint. Creates customer + policy + document metadata from
 * one multipart request so web and future mobile clients can share the same
 * product flow.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { canAddCustomer, canAddPolicy, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";
import { resolveCaller } from "../../whatsapp/_lib/auth";

const BUCKET = "policy-documents";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value || null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function insertDocumentMetadata(input: {
  agencyId: string;
  customerId: string;
  policyId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const admin = getSupabaseAdmin();

  // Preferred shape from supabase/documents_migration.sql
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preferred = await (admin.from("documents") as any).insert({
    agency_id: input.agencyId,
    customer_id: input.customerId,
    policy_id: input.policyId,
    doc_type: "policy",
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    source: "ocr_upload",
  });

  if (!preferred.error) return null;

  // Backward-compatible shape from older schema.sql.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallback = await (admin.from("documents") as any).insert({
    agency_id: input.agencyId,
    customer_id: input.customerId,
    policy_id: input.policyId,
    file_name: input.fileName,
    file_path: input.filePath,
    file_type: input.mimeType,
    file_size: input.sizeBytes,
    bucket: BUCKET,
  });

  return fallback.error ?? preferred.error;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Poliçe dosyası gerekli." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Yalnız PDF, JPG veya PNG yüklenebilir." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Dosya 8MB'dan büyük olamaz." }, { status: 400 });
    }

    const name = text(form, "name");
    const phone = text(form, "phone");
    const insuranceType = text(form, "insurance_type");
    const policyEndDate = text(form, "policy_end_date");

    if (!name || !phone || !insuranceType) {
      return NextResponse.json({ error: "Ad, telefon ve sigorta türü zorunludur." }, { status: 400 });
    }
    if (!policyEndDate) {
      return NextResponse.json({ error: "Poliçe bitiş tarihi zorunludur." }, { status: 400 });
    }

    const requestedAgencyId = optionalText(form, "agency_id");
    const resolvedAgencyId = caller.role === "super_admin" ? requestedAgencyId : caller.agencyId;

    if (!resolvedAgencyId) {
      return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const customerLimit = await canAddCustomer(admin, resolvedAgencyId);
    if (!customerLimit.isActive) {
      return NextResponse.json({ error: INACTIVE_MESSAGE, code: "inactive" }, { status: 403 });
    }
    if (!customerLimit.ok) {
      return NextResponse.json({
        error: limitMessage("customer"),
        code: "limit_exceeded",
        current: customerLimit.current,
        max: customerLimit.max,
      }, { status: 403 });
    }

    const policyLimit = await canAddPolicy(admin, resolvedAgencyId);
    if (!policyLimit.isActive) {
      return NextResponse.json({ error: INACTIVE_MESSAGE, code: "inactive" }, { status: 403 });
    }
    if (!policyLimit.ok) {
      return NextResponse.json({
        error: limitMessage("policy"),
        code: "policy_limit_exceeded",
        current: policyLimit.current,
        max: policyLimit.max,
      }, { status: 403 });
    }

    const tcIdentityNo = optionalText(form, "tc_identity_no");
    const taxNo = optionalText(form, "tax_no");
    const identityNo = tcIdentityNo || taxNo || optionalText(form, "identity_no");
    const vehiclePlate = optionalText(form, "vehicle_plate")?.toUpperCase() ?? null;

    const extraData = {
      tc_identity_no: tcIdentityNo,
      tax_no: taxNo,
      address: optionalText(form, "address"),
      vehicle_plate: vehiclePlate,
      license_serial: optionalText(form, "license_serial"),
      brand_model: optionalText(form, "brand_model"),
      vehicle_year: optionalText(form, "vehicle_year"),
      engine_no: optionalText(form, "engine_no"),
      chassis_no: optionalText(form, "chassis_no"),
      source: "ocr_upload",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer, error: customerErr } = await (admin.from("customers") as any)
      .insert({
        agency_id: resolvedAgencyId,
        name,
        phone,
        email: optionalText(form, "email"),
        insurance_type: insuranceType,
        note: optionalText(form, "note"),
        identity_no: identityNo,
        vehicle_plate: vehiclePlate,
        policy_end_date: policyEndDate,
        extra_data: extraData,
      })
      .select("id")
      .single();

    if (customerErr || !customer?.id) {
      console.error("[customers/from-policy] customer insert:", customerErr);
      return NextResponse.json({ error: customerErr?.message ?? "Müşteri oluşturulamadı." }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: policy, error: policyErr } = await (admin.from("policies") as any)
      .insert({
        customer_id: customer.id,
        agency_id: resolvedAgencyId,
        policy_type: insuranceType,
        start_date: optionalText(form, "policy_start_date") || todayIso(),
        end_date: policyEndDate,
        status: "Aktif",
        policy_no: optionalText(form, "policy_no"),
        insurance_company: optionalText(form, "insurance_company"),
        premium: optionalText(form, "premium") ? Number(text(form, "premium")) : null,
        source: "ocr_upload",
      })
      .select("id")
      .single();

    if (policyErr || !policy?.id) {
      console.error("[customers/from-policy] policy insert:", policyErr);
      return NextResponse.json({ error: policyErr?.message ?? "Poliçe oluşturulamadı.", customerId: customer.id }, { status: 500 });
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${resolvedAgencyId}/${policy.id}/${Date.now()}-${safeName}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) {
      console.error("[customers/from-policy] storage upload:", uploadErr);
      return NextResponse.json({
        error: `Müşteri ve poliçe oluşturuldu ancak dosya yüklenemedi: ${uploadErr.message}`,
        customerId: customer.id,
        policyId: policy.id,
      }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: policyDocErr } = await (admin.from("policies") as any)
      .update({ document_path: path, document_name: file.name })
      .eq("id", policy.id);

    if (policyDocErr) {
      console.warn("[customers/from-policy] policy document update:", policyDocErr.message);
    }

    const docErr = await insertDocumentMetadata({
      agencyId: resolvedAgencyId,
      customerId: customer.id,
      policyId: policy.id,
      filePath: path,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if (docErr) {
      console.warn("[customers/from-policy] document metadata insert:", docErr.message);
    }

    return NextResponse.json({
      ok: true,
      customerId: customer.id,
      policyId: policy.id,
      documentPath: path,
      documentSaved: !docErr,
    });
  } catch (err) {
    console.error("[customers/from-policy]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sunucu hatası." }, { status: 500 });
  }
}
