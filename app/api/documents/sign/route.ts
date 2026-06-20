/**
 * POST /api/documents/sign — bir evrak için imzalı görüntüleme URL'i döner.
 *
 * Bearer auth (mobil). Service role ile imzalar → evrak hangi bucket'ta olursa
 * olsun (documents / policy-documents) açılabilir. Acente kapsamı zorunlu.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: doc } = await (admin.from("documents") as any)
      .select("file_path, bucket, agency_id")
      .eq("id", id)
      .maybeSingle();

    if (!doc) return NextResponse.json({ error: "Evrak bulunamadı." }, { status: 404 });
    if (caller.role !== "super_admin" && doc.agency_id && doc.agency_id !== caller.agencyId) {
      return NextResponse.json({ error: "Bu evrağa erişim yetkiniz yok." }, { status: 403 });
    }

    const bucket = doc.bucket || "documents";
    const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(doc.file_path, 3600);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "İmzalı URL alınamadı." }, { status: 500 });
    }
    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    console.error("[api/documents/sign]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
