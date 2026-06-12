/**
 * GET /api/admin/ai — AI Merkezi (yalnız super_admin)
 * AI kullanımı (OCR), acente skorları, risk analizi, satış tahmini.
 * Skorlama kural motoruyla çalışır — gerçek modele geçişte sözleşme sabit kalır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";
import { collectPlatformData } from "../_lib/stats";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (table: string) => admin.from(table) as any;

    const [data, ocrRes] = await Promise.all([
      collectPlatformData(),
      t("ocr_results").select("id, mode, provider, created_at").order("created_at", { ascending: false }).limit(500),
    ]);

    const ocr = ocrRes.data ?? [];
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

    // ── AI kullanımı ──────────────────────────────────────────────────────
    const usage = {
      ocr_total:   ocr.length,
      ocr_30d:     ocr.filter((o: { created_at: string }) => o.created_at >= monthAgo).length,
      ocr_real:    ocr.filter((o: { mode: string }) => o.mode === "real").length,
      ocr_demo:    ocr.filter((o: { mode: string }) => o.mode !== "real").length,
      model:       process.env.OPENAI_OCR_MODEL ?? "gpt-5.5",
      configured:  Boolean(process.env.OPENAI_API_KEY),
    };

    // ── Acente skorları (kural motoru) ────────────────────────────────────
    const scores = data.perAgency.map(s => {
      const idleDays = s.last_activity
        ? Math.floor((Date.now() - new Date(s.last_activity).getTime()) / 864e5)
        : 999;
      const wonRate = s.quotes > 0
        ? data.raw.quoteRuns.filter(r => r.agency_id === s.agency.id && r.status === "Kazanıldı").length / s.quotes
        : 0;

      let score = 50;
      score += Math.min(20, s.active_policies * 4);
      score += Math.min(15, Math.floor(s.total_premium / 10000) * 3);
      score += Math.min(10, wonRate * 20);
      score -= Math.min(30, idleDays * 2);
      score = Math.max(0, Math.min(100, Math.round(score)));

      return {
        id: s.agency.id,
        name: s.agency.name,
        plan: s.agency.plan,
        score,
        grade: score >= 75 ? "A" : score >= 50 ? "B" : score >= 25 ? "C" : "D",
        idle_days: idleDays === 999 ? null : idleDays,
        risk: !s.agency.is_active ? "Pasif hesap" : idleDays > 14 ? "Uzun süredir işlemsiz" : score < 40 ? "Düşük aktivite" : null,
      };
    }).sort((a, b) => b.score - a.score);

    // ── Satış tahmini (basit trend: son 30 gün poliçe primi) ─────────────
    const premium30d = data.raw.policies
      .filter(p => p.created_at >= monthAgo)
      .reduce((s, p) => s + (p.premium ?? 0), 0);
    const policies30d = data.raw.policies.filter(p => p.created_at >= monthAgo).length;

    const forecast = {
      next_month_policies: Math.round(policies30d * 1.1),
      next_month_premium:  Math.round(premium30d * 1.1),
      basis: "Son 30 gün × 1.1 büyüme varsayımı (kural motoru)",
    };

    // ── AI önerileri (platform geneli, kural tabanlı) ─────────────────────
    const suggestions: string[] = [];
    const noSummary = data.perAgency.filter(s => s.whatsapp_total === 0).length;
    if (noSummary > 0) suggestions.push(`${noSummary} acente henüz hiç WhatsApp mesajı almadı — onboarding kontrolü önerilir`);
    const idle = scores.filter(s => s.risk === "Uzun süredir işlemsiz").length;
    if (idle > 0) suggestions.push(`${idle} acente 14+ gündür işlemsiz — yeniden aktivasyon kampanyası düşünün`);
    const starters = data.agencies.filter(a => a.plan === "starter" && a.is_active).length;
    if (starters > 0) suggestions.push(`${starters} aktif Starter acente — Pro'ya yükseltme fırsatı (potansiyel +${(starters * 1490).toLocaleString("tr-TR")} ₺ MRR)`);
    if (data.totals.conversion_rate < 30 && data.totals.quotes > 5) suggestions.push(`Platform dönüşüm oranı %${data.totals.conversion_rate} — teklif takip otomasyonu eklenebilir`);
    if (suggestions.length === 0) suggestions.push("Tüm metrikler sağlıklı görünüyor 🎉");

    return NextResponse.json({ usage, scores, forecast, suggestions });
  } catch (err) {
    console.error("[api/admin/ai]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
