/**
 * POST /api/policy-documents — poliçe dosyası yükle (multipart/form-data)
 *   form alanları: policy_id, file (PDF/JPG/PNG, max 8MB)
 *   Dosya Supabase Storage'a (bucket: policy-documents) service role ile
 *   yüklenir; client'a storage izni gerekmez. policies.document_path +
 *   document_name güncellenir.
 *
 * GET /api/policy-documents?policy_id=… — görüntüleme için imzalı URL döner
 *   (60 dk geçerli). Multi-tenant: agency_user yalnız kendi acentesinin
 *   poliçesine erişebilir.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity";
import { resolveCaller } from "../whatsapp/_lib/auth";

const BUCKET    = "policy-documents";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED   = ["application/pdf", "image/jpeg", "image/png"];

type PolicyRow = {
  id: string;
  agency_id: string | null;
  customer_id: string | null;
  document_path?: string | null;
};

async function getAuthorizedPolicy(policyId: string, callerRole: string, callerAgency: string | null) {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: policy } = await (admin.from("policies") as any)
    .select("id, agency_id, customer_id, document_path")
    .eq("id", policyId)
    .maybeSingle();

  if (!policy) return null;
  if (callerRole !== "super_admin" && policy.agency_id !== callerAgency) return null;
  return policy as PolicyRow;
}

async function insertDocumentMetadata(input: {
  policy: PolicyRow;
  path: string;
  file: File;
  uploadedBy: string | null;
}) {
  const admin = getSupabaseAdmin();

  // Canonical live schema from supabase/schema.sql.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("documents") as any).insert({
    agency_id: input.policy.agency_id,
    customer_id: input.policy.customer_id,
    policy_id: input.policy.id,
    file_name: input.file.name,
    file_path: input.path,
    file_type: input.file.type,
    file_size: input.file.size,
    bucket: BUCKET,
    uploaded_by: input.uploadedBy,
  });

  return error;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const form     = await request.formData();
    const policyId = form.get("policy_id");
    const file     = form.get("file");

    if (typeof policyId !== "string" || !policyId) {
      return NextResponse.json({ error: "policy_id gerekli." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Yalnız PDF, JPG veya PNG yüklenebilir." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Dosya 8MB'dan büyük olamaz." }, { status: 400 });
    }

    const policy = await getAuthorizedPolicy(policyId, caller.role, caller.agencyId);
    if (!policy) return NextResponse.json({ error: "Poliçe bulunamadı veya erişim yetkiniz yok." }, { status: 404 });

    const admin    = getSupabaseAdmin();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path     = `${policy.agency_id ?? "no-agency"}/${policy.id}/${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (upErr) {
      console.error("[policy-documents] upload error:", upErr.message);
      return NextResponse.json({ error: `Yükleme hatası: ${upErr.message}` }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (admin.from("policies") as any)
      .update({ document_path: path, document_name: file.name })
      .eq("id", policy.id);

    if (updErr) {
      console.error("[policy-documents] policy update error:", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const docErr = await insertDocumentMetadata({ policy, path, file, uploadedBy: caller.userId });
    if (docErr) {
      console.error("[policy-documents] document metadata insert:", docErr.message);
      return NextResponse.json({ error: `Evrak kaydı oluşturulamadı: ${docErr.message}` }, { status: 500 });
    }

    await logActivity({
      agencyId: policy.agency_id, actorId: caller.userId,
      action: "upload", entityType: "document", entityId: policy.id,
      summary: `Evrak yüklendi: ${file.name}`,
    });

    return NextResponse.json({ ok: true, path, documentSaved: true });
  } catch (err) {
    console.error("[policy-documents POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const policyId   = searchParams.get("policy_id");
    const documentId = searchParams.get("document_id");
    const download   = searchParams.get("download") === "1";
    if (!policyId && !documentId) {
      return NextResponse.json({ error: "policy_id veya document_id gerekli." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    let bucket = BUCKET;
    let filePath: string | null = null;
    let fileName: string | null = null;

    if (documentId) {
      // Evrak kaydı üzerinden: documents tablosundan yol + bucket
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: doc } = await (admin.from("documents") as any)
        .select("id, agency_id, file_path, file_name, bucket")
        .eq("id", documentId)
        .maybeSingle();
      if (!doc) return NextResponse.json({ error: "Evrak bulunamadı." }, { status: 404 });
      if (caller.role !== "super_admin" && doc.agency_id !== caller.agencyId) {
        return NextResponse.json({ error: "Bu evraka erişim yetkiniz yok." }, { status: 404 });
      }
      filePath = doc.file_path;
      fileName = doc.file_name;
      bucket   = doc.bucket || BUCKET;
    } else {
      const policy = await getAuthorizedPolicy(policyId!, caller.role, caller.agencyId);
      if (!policy) return NextResponse.json({ error: "Poliçe bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
      if (!policy.document_path) return NextResponse.json({ error: "Bu poliçeye dosya yüklenmemiş." }, { status: 404 });
      filePath = policy.document_path;
    }

    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(filePath!, 60 * 60, download ? { download: fileName ?? true } : undefined);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "İmzalı URL üretilemedi." }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error("[policy-documents GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
