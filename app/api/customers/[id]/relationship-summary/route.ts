/**
 * POST /api/customers/[id]/relationship-summary — IRM Faz 3: AI İlişki Özeti.
 * Görüşme geçmişi + etiketler + açık işlerden Türkçe satış-odaklı özet üretir,
 * customers.relationship_summary(+_at)'e cache'ler ve akışa 🤖 olayı düşer.
 * Sağlayıcı: OPENAI_API_KEY (assistant/OCR ile aynı yapılandırma).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCaller } from "../../../whatsapp/_lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAutoInteraction } from "@/lib/interactions";
import { channelMeta, outcomeMeta, tagMeta } from "@/lib/interactionTypes";

// /v1/responses çıktı metni (assistant route ile aynı tolerant çıkarım)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(raw: any): string {
  if (typeof raw?.output_text === "string" && raw.output_text.trim()) return raw.output_text.trim();
  const out = raw?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();
        }
      }
    }
  }
  return "";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI yapılandırılmamış (OPENAI_API_KEY eksik)." }, { status: 503 });

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Müşteri + acente yetki kontrolü
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer } = await (admin.from("customers") as any)
      .select("id, agency_id, name, insurance_type, tags")
      .eq("id", id)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    if (caller.role !== "super_admin" && customer.agency_id !== caller.agencyId) {
      return NextResponse.json({ error: "Bu müşteriye erişim yetkiniz yok." }, { status: 403 });
    }

    // Görüşme geçmişi (son 40) + açık işler
    const [intRes, reqRes, polRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("customer_interactions") as any)
        .select("occurred_at, kind, auto_source, channel, location_note, product, outcome, note, staff_name, next_action")
        .eq("customer_id", id).order("occurred_at", { ascending: false }).limit(40),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("requests") as any)
        .select("request_type, status").eq("customer_id", id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("policies") as any)
        .select("policy_type, status, end_date, premium").eq("customer_id", id),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ints: any[] = intRes.data ?? [];
    const manual = ints.filter((i) => i.kind === "manual");
    if (ints.length === 0) {
      return NextResponse.json({ error: "Henüz ilişki kaydı yok — önce görüşme ekleyin." }, { status: 400 });
    }

    const lines = ints.slice(0, 30).map((i) => {
      const d = new Date(i.occurred_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
      if (i.kind === "auto") return `- ${d} · [sistem] ${i.auto_source}${i.product ? " · " + i.product : ""}${i.note ? " · " + i.note : ""}`;
      const bits = [
        i.staff_name ?? "Personel",
        channelMeta(i.channel).label,
        i.product,
        i.outcome ? (outcomeMeta(i.outcome)?.label ?? i.outcome) : null,
        i.note,
      ].filter(Boolean);
      return `- ${d} · ${bits.join(" · ")}`;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openReqs = ((reqRes.data ?? []) as any[]).filter((r) => r.status !== "Kazanıldı" && r.status !== "Kaybedildi");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activePols = ((polRes.data ?? []) as any[]).filter((p) => p.status === "Aktif");
    const tagLabels = ((customer.tags ?? []) as string[]).map((t) => tagMeta(t).label);

    const context = [
      `Müşteri: ${customer.name}${customer.insurance_type ? " · " + customer.insurance_type : ""}`,
      tagLabels.length ? `Etiketler: ${tagLabels.join(", ")}` : null,
      `Aktif poliçe: ${activePols.length}${activePols.length ? " (" + activePols.map((p) => p.policy_type).join(", ") + ")" : ""}`,
      `Açık fırsat: ${openReqs.length}${openReqs.length ? " (" + openReqs.map((r) => r.request_type + "/" + r.status).join(", ") + ")" : ""}`,
      ``,
      `İLİŞKİ GEÇMİŞİ (yeniden eskiye, ${manual.length} görüşme + sistem olayları):`,
      ...lines,
    ].filter((x) => x !== null).join("\n");

    const instructions =
      "Sen bir sigorta acentesi CRM'inde ilişki analistisin. Aşağıdaki müşteri ilişki geçmişini analiz et ve " +
      "acente personeline TÜRKÇE, 3-5 cümlelik, satış-odaklı bir özet yaz. Şunları kapsa: " +
      "(1) temas yoğunluğu ve baskın kanal, (2) en çok konuşulan ürün, (3) müşterinin son durumu/itirazı, " +
      "(4) bir sonraki görüşme için SOMUT taktik önerisi. Madde işareti kullanma, akıcı paragraf yaz. " +
      "Veride olmayan hiçbir şeyi uydurma.";

    const model = process.env.OPENAI_CHAT_MODEL ?? process.env.OPENAI_OCR_MODEL ?? "gpt-5.4-mini";
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input: [{ role: "user", content: [{ type: "input_text", text: context }] }],
        max_output_tokens: 800,
      }),
    });
    const raw = await res.json();
    if (!res.ok) {
      const msg = (raw as { error?: { message?: string } })?.error?.message ?? "AI isteği başarısız.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const summary = extractText(raw);
    if (!summary) return NextResponse.json({ error: "AI yanıt üretmedi." }, { status: 502 });

    const generatedAt = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("customers") as any)
      .update({ relationship_summary: summary, relationship_summary_at: generatedAt })
      .eq("id", id);

    // Akışa 🤖 olayı (best-effort)
    await logAutoInteraction({
      agencyId: customer.agency_id,
      customerId: id,
      autoSource: "ai_summary",
      note: "İlişki özeti güncellendi",
    });

    return NextResponse.json({ summary, generated_at: generatedAt });
  } catch (err) {
    console.error("[api/customers/relationship-summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
