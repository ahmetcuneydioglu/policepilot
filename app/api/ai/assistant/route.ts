/**
 * POST /api/ai/assistant — SigortaOS AI (mobil chat)
 *
 * Bearer auth (mobil). Acentenin GÜNCEL verisiyle (yaklaşan yenilemeler, açık
 * teklifler, özet) grounding yapıp OpenAI Responses API ile Türkçe yanıt üretir.
 * Sağlayıcı/anahtar OCR ile aynı: OPENAI_API_KEY (yeni yapılandırma gerekmez).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller, requirePermission } from "../../whatsapp/_lib/auth";

type ChatMsg = { role: "user" | "assistant"; content: string };

const DAY = 86_400_000;
const fmtTRY = (n: number) => `${Math.round(n).toLocaleString("tr-TR")}₺`;
function daysUntil(end: string, today: string) {
  const a = Date.parse(`${end}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / DAY);
}

/** Acentenin güncel operasyon verisinden kısa bir grounding bloğu üretir. */
async function buildContext(agencyId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [polRes, reqRes, intRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("policies") as any)
      .select("policy_type,premium,commission,end_date,status,created_at,customers(name,phone)")
      .eq("agency_id", agencyId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("requests") as any)
      .select("request_type,status,price_offer,customers(name,phone)")
      .eq("agency_id", agencyId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("customer_interactions") as any)
      .select("occurred_at, channel, product, outcome, note, staff_name, next_action, next_action_date, next_action_done, customers(name)")
      .eq("agency_id", agencyId).eq("kind", "manual")
      .order("occurred_at", { ascending: false }).limit(20),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pols: any[] = polRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqs: any[] = reqRes.data ?? [];

  const renewals = pols
    .filter((p) => p.status === "Aktif" && p.end_date && daysUntil(p.end_date, today) <= 30 && daysUntil(p.end_date, today) >= -30)
    .sort((a, b) => (a.end_date < b.end_date ? -1 : 1))
    .slice(0, 25)
    .map((p) => `- ${p.customers?.name ?? "?"} (${p.customers?.phone ?? "tel yok"}) · ${p.policy_type} · ${p.premium ? fmtTRY(p.premium) : "-"} · ${daysUntil(p.end_date, today)} gün`);

  const open = reqs
    .filter((r) => r.status !== "Kazanıldı" && r.status !== "Kaybedildi")
    .slice(0, 25)
    .map((r) => `- ${r.customers?.name ?? "?"} (${r.customers?.phone ?? "tel yok"}) · ${r.request_type} · ${r.status}${r.price_offer ? " · " + fmtTRY(r.price_offer) : ""}`);

  const aktif = pols.filter((p) => p.status === "Aktif").length;
  const buAyPrim = pols.filter((p) => (p.created_at ?? "").slice(0, 10) >= monthStart).reduce((s, p) => s + Number(p.premium ?? 0), 0);
  const won = reqs.filter((r) => r.status === "Kazanıldı").length;
  const lost = reqs.filter((r) => r.status === "Kaybedildi").length;
  const conv = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  // IRM: son görüşmeler + bekleyen sonraki-aksiyonlar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ints: any[] = intRes.data ?? [];
  const talks = ints.slice(0, 15).map((i) =>
    `- ${(i.occurred_at ?? "").slice(0, 10)} · ${i.customers?.name ?? "?"} · ${i.channel ?? "?"}${i.product ? " · " + i.product : ""}${i.outcome ? " · " + i.outcome : ""}${i.note ? " · " + String(i.note).slice(0, 80) : ""}${i.staff_name ? " (" + i.staff_name + ")" : ""}`);
  const pendingActions = ints.filter((i) => i.next_action && !i.next_action_done && i.next_action_date && i.next_action_date <= today)
    .map((i) => `- ${i.customers?.name ?? "?"} · ${i.next_action} · vade ${i.next_action_date}`);

  return [
    `Bugün: ${today}`,
    `Özet: ${aktif} aktif poliçe · bu ay prim ${fmtTRY(buAyPrim)} · dönüşüm %${conv} · ${renewals.length} yaklaşan yenileme · ${open.length} açık teklif`,
    ``,
    `YAKLAŞAN YENİLEMELER (≤30 gün):`,
    renewals.length ? renewals.join("\n") : "- yok",
    ``,
    `AÇIK TEKLİFLER:`,
    open.length ? open.join("\n") : "- yok",
    ``,
    `SON GÖRÜŞMELER (IRM):`,
    talks.length ? talks.join("\n") : "- yok",
    ``,
    `VADESİ GELEN SONRAKİ-AKSİYONLAR:`,
    pendingActions.length ? pendingActions.join("\n") : "- yok",
  ].join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(raw: any): string {
  if (typeof raw?.output_text === "string" && raw.output_text.trim()) return raw.output_text.trim();
  const out = raw?.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) for (const c of content) if (typeof c?.text === "string") parts.push(c.text);
    }
    if (parts.length) return parts.join("\n").trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "ai.use");
    if (denied) return denied;
    if (!caller.agencyId) return NextResponse.json({ error: "Acente bilgisi bulunamadı." }, { status: 403 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI yapılandırılmamış (OPENAI_API_KEY eksik)." }, { status: 503 });

    const body = await request.json().catch(() => ({}));
    const messages: ChatMsg[] = Array.isArray(body.messages)
      ? body.messages
          .filter((m: ChatMsg) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-10)
      : [];
    if (!messages.length) return NextResponse.json({ error: "Mesaj gerekli." }, { status: 400 });

    const context = await buildContext(caller.agencyId);
    const instructions =
      "Sen SigortaOS AI'sın — bir Türk sigorta acentesinin cebindeki dijital asistanı. " +
      "Yalnızca Türkçe, kısa ve aksiyon-odaklı yanıt ver. Aşağıdaki GÜNCEL ACENTE VERİSİNİ kullan; " +
      "isim ve telefon numaralarını olduğu gibi kullan. Veride olmayan bilgiyi UYDURMA — yoksa 'kayıt yok' de. " +
      "Liste/sıralama isteniyorsa NUMARALI liste kullan (1., 2., 3.), HER MADDEYİ AYRI SATIRA yaz, müşteri adını **kalın** yap ve alanları ' · ' ile ayır " +
      "(örn: '1. **Ahmet Yılmaz** · Kasko · 12.400₺ · 3 gün kaldı · 0532...'). Maddeler arasında boş satır bırakma. " +
      "Mesaj taslağı istenirse kısa, nazik, profesyonel bir WhatsApp metni yaz.\n\n" +
      "=== GÜNCEL ACENTE VERİSİ ===\n" + context;

    const model = process.env.OPENAI_CHAT_MODEL ?? process.env.OPENAI_OCR_MODEL ?? "gpt-5.4-mini";

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input: messages.map((m) => ({
          role: m.role,
          content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
        })),
        max_output_tokens: 1500,
      }),
    });

    const raw = await res.json();
    if (!res.ok) {
      const msg = (raw as { error?: { message?: string } })?.error?.message ?? "AI isteği başarısız.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const reply = extractText(raw);
    if (!reply) return NextResponse.json({ error: "AI yanıt üretmedi." }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[api/ai/assistant]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
