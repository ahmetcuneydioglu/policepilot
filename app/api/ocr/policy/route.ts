/**
 * POST /api/ocr/policy — poliçe dosyasından alan çıkarma (multipart/form-data)
 *   form alanı: file (PDF/JPG/PNG, max 8MB)
 *   Aktif OCR sağlayıcısı (OCR_PROVIDER env, varsayılan mock) ile
 *   extractPolicyData çalıştırılır, yapılandırılmış alanlar döner.
 *
 * OCR server-side çalışır: ileride gerçek sağlayıcı bağlandığında API
 * anahtarları client'a sızmaz, UI değişmez.
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractPolicyData, getOcrProvider } from "@/lib/ocr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";

// OCR (OpenAI Vision) tek dosyada birkaç saniye sürebilir; varsayılan limiti aş
export const maxDuration = 60;

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

    const buffer = await file.arrayBuffer();

    // ── SHA256 önbellek: aynı dosya tekrar yüklenince OCR'ı atla ──────────────
    // Acente bazlı (agency_id + file_hash) → gizlilik korunur, token israfı önlenir.
    const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    const admin = getSupabaseAdmin();
    const agencyId = caller.agencyId; // super_admin'de null olabilir → cache atlanır

    if (agencyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cached } = await (admin.from("ocr_cache") as any)
        .select("fields, provider, mode")
        .eq("agency_id", agencyId)
        .eq("file_hash", fileHash)
        .maybeSingle();
      if (cached?.fields) {
        return NextResponse.json({
          ok: true,
          cached: true,
          provider: cached.provider ?? "cache",
          providerLabel: "Önbellek (OCR atlandı)",
          mode: cached.mode ?? "cache",
          fields: cached.fields,
          raw_response: { cached: true },
        });
      }
    }

    const provider = getOcrProvider();
    const result   = await extractPolicyData({
      buffer,
      mimeType: file.type,
      name:     file.name,
    });

    // Sonucu önbelleğe yaz (hata gönderimi engellemesin)
    if (agencyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: cacheErr } = await (admin.from("ocr_cache") as any).upsert({
        agency_id: agencyId,
        file_hash: fileHash,
        fields:    result.fields,
        provider:  provider.name,
        mode:      result.mode,
      }, { onConflict: "agency_id,file_hash" });
      if (cacheErr) console.warn("[api/ocr/policy] cache write:", cacheErr.message);
    }

    return NextResponse.json({
      ok: true,
      cached: false,
      provider: provider.name,
      providerLabel: result.providerLabel,
      mode: result.mode,
      fields: result.fields,
      raw_response: result.raw_response,
    });
  } catch (err) {
    console.error("[api/ocr/policy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poliçe okunamadı." },
      { status: 500 }
    );
  }
}
