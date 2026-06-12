/**
 * GET /api/admin/overview — Operasyon Merkezi toplu verisi (yalnız super_admin)
 * KPI kartları + Sistem Sağlığı + Executive Overview tek istekte.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";
import { inspectMetaToken } from "@/services/whatsapp/metaToken";
import { requireSuperAdmin } from "../_lib/auth";
import { collectPlatformData } from "../_lib/stats";

type Health = { key: string; label: string; status: "ok" | "warn" | "down" | "off"; detail: string };

async function checkHealth(): Promise<Health[]> {
  const admin = getSupabaseAdmin();
  const checks: Health[] = [];

  // Supabase — basit ping
  const t0 = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (admin.from("agencies") as any).select("id", { head: true, count: "exact" });
  checks.push({
    key: "supabase", label: "Supabase",
    status: dbErr ? "down" : "ok",
    detail: dbErr ? dbErr.message : `${Date.now() - t0}ms`,
  });

  // WhatsApp API — platform token durumu
  try {
    const cfg = await getPlatformWhatsAppConfig();
    if (cfg.provider !== "meta_cloud") {
      checks.push({ key: "whatsapp", label: "WhatsApp API", status: "warn", detail: "Mock modda" });
    } else if (!cfg.token) {
      checks.push({ key: "whatsapp", label: "WhatsApp API", status: "down", detail: "Token tanımsız" });
    } else {
      const st = await inspectMetaToken(cfg.token);
      checks.push({
        key: "whatsapp", label: "WhatsApp API",
        status: !st.valid ? "down" : st.expiring_soon ? "warn" : "ok",
        detail: !st.valid ? (st.error ?? "Token geçersiz") : st.hours_left != null ? `Token ~${Math.round(st.hours_left / 24)} gün` : "Token süresiz",
      });
    }
  } catch {
    checks.push({ key: "whatsapp", label: "WhatsApp API", status: "down", detail: "Kontrol edilemedi" });
  }

  // Cron — son daily_summary üretim zamanı (>26 saat ise sorun)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastCron } = await (admin.from("whatsapp_queue") as any)
    .select("created_at").eq("template_key", "daily_summary")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const cronAgeH = lastCron ? (Date.now() - new Date(lastCron.created_at).getTime()) / 36e5 : null;
  checks.push({
    key: "cron", label: "Cron Jobs",
    status: cronAgeH == null ? "warn" : cronAgeH < 26 ? "ok" : "down",
    detail: cronAgeH == null ? "Henüz çalışmadı" : `Son çalışma ${Math.round(cronAgeH)} saat önce`,
  });

  // Storage — bucket erişimi
  try {
    const { data: buckets, error: stErr } = await admin.storage.listBuckets();
    checks.push({
      key: "storage", label: "Storage",
      status: stErr ? "down" : "ok",
      detail: stErr ? stErr.message : `${buckets?.length ?? 0} bucket`,
    });
  } catch {
    checks.push({ key: "storage", label: "Storage", status: "down", detail: "Erişilemedi" });
  }

  // AI Servisleri — OCR (OpenAI) yapılandırması
  checks.push({
    key: "ai", label: "AI Servisleri",
    status: process.env.OPENAI_API_KEY ? "ok" : "off",
    detail: process.env.OPENAI_API_KEY ? `OCR aktif (${process.env.OPENAI_OCR_MODEL ?? "gpt-5.5"})` : "Yapılandırılmadı",
  });

  // Henüz entegre olmayanlar — dürüstçe "off"
  checks.push({ key: "email", label: "Email Servisi",     status: "off", detail: "Henüz entegre değil" });
  checks.push({ key: "push",  label: "Push Notification", status: "off", detail: "Henüz entegre değil" });

  return checks;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const [data, health] = await Promise.all([collectPlatformData(), checkHealth()]);

    const sorted = (key: (s: (typeof data.perAgency)[number]) => number) =>
      [...data.perAgency].sort((a, b) => key(b) - key(a))[0] ?? null;

    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const growth7d = data.perAgency
      .map(s => ({
        s,
        growth: data.raw.customers.filter(c => c.agency_id === s.agency.id && c.created_at >= weekAgo).length
              + data.raw.policies.filter(p => p.agency_id === s.agency.id && p.created_at >= weekAgo).length,
      }))
      .sort((a, b) => b.growth - a.growth)[0] ?? null;

    const in14d = new Date(Date.now() + 14 * 864e5).toISOString();
    const compact = (s: (typeof data.perAgency)[number] | null, value?: string) =>
      s ? { id: s.agency.id, name: s.agency.name, plan: s.agency.plan, value: value ?? "" } : null;

    const executive = {
      most_active:      compact(sorted(s => s.customers + s.quotes + s.policies + s.whatsapp_total), undefined),
      most_quotes:      (() => { const s = sorted(x => x.quotes);          return compact(s, s ? `${s.quotes} teklif` : ""); })(),
      most_policies:    (() => { const s = sorted(x => x.policies);        return compact(s, s ? `${s.policies} poliçe` : ""); })(),
      most_whatsapp:    (() => { const s = sorted(x => x.whatsapp_total);  return compact(s, s ? `${s.whatsapp_total} mesaj` : ""); })(),
      fastest_growing:  growth7d && growth7d.growth > 0 ? compact(growth7d.s, `+${growth7d.growth} kayıt / 7 gün`) : null,
      over_limit:       data.perAgency.filter(s => s.max_limit_usage >= 0.9)
                          .map(s => ({ id: s.agency.id, name: s.agency.name, usage: Math.round(s.max_limit_usage * 100) })),
      trial_expiring:   data.agencies.filter(a => a.expires_at && a.expires_at <= in14d && a.is_active)
                          .map(a => ({ id: a.id, name: a.name, expires_at: a.expires_at })),
      at_risk:          data.perAgency.filter(s => {
                          const idleDays = s.last_activity ? (Date.now() - new Date(s.last_activity).getTime()) / 864e5 : 999;
                          return !s.agency.is_active || idleDays > 14;
                        }).map(s => ({
                          id: s.agency.id, name: s.agency.name,
                          reason: !s.agency.is_active ? "Pasif" : "14+ gündür işlem yok",
                        })),
    };

    return NextResponse.json({ totals: data.totals, health, executive });
  } catch (err) {
    console.error("[api/admin/overview]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
