/**
 * GET /api/team/coaching — acente sahibi/yönetici için ekip koçluk önerileri.
 *
 * Kural-tabanlı motor (lib/coaching) gerçek sayılardan SOMUT öneriler üretir.
 *   • ?enrich=1 ve OPENAI_API_KEY varsa → öneriler LLM ile doğal dile zenginleştirilir
 *     (sayılar değiştirilmez; grounding kural motorundan gelir). Hata → kural çıktısına döner.
 *   • Aksi halde kural-tabanlı çıktı döner.
 * Yalnız owner/manager (super_admin de erişebilir).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeAgencyPerformance } from "@/lib/performance";
import { buildCoaching, type CoachingItem } from "@/lib/coaching";
import { isManagerial } from "@/lib/tenant";
import { resolveCaller } from "../../whatsapp/_lib/auth";

export const maxDuration = 30;

function responseText(payload: unknown): string {
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (payload as { output?: Array<{ content?: Array<{ text?: unknown }> }> }).output;
  if (Array.isArray(output)) {
    for (const item of output) {
      for (const content of item.content ?? []) {
        if (typeof content.text === "string") return content.text;
      }
    }
  }
  return "";
}

/** Kural çıktısını LLM ile doğal dile zenginleştir. Sayıları değiştirmez. Hata → throw. */
async function enrichWithAI(items: CoachingItem[], apiKey: string): Promise<CoachingItem[]> {
  const model = process.env.OPENAI_COACHING_MODEL ?? "gpt-5.4-mini";
  const compact = items.map((it) => ({
    user_id: it.user_id, user_name: it.user_name, severity: it.severity,
    tag: it.tag, observation: it.observation, action: it.action,
  }));

  const body = {
    model,
    input: [
      {
        role: "user",
        content: [{
          type: "input_text",
          text:
            "Bir sigorta acentesinin sahibine, ekibindeki satis personeli icin kocluk onerileri hazirliyorsun. " +
            "Asagida her calisan icin GERCEK sayilara dayali bir gozlem ve onerilen aksiyon var. " +
            "Bunlari acente sahibine hitap eden, sicak ama profesyonel, somut ve uygulanabilir Turkce'ye donustur. " +
            "KURALLAR: Sayilari (yuzde, adet, prim) ASLA degistirme. user_id, severity, tag alanlarini AYNEN koru. " +
            "observation'i kisa bir gozlem, action'i tek ve net bir aksiyon cumlesi yap. Abartma, klise kurma. " +
            "Girdi: " + JSON.stringify(compact),
        }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "coaching_items",
        strict: false,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  user_id: { type: "string" },
                  severity: { type: "string" },
                  tag: { type: "string" },
                  observation: { type: "string" },
                  action: { type: "string" },
                },
                required: ["user_id", "severity", "tag", "observation", "action"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.json();
  if (!res.ok) throw new Error((raw as { error?: { message?: string } }).error?.message ?? "OpenAI koçluk isteği başarısız.");

  const text = responseText(raw);
  if (!text) throw new Error("OpenAI yapılandırılmış çıktı döndürmedi.");
  const parsed = JSON.parse(text) as { items: Array<{ user_id: string; severity: string; tag: string; observation: string; action: string }> };

  // user_id ile orijinal kayda eşle; isim/severity'yi kural çıktısından koru (LLM bozmasın)
  const byId = new Map(items.map((it) => [it.user_id, it]));
  const out: CoachingItem[] = [];
  for (const e of parsed.items ?? []) {
    const orig = byId.get(e.user_id);
    if (!orig) continue;
    out.push({
      user_id: orig.user_id,
      user_name: orig.user_name,
      severity: orig.severity,
      tag: orig.tag,
      observation: e.observation || orig.observation,
      action: e.action || orig.action,
    });
  }
  return out.length ? out : items;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    if (caller.role !== "super_admin" && !isManagerial(caller.agencyRole)) {
      return NextResponse.json({ error: "Bu görünüm için yetkiniz yok." }, { status: 403 });
    }
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ error: "Acente bağlamı bulunamadı." }, { status: 400 });

    const admin = getSupabaseAdmin();
    const data = await computeAgencyPerformance(admin, agencyId);
    const staff = data.users.filter((u) => u.agency_role !== "owner");
    const items = buildCoaching(staff, data.team.avg_conversion);

    const apiKey = process.env.OPENAI_API_KEY;
    const aiAvailable = !!apiKey;
    const wantEnrich = new URL(request.url).searchParams.get("enrich") === "1";

    if (wantEnrich && aiAvailable && items.length > 0) {
      try {
        const enriched = await enrichWithAI(items, apiKey!);
        return NextResponse.json({ items: enriched, generated_by: "ai", ai_available: true });
      } catch (e) {
        console.error("[api/team/coaching] AI enrich failed, falling back:", e);
        return NextResponse.json({ items, generated_by: "rules", ai_available: true, ai_error: true });
      }
    }

    return NextResponse.json({ items, generated_by: "rules", ai_available: aiAvailable });
  } catch (err) {
    console.error("[api/team/coaching]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
