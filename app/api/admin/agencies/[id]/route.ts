/**
 * GET   /api/admin/agencies/[id] — acente yönetim paneli toplu verisi
 * PATCH /api/admin/agencies/[id] — abonelik/limit/durum düzenleme
 * (yalnız super_admin)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { planMonthlyRevenue, PLAN_LABELS } from "@/lib/planPricing";
import { requireSuperAdmin } from "../../_lib/auth";
import { changePlan, transition } from "@/lib/billing/subscription";
import { getEffectiveLimits } from "@/lib/billing/resolver";
import { getUsageSnapshot, trPeriodStart } from "@/lib/billing/usage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (table: string) => admin.from(table) as any;

    const [agRes, usersRes, custRes, runsRes, polRes, waRes, setRes, actRes] = await Promise.all([
      t("agencies").select("*").eq("id", id).maybeSingle(),
      t("profiles").select("id, full_name, role, agency_role, status, phone, email, last_login_at, permissions, created_at").eq("agency_id", id).order("created_at"),
      t("customers").select("id, name, phone, insurance_type, created_at").eq("agency_id", id).order("created_at", { ascending: false }).limit(100),
      t("quote_runs").select("id, customer_name, product_type, status, created_at, quote_results(id, price)").eq("agency_id", id).order("created_at", { ascending: false }).limit(100),
      t("policies").select("id, policy_type, status, premium, commission, insurance_company, policy_no, start_date, end_date, created_at, renewal_status").eq("agency_id", id).order("created_at", { ascending: false }).limit(100),
      t("whatsapp_queue").select("id, phone, status, template_key, message, created_at, sent_at, error_message").eq("agency_id", id).order("created_at", { ascending: false }).limit(100),
      t("agency_settings").select("whatsapp_enabled, whatsapp_phone, daily_summary_enabled").eq("agency_id", id).maybeSingle(),
      t("activity_log").select("actor_name, action, entity_type, summary, created_at").eq("agency_id", id).order("created_at", { ascending: false }).limit(100),
    ]);

    if (!agRes.data) return NextResponse.json({ error: "Acente bulunamadı." }, { status: 404 });
    const agency = agRes.data;
    const policies = polRes.data ?? [];
    const quotes   = runsRes.data ?? [];
    const wa       = waRes.data ?? [];

    // ── Loglar: gerçek activity_log (varsa) — kim/ne/ne zaman ──────────────
    type Log = { date: string; type: string; text: string };
    const activity = (actRes.data ?? []) as { actor_name: string | null; action: string; entity_type: string; summary: string | null; created_at: string }[];
    let logs: Log[];
    if (activity.length > 0) {
      logs = activity.map((a) => ({
        date: a.created_at,
        type: a.entity_type,
        text: `${a.actor_name ? `${a.actor_name} · ` : ""}${a.summary ?? `${a.entity_type} ${a.action}`}`,
      }));
    } else {
      // Fallback: activity_log boşsa (migration/eski veri) varlıklardan türet
      logs = [
        ...(custRes.data ?? []).map((c: { created_at: string; name: string }) => ({ date: c.created_at, type: "customer", text: `Müşteri eklendi: ${c.name}` })),
        ...quotes.map((r: { created_at: string; product_type: string; customer_name: string | null }) => ({ date: r.created_at, type: "quote_run", text: `Teklif çalışıldı: ${r.product_type}${r.customer_name ? ` — ${r.customer_name}` : ""}` })),
        ...policies.map((p: { created_at: string; policy_type: string }) => ({ date: p.created_at, type: "policy", text: `Poliçe kaydı: ${p.policy_type}` })),
        ...wa.map((w: { created_at: string; status: string; template_key: string | null }) => ({ date: w.created_at, type: "whatsapp", text: `WhatsApp (${w.template_key ?? "mesaj"}): ${w.status}` })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 80);
    }

    // ── AI analizi (kural motoru) — skor + risk + öneriler ────────────────
    const activePol  = policies.filter((p: { status: string }) => p.status === "Aktif").length;
    const totalPrem  = policies.reduce((s: number, p: { premium: number | null }) => s + (p.premium ?? 0), 0);
    const lastDates  = logs.map(l => l.date);
    const idleDays   = lastDates.length ? Math.floor((Date.now() - new Date(lastDates[0]).getTime()) / 864e5) : 999;
    const wonQuotes  = quotes.filter((q: { status: string }) => q.status === "Kazanıldı").length;
    const conv       = quotes.length ? Math.round((wonQuotes / quotes.length) * 100) : 0;

    let score = 50;
    score += Math.min(20, activePol * 4);
    score += Math.min(15, Math.floor(totalPrem / 10000) * 3);
    score += Math.min(10, conv / 5);
    score -= Math.min(30, idleDays * 2);
    score = Math.max(0, Math.min(100, Math.round(score)));

    const aiAnalysis = {
      score,
      grade: score >= 75 ? "A" : score >= 50 ? "B" : score >= 25 ? "C" : "D",
      risk:  idleDays > 14 ? "Yüksek — uzun süredir işlem yok" : !agency.is_active ? "Yüksek — hesap pasif" : score < 40 ? "Orta" : "Düşük",
      insights: [
        `${activePol} aktif poliçe, toplam ${totalPrem.toLocaleString("tr-TR")} ₺ prim hacmi`,
        `Teklif → poliçe dönüşümü %${conv}`,
        idleDays <= 1 ? "Bugün aktif" : `Son işlem ${idleDays} gün önce`,
        (setRes.data?.daily_summary_enabled ? "Günlük WhatsApp özeti açık" : "Günlük özet kapalı — etkinleştirme önerilir"),
      ],
    };

    // ── Dönemsel limitler (AI kredisi, WhatsApp) — usage_counters TR ayı bazlı ──
    const eff = await getEffectiveLimits(admin, id);
    let aiUsage: { used: number; max: number } | null = null;
    let waUsage: { used: number; max: number } | null = null;
    if (eff?.limits) {
      const snap = await getUsageSnapshot(admin, id, eff.limits);
      aiUsage = snap.ai_credits;
      waUsage = snap.wa_monthly;
    }

    return NextResponse.json({
      agency,
      users:     usersRes.data ?? [],
      customers: custRes.data ?? [],
      quotes,
      policies,
      whatsapp:  wa,
      settings:  setRes.data ?? null,
      subscription: {
        plan:            agency.plan,
        plan_label:      PLAN_LABELS[agency.plan] ?? agency.plan,
        monthly_revenue: agency.is_active ? planMonthlyRevenue(agency.plan) : 0,
        expires_at:      agency.expires_at,
        limits: {
          users:      { used: (usersRes.data ?? []).length, max: agency.max_users },
          customers:  { used: (custRes.data ?? []).length,  max: agency.max_customers },
          requests:   { used: quotes.length,                 max: agency.max_requests },
          policies:   { used: policies.length,               max: agency.max_policies },
          ai_credits: aiUsage ?? { used: 0, max: 0 },
          wa_monthly: waUsage ?? { used: 0, max: 0 },
        },
      },
      logs,
      ai: aiAnalysis,
    });
  } catch (err) {
    console.error("[api/admin/agencies/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PATCH — abonelik/limit/durum düzenleme ───────────────────────────────────

const PLANS = ["starter", "pro", "enterprise"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();

    // ── Aksiyon: bu ayki AI kredi kullanımını sıfırla ─────────────────────────
    if (body.reset_ai_usage === true) {
      const admin = getSupabaseAdmin();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("usage_counters") as any)
        .update({ used: 0 })
        .eq("agency_id", id)
        .eq("metric", "ai_credits")
        .eq("period_start", trPeriodStart());
      return NextResponse.json({ ok: true, reset: "ai_credits" });
    }

    const update: Record<string, unknown> = {};

    // plan ve is_active billing motorundan geçer (durum/abonelik senkron + denetim)
    let planChange: string | null = null;
    if (typeof body.plan === "string") {
      if (!PLANS.includes(body.plan)) {
        return NextResponse.json({ error: `Geçersiz plan: ${body.plan}` }, { status: 400 });
      }
      planChange = body.plan;
    }
    let statusChange: boolean | null = null;
    if (typeof body.is_active === "boolean") statusChange = body.is_active;

    if (body.expires_at === null || typeof body.expires_at === "string") {
      update.expires_at = body.expires_at || null;
    }
    // max_* = manuel override (etkin-limit motoru bunu legacy-4 metrikte authoritative okur)
    for (const k of ["max_users", "max_customers", "max_requests", "max_policies"] as const) {
      if (body[k] != null) {
        const n = parseInt(String(body[k]), 10);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${k} sayısal olmalı.` }, { status: 400 });
        }
        update[k] = n;
      }
    }
    // AI Kredisi limiti override — null/'' = plan tabanına dön, dolu = authoritative
    if (body.max_ai_credits === null || body.max_ai_credits === "") {
      update.max_ai_credits = null;
    } else if (body.max_ai_credits != null) {
      const n = parseInt(String(body.max_ai_credits), 10);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "max_ai_credits sayısal olmalı." }, { status: 400 });
      }
      update.max_ai_credits = n;
    }
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.phone === "string") update.phone = body.phone.trim() || null;

    if (Object.keys(update).length === 0 && planChange === null && statusChange === null) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (Object.keys(update).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin.from("agencies") as any).update(update).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (planChange) await changePlan(admin, id, planChange, auth.caller.userId);
    if (statusChange !== null) await transition(admin, id, statusChange ? "active" : "paused", auth.caller.userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/agencies/[id] PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
