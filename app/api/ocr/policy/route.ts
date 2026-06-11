/**
 * POST /api/ocr/policy — poliçe dosyasından alan çıkarma (multipart/form-data)
 *   form alanı: file (PDF/JPG/PNG, max 8MB)
 *   Aktif OCR sağlayıcısı (OCR_PROVIDER env, varsayılan mock) ile
 *   extractPolicyData çalıştırılır, yapılandırılmış alanlar döner.
 *
 * OCR server-side çalışır: ileride gerçek sağlayıcı bağlandığında API
 * anahtarları client'a sızmaz, UI değişmez.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractPolicyData, getOcrProvider } from "@/lib/ocr";
import { resolveCaller } from "../../whatsapp/_lib/auth";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED   = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Yalnız PDF, JPG veya PNG yüklenebilir." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Dosya 8MB'dan büyük olamaz." }, { status: 400 });
    }

    const provider = getOcrProvider();
    const result   = await extractPolicyData({
      buffer:   await file.arrayBuffer(),
      mimeType: file.type,
      name:     file.name,
    });

    return NextResponse.json({ ok: true, provider: provider.name, fields: result });
  } catch (err) {
    console.error("[api/ocr/policy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poliçe okunamadı." },
      { status: 500 }
    );
  }
}
