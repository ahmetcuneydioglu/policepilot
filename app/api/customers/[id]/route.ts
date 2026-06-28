/**
 * GET   /api/customers/[id] — Müşteri Kontrol Merkezi toplu verisi
 * PATCH /api/customers/[id] — müşteri notu güncelleme
 *
 * Tek istekte: müşteri + poliçeler + teklif çalışmaları + evraklar +
 * WhatsApp mesajları + işlem geçmişi (timeline). Web ve mobil aynı
 * endpoint'i kullanır — client tarafında ek sorgu gerekmez.
 *
 * Multi-tenant: agency_user yalnız kendi acentesinin müşterisine erişir,
 * super_admin hepsine. Service role kullanılır (RLS bağımsız, tutarlı).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildCustomerInsights } from "@/lib/customerInsights";
import { resolveCaller, requirePermission, type ApiCaller } from "../../whatsapp/_lib/auth";
import { scopeByUser } from "@/lib/tenant";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineEvent = {
  type: "customer_created" | "quote_run" | "policy_issued" | "policy_created"
      | "renewal_completed" | "whatsapp" | "renewal_notification";
  title: string;
  description: string | null;
  date: string;
  ref_id: string | null;
};

type CustomerRow = {
  id: string; agency_id: string | null; name: string; phone: string;
  email: string | null; identity_no: string | null; insurance_type: string;
  note: string | null; created_at: string;
  extra_data: Record<string, string> | null;
};

async function getAuthorizedCustomer(customerId: string, caller: ApiCaller) {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("customers") as any)
    .select("*")
    .eq("id", customerId)
    .maybeSingle();

  if (!data) return null;
  if (caller.role !== "super_admin") {
    // Acente sınırı
    if (data.agency_id !== caller.agencyId) return null;
    // Kişi-bazlı kapsam: satış/operasyon/görüntüleyici yalnız kendi müşterisini açabilir
    if (scopeByUser(caller) && data.created_by !== caller.userId) return null;
  }
  return data as CustomerRow;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const customer = await getAuthorizedCustomer(id, caller);
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();

    // Paralel: poliçeler, teklifler, evraklar, whatsapp
    const [polRes, runRes, docRes, waRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("policies") as any)
        .select("*")
        .eq("customer_id", id)
        .order("end_date", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("quote_runs") as any)
        .select("*, quote_results(id, company_name, price, status)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.from("documents") as any)
        .select("id, policy_id, file_name, file_path, file_type, file_size, bucket, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      // WhatsApp mesajları telefon üzerinden eşleşir (queue müşteri id tutmaz)
      customer.phone
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (admin.from("whatsapp_queue") as any)
            .select("id, phone, status, message, sent_at, created_at, template_key")
            .eq("agency_id", customer.agency_id)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    type Pol = {
      id: string; policy_type: string; status: string; premium: number | null;
      commission: number | null; end_date: string; created_at: string;
      issued_at: string | null; renewed_at: string | null; renewal_status: string | null;
      insurance_company: string | null; policy_no: string | null;
    };
    type Run = { id: string; created_at: string; status: string; product_type: string; quote_results?: { id: string; price: number | null }[] };
    type Wa  = { id: string; status: string; message: string; sent_at: string | null; created_at: string; template_key: string | null };

    const policies  = (polRes.data ?? []) as Pol[];
    const quoteRuns = (runRes.data ?? []) as Run[];
    const documents = docRes.data ?? [];

    // WhatsApp: müşterinin telefonuyla eşleşenler (normalize ederek)
    const normPhone = (p: string) => p.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "");
    const custPhone = normPhone(customer.phone ?? "");
    type WaRow = Wa & { phone?: string };
    const whatsapp = custPhone
      ? ((waRes.data ?? []) as (WaRow & { phone: string })[]).filter(
          (w) => normPhone(w.phone ?? "") === custPhone
        )
      : [];

    // ── Özet istatistikler ────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const in30  = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const activePolicies = policies.filter(p => p.status === "Aktif");
    const stats = {
      total_premium:     policies.reduce((s, p) => s + (p.premium ?? 0), 0),
      total_commission:  policies.reduce((s, p) => s + (p.commission ?? 0), 0),
      active_policies:   activePolicies.length,
      upcoming_renewals: activePolicies.filter(p =>
        p.renewal_status !== "completed" && p.end_date >= today && p.end_date <= in30
      ).length,
    };

    // ── Timeline ──────────────────────────────────────────────────────────
    const customerCreated: TimelineEvent = {
      type: "customer_created",
      title: "Müşteri oluşturuldu",
      description: `${customer.name} sisteme kaydedildi`,
      date: customer.created_at,
      ref_id: customer.id,
    };
    const events: TimelineEvent[] = [
      customerCreated,
      ...quoteRuns.map((r): TimelineEvent => ({
        type: "quote_run",
        title: "Teklif çalışıldı",
        description: `${r.product_type} — ${(r.quote_results ?? []).filter(q => q.price != null).length} teklif alındı`,
        date: r.created_at,
        ref_id: r.id,
      })),
      ...policies.map((p): TimelineEvent => ({
        type: p.issued_at ? "policy_issued" : "policy_created",
        title: p.issued_at ? "Poliçe kesildi" : "Poliçe kaydı oluşturuldu",
        description: `${p.policy_type}${p.insurance_company ? ` — ${p.insurance_company}` : ""}${p.policy_no ? ` (${p.policy_no})` : ""}`,
        date: p.issued_at ?? p.created_at,
        ref_id: p.id,
      })),
      ...policies.filter(p => p.renewed_at).map((p): TimelineEvent => ({
        type: "renewal_completed",
        title: "Yenileme tamamlandı",
        description: `${p.policy_type} poliçesi yeni poliçe ile yenilendi`,
        date: p.renewed_at!,
        ref_id: p.id,
      })),
      ...whatsapp.map((w): TimelineEvent => ({
        type: "whatsapp",
        title: w.status === "sent" ? "WhatsApp gönderildi" : w.status === "skipped" ? "WhatsApp (test) oluşturuldu" : "WhatsApp kuyruğa alındı",
        description: w.template_key === "daily_summary" ? "Günlük operasyon özeti" : w.message.split("\n")[0].slice(0, 80),
        date: w.sent_at ?? w.created_at,
        ref_id: w.id,
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    // ── İçgörüler: kural tabanlı motor (ileride AI'ya devredilecek) ───────
    const insights = buildCustomerInsights({
      customer:   { name: customer.name, note: customer.note, created_at: customer.created_at },
      policies,
      quote_runs: quoteRuns,
      documents,
      whatsapp,
    });

    return NextResponse.json({
      customer,
      policies,
      quote_runs: quoteRuns,
      documents,
      whatsapp,
      stats,
      timeline: events,
      insights,
    });
  } catch (err) {
    console.error("[api/customers/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PATCH — not güncelleme ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const denied = requirePermission(caller, "customer.edit");
    if (denied) return denied;

    const customer = await getAuthorizedCustomer(id, caller);
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body.note === "string") update.note = body.note.trim() || null;
    if (body.muayene_bitis !== undefined) {
      const v = typeof body.muayene_bitis === "string" ? body.muayene_bitis.trim() : "";
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return NextResponse.json({ error: "muayene_bitis YYYY-AA-GG biçiminde olmalı." }, { status: 400 });
      }
      update.muayene_bitis = v || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("customers") as any).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/customers/[id] PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
