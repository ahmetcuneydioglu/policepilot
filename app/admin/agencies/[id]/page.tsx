"use client";

/**
 * Acente Yönetim Paneli — /admin/agencies/[id]
 * Sekmeler: Genel · Kullanıcılar · Müşteriler · Teklifler · Poliçeler ·
 * WhatsApp · Abonelik · Loglar · Yapay Zeka Analizi
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2, ChevronLeft, RefreshCw, Users, UserSquare2, Zap, FileText,
  MessageCircle, CreditCard, ScrollText, Bot, LayoutDashboard,
} from "lucide-react";
import {
  PlanBadge, SectionCard, KpiCard, LoadingGrid, ErrorBox,
  fmtMoney, fmtNum, fmtDate, fmtDateTime, timeAgo,
} from "@/components/admin/ui";

type TabKey = "general" | "users" | "customers" | "quotes" | "policies" | "whatsapp" | "subscription" | "logs" | "ai";

const TABS: { key: TabKey; label: string; Icon: typeof Users }[] = [
  { key: "general",      label: "Genel",       Icon: LayoutDashboard },
  { key: "users",        label: "Kullanıcılar",Icon: Users },
  { key: "customers",    label: "Müşteriler",  Icon: UserSquare2 },
  { key: "quotes",       label: "Teklifler",   Icon: Zap },
  { key: "policies",     label: "Poliçeler",   Icon: FileText },
  { key: "whatsapp",     label: "WhatsApp",    Icon: MessageCircle },
  { key: "subscription", label: "Abonelik",    Icon: CreditCard },
  { key: "logs",         label: "Loglar",      Icon: ScrollText },
  { key: "ai",           label: "AI Analizi",  Icon: Bot },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bundle = any;

export default function AdminAgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data,    setData]    = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<TabKey>("general");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/admin/agencies/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Acente yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Acente yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={3} cols={4} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  const a = data.agency;

  return (
    <div className="space-y-5">
      <Link href="/admin/agencies" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Acenteler
      </Link>

      {/* Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 p-5">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{a.name}</h1>
              <PlanBadge plan={a.plan} />
              {a.is_active
                ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 text-[10px] font-bold">Aktif</span>
                : <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30 text-[10px] font-bold">Pasif</span>}
            </div>
            <p className="text-xs text-indigo-300/70 mt-1">/{a.slug} · Kurulum: {fmtDate(a.created_at)}{a.phone ? ` · ${a.phone}` : ""}</p>
          </div>
          {/* AI skoru */}
          <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-center">
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">AI Skoru</p>
            <p className="text-2xl font-black text-white leading-tight">{data.ai.grade}</p>
            <p className="text-[10px] text-indigo-200">{data.ai.score}/100</p>
          </div>
          <button onClick={load} className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-indigo-200 hover:bg-white/20 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.key ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}>
            <t.Icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Genel ── */}
      {tab === "general" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Kullanıcı" value={fmtNum(data.users.length)} Icon={Users} tone="blue" index={0} />
          <KpiCard label="Müşteri" value={fmtNum(data.customers.length)} Icon={UserSquare2} tone="violet" index={1} />
          <KpiCard label="Teklif" value={fmtNum(data.quotes.length)} Icon={Zap} tone="amber" index={2} />
          <KpiCard label="Poliçe" value={fmtNum(data.policies.length)} Icon={FileText} tone="indigo" index={3} />
          <KpiCard label="Aktif Poliçe" value={fmtNum(data.policies.filter((p: { status: string }) => p.status === "Aktif").length)} tone="emerald" index={4} />
          <KpiCard label="Toplam Prim" value={fmtMoney(data.policies.reduce((s: number, p: { premium: number | null }) => s + (p.premium ?? 0), 0))} tone="indigo" index={5} />
          <KpiCard label="WhatsApp" value={fmtNum(data.whatsapp.length)} Icon={MessageCircle} tone="emerald" index={6} />
          <KpiCard label="Aylık Gelir" value={fmtMoney(data.subscription.monthly_revenue)} sub="Plan bazlı" tone="violet" index={7} />
        </div>
      )}

      {/* ── Kullanıcılar ── */}
      {tab === "users" && (
        <SectionCard title="Kullanıcılar" subtitle={`${data.users.length} kullanıcı`}>
          <SimpleTable
            headers={["Ad Soyad", "Rol", "Kayıt"]}
            rows={data.users.map((u: { id: string; full_name: string; role: string; created_at: string }) => [
              u.full_name, u.role, fmtDate(u.created_at),
            ])}
          />
        </SectionCard>
      )}

      {/* ── Müşteriler ── */}
      {tab === "customers" && (
        <SectionCard title="Müşteriler" subtitle={`Son ${data.customers.length} kayıt`}>
          <SimpleTable
            headers={["Ad Soyad", "Telefon", "Tür", "Kayıt"]}
            rows={data.customers.map((c: { name: string; phone: string; insurance_type: string; created_at: string }) => [
              c.name, c.phone, c.insurance_type, fmtDate(c.created_at),
            ])}
          />
        </SectionCard>
      )}

      {/* ── Teklifler ── */}
      {tab === "quotes" && (
        <SectionCard title="Teklif Çalışmaları" subtitle={`Son ${data.quotes.length} kayıt`}>
          <SimpleTable
            headers={["Müşteri", "Ürün", "Durum", "Teklif Sayısı", "Tarih"]}
            rows={data.quotes.map((q: { customer_name: string | null; product_type: string; status: string; quote_results?: { price: number | null }[]; created_at: string }) => [
              q.customer_name ?? "—", q.product_type, q.status,
              String((q.quote_results ?? []).filter(r => r.price != null).length),
              fmtDateTime(q.created_at),
            ])}
          />
        </SectionCard>
      )}

      {/* ── Poliçeler ── */}
      {tab === "policies" && (
        <SectionCard title="Poliçeler" subtitle={`Son ${data.policies.length} kayıt`}>
          <SimpleTable
            headers={["Tür", "Şirket", "Poliçe No", "Prim", "Durum", "Bitiş"]}
            rows={data.policies.map((p: { policy_type: string; insurance_company: string | null; policy_no: string | null; premium: number | null; status: string; end_date: string }) => [
              p.policy_type, p.insurance_company ?? "—", p.policy_no ?? "—",
              fmtMoney(p.premium), p.status, fmtDate(p.end_date),
            ])}
          />
        </SectionCard>
      )}

      {/* ── WhatsApp ── */}
      {tab === "whatsapp" && (
        <SectionCard title="WhatsApp Mesajları" subtitle={`Son ${data.whatsapp.length} kayıt`}>
          <SimpleTable
            headers={["Durum", "Telefon", "Şablon", "Tarih", "Hata"]}
            rows={data.whatsapp.map((w: { status: string; phone: string; template_key: string | null; created_at: string; error_message: string | null }) => [
              w.status, w.phone, w.template_key ?? "—", fmtDateTime(w.created_at), w.error_message ?? "",
            ])}
          />
        </SectionCard>
      )}

      {/* ── Abonelik ── */}
      {tab === "subscription" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SubscriptionEditor agency={a} onSaved={load} />
          <div className="space-y-4">
          <SectionCard title="Özet" subtitle={data.subscription.plan_label}>
            <div className="p-5 space-y-2 text-sm">
              <Row k="Aylık Gelir" v={fmtMoney(data.subscription.monthly_revenue)} />
              <Row k="Bitiş" v={data.subscription.expires_at ? fmtDate(data.subscription.expires_at) : "Süresiz"} />
              <Row k="Durum" v={a.is_active ? "Aktif" : "Pasif"} />
            </div>
          </SectionCard>
          <SectionCard title="Limit Kullanımı">
            <div className="p-5 space-y-3.5">
              {Object.entries(data.subscription.limits as Record<string, { used: number; max: number }>).map(([k, v]) => {
                const pct = v.max ? Math.min(100, Math.round((v.used / v.max) * 100)) : 0;
                const labels: Record<string, string> = { users: "Kullanıcı", customers: "Müşteri", requests: "Teklif", policies: "Poliçe" };
                return (
                  <div key={k}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600">{labels[k] ?? k}</span>
                      <span className={pct >= 90 ? "text-rose-600 font-bold" : "text-slate-400"}>{v.used} / {v.max} (%{pct})</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          </div>
        </div>
      )}

      {/* ── Loglar ── */}
      {tab === "logs" && (
        <SectionCard title="İşlem Logları" subtitle="Tüm varlıklardan birleşik akış">
          <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
            {data.logs.map((l: { date: string; type: string; text: string }, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-base">{{ customer: "👤", quote: "⚡", policy: "🛡️", whatsapp: "💬" }[l.type] ?? "•"}</span>
                <p className="text-xs text-slate-600 flex-1">{l.text}</p>
                <p className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(l.date)}</p>
              </div>
            ))}
            {data.logs.length === 0 && <p className="px-5 py-6 text-xs text-slate-400">Log kaydı yok</p>}
          </div>
        </SectionCard>
      )}

      {/* ── AI Analizi ── */}
      {tab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Acente Skoru</p>
            <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg ${
              data.ai.grade === "A" ? "bg-gradient-to-br from-emerald-500 to-teal-600" :
              data.ai.grade === "B" ? "bg-gradient-to-br from-blue-500 to-indigo-600" :
              data.ai.grade === "C" ? "bg-gradient-to-br from-amber-500 to-orange-600" :
              "bg-gradient-to-br from-rose-500 to-red-600"
            }`}>{data.ai.grade}</div>
            <p className="text-sm font-bold text-slate-700 mt-3">{data.ai.score}/100</p>
            <p className={`text-xs mt-2 font-semibold ${data.ai.risk.startsWith("Düşük") ? "text-emerald-600" : data.ai.risk.startsWith("Orta") ? "text-amber-600" : "text-rose-600"}`}>
              Risk: {data.ai.risk}
            </p>
          </div>
          <SectionCard title="AI İçgörüleri" subtitle="Kural motoru — gerçek AI'ya hazır" className="lg:col-span-2">
            <ul className="p-5 space-y-2.5">
              {data.ai.insights.map((ins: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-indigo-500 mt-px">✦</span> {ins}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ─── Abonelik düzenleme (plan, durum, bitiş, limitler) ────────────────────────

function SubscriptionEditor({ agency, onSaved }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agency: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    plan:          agency.plan ?? "starter",
    is_active:     Boolean(agency.is_active),
    expires_at:    agency.expires_at ? String(agency.expires_at).slice(0, 10) : "",
    max_users:     String(agency.max_users ?? 20),
    max_customers: String(agency.max_customers ?? 200),
    max_requests:  String(agency.max_requests ?? 500),
    max_policies:  String(agency.max_policies ?? 500),
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res  = await fetch(`/api/admin/agencies/${agency.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan:          form.plan,
          is_active:     form.is_active,
          expires_at:    form.expires_at || null,
          max_users:     form.max_users,
          max_customers: form.max_customers,
          max_requests:  form.max_requests,
          max_policies:  form.max_policies,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Abonelik güncellendi ✓" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  const INPUT = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50";
  const LIMITS: { key: "max_users" | "max_customers" | "max_requests" | "max_policies"; label: string }[] = [
    { key: "max_users",     label: "Maks. Kullanıcı" },
    { key: "max_customers", label: "Maks. Müşteri" },
    { key: "max_requests",  label: "Maks. Teklif" },
    { key: "max_policies",  label: "Maks. Poliçe" },
  ];

  return (
    <SectionCard title="Aboneliği Düzenle" subtitle="Paket, durum, bitiş ve limitler">
      <div className="p-5 space-y-4">

        {/* Paket */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Paket</label>
          <div className="grid grid-cols-3 gap-2">
            {(["starter", "pro", "enterprise"] as const).map(p => (
              <button key={p} type="button" onClick={() => set("plan", p)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                  form.plan === p
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Durum + Bitiş */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Durum</label>
            <button type="button" onClick={() => set("is_active", !form.is_active)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                form.is_active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-600 border-rose-200"
              }`}>
              {form.is_active ? "🟢 Aktif" : "🔴 Pasif"}
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Bitiş Tarihi <span className="font-normal text-slate-300">(boş = süresiz)</span></label>
            <input type="date" value={form.expires_at} onChange={e => set("expires_at", e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Limitler */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Limitler</label>
          <div className="grid grid-cols-2 gap-3">
            {LIMITS.map(l => (
              <div key={l.key}>
                <p className="text-[10px] text-slate-400 mb-1">{l.label}</p>
                <input type="number" min={0} value={form[l.key]}
                  onChange={e => set(l.key, e.target.value)} className={INPUT} />
              </div>
            ))}
          </div>
        </div>

        {msg && (
          <p className={`text-xs rounded-xl px-3 py-2 border ${
            msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
          }`}>{msg.text}</p>
        )}

        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </SectionCard>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{k}</span>
      <span className="text-sm font-semibold text-slate-800">{v}</span>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-xs text-slate-400">Kayıt yok</p>;
  return (
    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="border-b border-slate-100">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/60 transition-colors">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap max-w-[260px] truncate">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
