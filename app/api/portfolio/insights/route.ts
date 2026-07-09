/**
 * PORTFÖY — Saha Günlüğü / Yönetici Kokpiti (Faz 4).
 *
 * GET  /api/portfolio/insights?start=YYYY-MM-DD — haftalık personel metrikleri:
 *   görüşme/kanal kırılımı (customer_interactions, lib/performance ile aynı tanımlar:
 *   manuel kayıt; ziyaret = face_to_face) + teklif/poliçe/kayıp geçişleri
 *   (deal_stage_events) + funnel anlık görüntüsü + kayıp nedenleri + bayat işler.
 * POST /api/portfolio/insights — aynı metriklerden AI haftalık ekip özeti üretir.
 *
 * Yalnız yönetici (owner/manager/super_admin) — "kim çalışıyor, kim bekletiyor" ekranı.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";
import { DEAL_STAGE_KEYS, STALE_WARN_DAYS } from "@/lib/portfolio";

export type StaffInsight = {
  id: string;
  name: string;
  interactions: number;   // haftalık manuel görüşme
  phone: number;
  visits: number;         // yüz yüze (saha ziyareti)
  whatsapp: number;
  quotes_sent: number;    // → Teklif Gönderildi geçişi
  won: number;            // → Poliçeleşti geçişi
  lost: number;           // → Kaybedildi çıkışı
  open_deals: number;     // anlık açık iş
  stale_deals: number;    // 7g+ temassız açık iş — "kim bekletiyor"
};

export type StaleDeal = {
  id: string; title: string; customer_name: string | null;
  owner_name: string | null; stage: string; days: number;
};

export type Insights = {
  start: string;
  end: string;
  staff: StaffInsight[];
  totals: { interactions: number; visits: number; quotes_sent: number; won: number; lost: number };
  funnel: { stage: string; count: number }[];
  lost_reasons: { reason: string; count: number }[];
  stale_deals: StaleDeal[];
};

/** Europe/Istanbul'a göre içinde bulunulan haftanın pazartesisi (YYYY-MM-DD). */
function currentWeekStart(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
  const d = new Date(`${p}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Pzt=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeInsights(admin: any, agencyId: string, start: string): Promise<Insights> {
  const end = addDays(start, 7);
  // İstanbul günü ile UTC timestamptz karşılaştırması için +03:00 sınırları
  const startTs = `${start}T00:00:00+03:00`;
  const endTs = `${end}T00:00:00+03:00`;

  const [memRes, intRes, evRes, dealRes, touchRes] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("agency_id", agencyId).order("full_name"),
    admin.from("customer_interactions")
      .select("staff_id, channel")
      .eq("agency_id", agencyId).eq("kind", "manual")
      .gte("occurred_at", startTs).lt("occurred_at", endTs),
    admin.from("deal_stage_events")
      .select("by_user_id, to_stage")
      .eq("agency_id", agencyId)
      .gte("at", startTs).lt("at", endTs),
    admin.from("deals")
      .select("id, title, stage, status, owner_id, owner_name, lost_reason, created_at, customers(name)")
      .eq("agency_id", agencyId).limit(2000),
    admin.from("customer_interactions")
      .select("deal_id, occurred_at")
      .eq("agency_id", agencyId).not("deal_id", "is", null)
      .order("occurred_at", { ascending: false }).limit(2000),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (memRes.data ?? []) as { id: string; full_name: string | null }[];
  const byId = new Map<string, StaffInsight>(
    members.map((m) => [m.id, {
      id: m.id, name: m.full_name ?? "İsimsiz",
      interactions: 0, phone: 0, visits: 0, whatsapp: 0,
      quotes_sent: 0, won: 0, lost: 0, open_deals: 0, stale_deals: 0,
    }])
  );

  // Görüşme kırılımı (lib/performance ile aynı: manuel kayıt; ziyaret = face_to_face)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of (intRes.data ?? []) as any[]) {
    const u = it.staff_id ? byId.get(it.staff_id) : undefined;
    if (!u) continue;
    u.interactions++;
    if (it.channel === "phone") u.phone++;
    else if (it.channel === "face_to_face") u.visits++;
    else if (it.channel === "whatsapp") u.whatsapp++;
  }

  // Aşama geçişleri (trigger'ın yazdığı deal_stage_events)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of (evRes.data ?? []) as any[]) {
    const u = ev.by_user_id ? byId.get(ev.by_user_id) : undefined;
    if (!u) continue;
    if (ev.to_stage === "teklif_gonderildi") u.quotes_sent++;
    else if (ev.to_stage === "policelesti") u.won++;
    else if (ev.to_stage === "kaybedildi") u.lost++;
  }

  // Anlık iş durumu: funnel + kayıp nedenleri + bayat işler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (dealRes.data ?? []) as any[];
  const lastTouch = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (touchRes.data ?? []) as any[]) {
    if (t.deal_id && !lastTouch.has(t.deal_id)) lastTouch.set(t.deal_id, t.occurred_at);
  }

  const funnelMap = new Map<string, number>(DEAL_STAGE_KEYS.map((k) => [k, 0]));
  const lostMap = new Map<string, number>();
  const staleDeals: StaleDeal[] = [];

  for (const d of deals) {
    if (d.status === "lost") {
      const r = d.lost_reason ?? "diger";
      lostMap.set(r, (lostMap.get(r) ?? 0) + 1);
      continue;
    }
    funnelMap.set(d.stage, (funnelMap.get(d.stage) ?? 0) + 1);
    const u = d.owner_id ? byId.get(d.owner_id) : undefined;
    if (u) u.open_deals++;
    if (d.stage === "policelesti" || d.stage === "referans_kazanildi") continue;
    const ref = lastTouch.get(d.id) ?? d.created_at;
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
    if (days >= STALE_WARN_DAYS) {
      if (u) u.stale_deals++;
      staleDeals.push({
        id: d.id, title: d.title, customer_name: d.customers?.name ?? null,
        owner_name: d.owner_name ?? null, stage: d.stage, days,
      });
    }
  }
  staleDeals.sort((a, b) => b.days - a.days);

  const staff = [...byId.values()].sort((a, b) => b.interactions - a.interactions);
  const totals = staff.reduce(
    (t, s) => ({
      interactions: t.interactions + s.interactions,
      visits: t.visits + s.visits,
      quotes_sent: t.quotes_sent + s.quotes_sent,
      won: t.won + s.won,
      lost: t.lost + s.lost,
    }),
    { interactions: 0, visits: 0, quotes_sent: 0, won: 0, lost: 0 }
  );

  return {
    start, end,
    staff,
    totals,
    funnel: DEAL_STAGE_KEYS.map((k) => ({ stage: k, count: funnelMap.get(k) ?? 0 })),
    lost_reasons: [...lostMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    stale_deals: staleDeals.slice(0, 12),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function authorize(request: NextRequest): Promise<{ error: NextResponse } | { admin: any; agencyId: string }> {
  const caller = await resolveCaller(request);
  if (!caller) return { error: NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 }) };
  const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
  if (!managerial) return { error: NextResponse.json({ error: "Saha Günlüğü yalnız yöneticilere açıktır." }, { status: 403 }) };
  if (!caller.agencyId) return { error: NextResponse.json({ error: "Bağlı acente bulunamadı." }, { status: 400 }) };
  return { admin: getSupabaseAdmin(), agencyId: caller.agencyId };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const sp = request.nextUrl.searchParams;
    const start = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("start") ?? "") ? sp.get("start")! : currentWeekStart();
    const insights = await computeInsights(auth.admin, auth.agencyId, start);
    return NextResponse.json(insights);
  } catch (e) {
    console.error("[API /api/portfolio/insights GET]", e);
    return NextResponse.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

// ── AI haftalık ekip özeti ────────────────────────────────────────────────────
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

const STAGE_TR: Record<string, string> = {
  lead: "Lead", ilk_gorusme: "İlk Görüşme", ihtiyac_analizi: "İhtiyaç Analizi",
  teklif_hazirlaniyor: "Teklif Hazırlanıyor", teklif_gonderildi: "Teklif Gönderildi",
  takip: "Takip", pazarlik: "Pazarlık", onay_bekliyor: "Onay Bekliyor",
  policelesti: "Poliçeleşti", referans_kazanildi: "Referans Kazanıldı",
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI yapılandırılmamış (OPENAI_API_KEY eksik)." }, { status: 503 });

    const body = await request.json().catch(() => ({}));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(body?.start ?? "") ? body.start : currentWeekStart();
    const ins = await computeInsights(auth.admin, auth.agencyId, start);

    const active = ins.staff.filter((s) => s.interactions + s.quotes_sent + s.won + s.open_deals > 0);
    if (active.length === 0 && ins.stale_deals.length === 0) {
      return NextResponse.json({ error: "Bu hafta özetlenecek aktivite yok." }, { status: 400 });
    }

    const context = [
      `Hafta: ${start} – ${ins.end}`,
      `Ekip toplamı: ${ins.totals.interactions} görüşme (${ins.totals.visits} saha ziyareti) · ${ins.totals.quotes_sent} teklif · ${ins.totals.won} poliçeleşen · ${ins.totals.lost} kayıp`,
      ``,
      `PERSONEL (haftalık):`,
      ...active.map((s) =>
        `- ${s.name}: ${s.interactions} görüşme (${s.phone} tel, ${s.visits} ziyaret, ${s.whatsapp} WA) · ${s.quotes_sent} teklif · ${s.won} poliçe · açık iş ${s.open_deals}, bekletilen ${s.stale_deals}`),
      ``,
      `SATIŞ HATTI (anlık): ${ins.funnel.filter((f) => f.count > 0).map((f) => `${STAGE_TR[f.stage] ?? f.stage} ${f.count}`).join(" · ") || "boş"}`,
      ins.stale_deals.length
        ? `BEKLETİLEN İŞLER: ${ins.stale_deals.slice(0, 6).map((d) => `${d.customer_name ?? d.title} (${d.owner_name ?? "?"}, ${d.days} gün)`).join(" · ")}`
        : `Bekletilen iş yok.`,
    ].join("\n");

    const instructions =
      "Sen bir sigorta acentesi sahibinin operasyon analistisin. Aşağıdaki haftalık ekip verisini analiz et ve " +
      "acente sahibine TÜRKÇE, 4-6 cümlelik bir yönetici özeti yaz. Şunları kapsa: " +
      "(1) bu hafta kim öne çıktı (görüşme/ziyaret/kapanış), (2) satış hattının darboğazı hangi aşamada, " +
      "(3) bekletilen işler ve sorumlusu, (4) önümüzdeki hafta için SOMUT tek yönetici aksiyonu. " +
      "Madde işareti kullanma, akıcı paragraf yaz. Veride olmayan hiçbir şeyi uydurma.";

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

    return NextResponse.json({ summary, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error("[API /api/portfolio/insights POST]", e);
    return NextResponse.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}
