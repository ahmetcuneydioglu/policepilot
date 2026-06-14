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
  ChevronDown, ShieldCheck, RotateCcw, Mail, Phone, Clock,
  Trophy, TrendingUp, Crown, Activity, UserPlus, X,
} from "lucide-react";
import {
  PlanBadge, SectionCard, KpiCard, LoadingGrid, ErrorBox,
  fmtMoney, fmtNum, fmtDate, fmtDateTime, timeAgo,
} from "@/components/admin/ui";
import {
  AGENCY_ROLES, PERMISSIONS, PERMISSION_GROUPS, ROLE_TEMPLATES,
  resolvePermissions, agencyRoleLabel,
  type AgencyRole, type PermissionKey,
} from "@/lib/permissions";

type TabKey = "general" | "users" | "performance" | "customers" | "quotes" | "policies" | "whatsapp" | "subscription" | "logs" | "ai";

const TABS: { key: TabKey; label: string; Icon: typeof Users }[] = [
  { key: "general",      label: "Genel",        Icon: LayoutDashboard },
  { key: "users",        label: "Kullanıcılar", Icon: Users },
  { key: "performance",  label: "Personel Performansı", Icon: Trophy },
  { key: "customers",    label: "Müşteriler",   Icon: UserSquare2 },
  { key: "quotes",       label: "Teklifler",    Icon: Zap },
  { key: "policies",     label: "Poliçeler",    Icon: FileText },
  { key: "whatsapp",     label: "WhatsApp",     Icon: MessageCircle },
  { key: "subscription", label: "Abonelik",     Icon: CreditCard },
  { key: "logs",         label: "Loglar",       Icon: ScrollText },
  { key: "ai",           label: "AI Analizi",   Icon: Bot },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bundle = any;

export default function AdminAgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data,    setData]    = useState<Bundle | null>(null);
  const [perf,    setPerf]    = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<TabKey>("general");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, perfRes] = await Promise.all([
        fetch(`/api/admin/agencies/${id}`),
        fetch(`/api/admin/agencies/${id}/performance`),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Acente yüklenemedi.");
      setData(json);
      // Performans best-effort: hata olsa da sayfa açılır
      const perfJson = await perfRes.json().catch(() => null);
      setPerf(perfRes.ok ? perfJson : null);
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
        <div className="space-y-5">
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
          <LeaderBoard perf={perf} onSeeAll={() => setTab("performance")} />
        </div>
      )}

      {/* ── Personel Performansı ── */}
      {tab === "performance" && <PerformancePanel perf={perf} />}

      {/* ── Kullanıcılar ── */}
      {tab === "users" && (
        <UsersPanel agencyId={a.id} users={data.users} onSaved={load} />
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
                <span className="text-base">{{ customer: "👤", quote: "⚡", quote_run: "⚡", policy: "🛡️", document: "📎", whatsapp: "💬", user: "🔑" }[l.type] ?? "•"}</span>
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

// ─── Kullanıcılar paneli (rol, durum, telefon, granular yetki) ────────────────

type AgencyUser = {
  id: string;
  full_name: string | null;
  role: string;                 // sistem rolü (salt-okunur)
  agency_role: string | null;   // SaaS rolü (düzenlenebilir)
  status: string | null;
  phone: string | null;
  email: string | null;
  last_login_at: string | null;
  permissions: Record<string, boolean> | null;
  created_at: string;
};

function UsersPanel({ agencyId, users, onSaved }: {
  agencyId: string;
  users: AgencyUser[];
  onSaved: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  return (
    <SectionCard
      title="Kullanıcılar"
      subtitle={`${users?.length ?? 0} kullanıcı · rol, durum ve yetkiler`}
      actions={
        <button onClick={() => setInviting((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors">
          {inviting ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {inviting ? "Kapat" : "Yeni Kullanıcı"}
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {inviting && <InviteUserForm agencyId={agencyId} onDone={() => { setInviting(false); onSaved(); }} />}
        {(!users || users.length === 0) ? (
          <p className="px-1 py-6 text-center text-xs text-slate-400">Bu acentede kullanıcı yok</p>
        ) : (
          users.map((u) => (
            <UserCard key={u.id} agencyId={agencyId} user={u} onSaved={onSaved} />
          ))
        )}
      </div>
    </SectionCard>
  );
}

function InviteUserForm({ agencyId, onDone }: { agencyId: string; onDone: () => void }) {
  const [email, setEmail]   = useState("");
  const [name, setName]     = useState("");
  const [role, setRole]     = useState<AgencyRole>("sales");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink]     = useState<string | null>(null);

  const INPUT = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50";

  async function invite() {
    setSaving(true); setMsg(null); setLink(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name, agency_role: role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Davet başarısız.");
      setMsg({ ok: true, text: "Kullanıcı davet edildi ✓" });
      setLink(json.inviteLink ?? null);
      setEmail(""); setName("");
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Davet başarısız." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <p className="text-xs font-bold text-indigo-700">Yeni Personel Davet Et</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-posta" className={INPUT} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad (opsiyonel)" className={INPUT} />
      </div>
      <div className="flex flex-wrap gap-2">
        {AGENCY_ROLES.map((r) => (
          <button key={r.value} type="button" onClick={() => setRole(r.value)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              role === r.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      {msg && (
        <p className={`text-xs rounded-xl px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>
      )}
      {link && (
        <div className="text-[11px] bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
          <p className="font-semibold text-slate-500">Davet linki (personele iletin):</p>
          <p className="break-all text-indigo-600">{link}</p>
          <button onClick={() => navigator.clipboard?.writeText(link)} className="text-indigo-600 font-semibold hover:underline">Kopyala</button>
        </div>
      )}
      <button onClick={invite} disabled={saving}
        className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
        {saving ? "Davet ediliyor…" : "Davet Et"}
      </button>
    </div>
  );
}

function UserCard({ agencyId, user, onSaved }: {
  agencyId: string;
  user: AgencyUser;
  onSaved: () => void;
}) {
  const initialRole = (AGENCY_ROLES.some(r => r.value === user.agency_role) ? user.agency_role : "owner") as AgencyRole;

  const [agencyRole, setAgencyRole] = useState<AgencyRole>(initialRole);
  const [status, setStatus]   = useState<string>(user.status ?? "active");
  const [phone, setPhone]     = useState<string>(user.phone ?? "");
  const [perms, setPerms]     = useState<Record<PermissionKey, boolean>>(
    () => resolvePermissions(initialRole, user.permissions)
  );
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const isSuperAdmin = user.role === "super_admin";
  const enabledCount = Object.values(perms).filter(Boolean).length;

  function pickRole(r: AgencyRole) {
    setAgencyRole(r);
    setPerms({ ...ROLE_TEMPLATES[r] }); // role seçimi → o rolün varsayılan yetkileri
    setMsg(null);
  }

  function togglePerm(k: PermissionKey) {
    setPerms(p => ({ ...p, [k]: !p[k] }));
    setMsg(null);
  }

  function resetToRoleDefault() {
    setPerms({ ...ROLE_TEMPLATES[agencyRole] });
    setMsg(null);
  }

  // Şablondan farklı anahtarları override olarak hesapla
  function computeOverride(): Record<string, boolean> | null {
    const template = ROLE_TEMPLATES[agencyRole];
    const diff: Record<string, boolean> = {};
    for (const k of Object.keys(perms) as PermissionKey[]) {
      if (perms[k] !== template[k]) diff[k] = perms[k];
    }
    return Object.keys(diff).length ? diff : null;
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_role: agencyRole,
          status,
          phone: phone.trim(),
          permissions: computeOverride(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Kaydedildi ✓" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  const INPUT = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50";
  const initials = (user.full_name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Üst satır: kimlik + meta */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-800 truncate">{user.full_name ?? "İsimsiz"}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
              isSuperAdmin ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-100 text-slate-600 ring-slate-200"
            }`}>
              {isSuperAdmin ? "Platform Yöneticisi" : "Acente Kullanıcısı"}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
              status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
              status === "invited" ? "bg-amber-50 text-amber-700 ring-amber-200" :
              "bg-rose-50 text-rose-600 ring-rose-200"
            }`}>
              {status === "active" ? "Aktif" : status === "invited" ? "Davetli" : "Askıda"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{user.email ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{phone || "—"}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Son giriş: {user.last_login_at ? timeAgo(user.last_login_at) : "—"}</span>
            <span>· {agencyRoleLabel(agencyRole)}</span>
          </div>
        </div>
      </div>

      {/* Düzenleme alanı */}
      <div className="px-4 pb-4 space-y-3">
        {/* Rol */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Acente Rolü</label>
          <div className="flex flex-wrap gap-2">
            {AGENCY_ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => pickRole(r.value)}
                title={r.description}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  agencyRole === r.value
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Durum + Telefon */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Durum</label>
            <button type="button" onClick={() => { setStatus(s => s === "active" ? "suspended" : "active"); setMsg(null); }}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                status === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-600 border-rose-200"
              }`}>
              {status === "active" ? "🟢 Aktif" : "🔴 Askıda"}
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Telefon</label>
            <input value={phone} onChange={e => { setPhone(e.target.value); setMsg(null); }}
              placeholder="5xx xxx xx xx" className={INPUT} />
          </div>
        </div>

        {/* Yetkiler (collapse) */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50/60 hover:bg-slate-50 transition-colors">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Yetkiler
              <span className="text-[10px] font-semibold text-slate-400">{enabledCount}/{PERMISSIONS.length} açık</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="p-3 space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={resetToRoleDefault}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
                  <RotateCcw className="w-3 h-3" /> Rol varsayılanına dön
                </button>
              </div>
              {PERMISSION_GROUPS.map(group => {
                const items = PERMISSIONS.filter(p => p.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {items.map(p => (
                        <button key={p.key} type="button" onClick={() => togglePerm(p.key)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all text-left ${
                            perms[p.key]
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          }`}>
                          <span className="truncate">{p.label}</span>
                          <span className={`ml-2 w-7 h-4 rounded-full flex items-center px-0.5 flex-shrink-0 transition-colors ${perms[p.key] ? "bg-indigo-500 justify-end" : "bg-slate-200 justify-start"}`}>
                            <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {msg && (
          <p className={`text-xs rounded-xl px-3 py-2 border ${
            msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
          }`}>{msg.text}</p>
        )}

        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Performans: liderlik tablosu + personel kartları ─────────────────────────

type PerfUser = {
  id: string; name: string; role_label: string;
  customers: number; quotes_total: number; quotes_month: number; quotes_won: number;
  policies_total: number; policies_month: number; total_premium: number;
  conversion: number; last_activity: string | null;
};

function LeaderCard({ label, name, value, Icon, tone }: {
  label: string; name: string | null; value: string; Icon: typeof Trophy;
  tone: "amber" | "indigo" | "emerald" | "violet" | "blue";
}) {
  const tones: Record<string, string> = {
    amber: "from-amber-500 to-orange-600", indigo: "from-indigo-500 to-violet-600",
    emerald: "from-emerald-500 to-teal-600", violet: "from-violet-500 to-purple-600",
    blue: "from-blue-500 to-indigo-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tones[tone]} flex items-center justify-center shadow-sm`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
      </div>
      {name ? (
        <>
          <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
          <p className="text-lg font-black text-slate-900 leading-tight mt-0.5">{value}</p>
        </>
      ) : (
        <p className="text-xs text-slate-300 py-2">Henüz veri yok</p>
      )}
    </div>
  );
}

function LeaderBoard({ perf, onSeeAll }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  perf: any;
  onSeeAll: () => void;
}) {
  const L = perf?.leaders;
  const hasAny = L && (L.most_active || L.top_quotes || L.top_policies || L.top_premium || L.top_conversion);
  return (
    <SectionCard
      title="Personel Liderliği"
      subtitle="created_by + aktivite verisinden"
      actions={
        <button onClick={onSeeAll} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
          Tümünü gör →
        </button>
      }
    >
      <div className="p-4">
        {!hasAny ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Henüz kişiye atfedilmiş işlem yok. Bu özellik, kullanıcılar müşteri/teklif/poliçe oluşturdukça dolar
            (Faz 1 öncesi kayıtlar atfedilemez).
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <LeaderCard label="En Aktif" Icon={Activity} tone="blue"
              name={L.most_active?.name ?? null}
              value={L.most_active?.last_activity ? timeAgo(L.most_active.last_activity) : "—"} />
            <LeaderCard label="En Çok Teklif" Icon={Zap} tone="amber"
              name={L.top_quotes?.name ?? null}
              value={`${fmtNum(L.top_quotes?.quotes_total ?? 0)} teklif`} />
            <LeaderCard label="En Çok Poliçe" Icon={FileText} tone="indigo"
              name={L.top_policies?.name ?? null}
              value={`${fmtNum(L.top_policies?.policies_total ?? 0)} poliçe`} />
            <LeaderCard label="En Çok Prim" Icon={Crown} tone="violet"
              name={L.top_premium?.name ?? null}
              value={fmtMoney(L.top_premium?.total_premium ?? 0)} />
            <LeaderCard label="En Yüksek Dönüşüm" Icon={TrendingUp} tone="emerald"
              name={L.top_conversion?.name ?? null}
              value={`%${L.top_conversion?.conversion ?? 0}`} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function Last7Chart({ last7 }: { last7: { date: string; count: number }[] }) {
  const max = Math.max(1, ...last7.map((d) => d.count));
  return (
    <SectionCard title="Son 7 Gün Aktivitesi" subtitle="Acente geneli işlem sayısı">
      <div className="p-5 flex items-end gap-2 h-40">
        {last7.map((d) => {
          const h = Math.round((d.count / max) * 100);
          const label = new Date(`${d.date}T00:00:00+03:00`).toLocaleDateString("tr-TR", { weekday: "short" });
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
              <span className="text-[10px] font-bold text-slate-500">{d.count}</span>
              <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-violet-500 transition-all"
                style={{ height: `${Math.max(4, h)}%` }} />
              <span className="text-[9px] text-slate-400 capitalize">{label}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function PerformancePanel({ perf }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  perf: any;
}) {
  if (!perf) {
    return <SectionCard title="Personel Performansı"><p className="px-5 py-8 text-center text-xs text-slate-400">Performans verisi yüklenemedi. Migration çalıştırıldı mı?</p></SectionCard>;
  }
  const users = ([...(perf.users ?? [])] as PerfUser[])
    .sort((a, b) => b.total_premium - a.total_premium);

  return (
    <div className="space-y-5">
      <LeaderBoard perf={perf} onSeeAll={() => {}} />
      <Last7Chart last7={perf.last7 ?? []} />
      <SectionCard title="Personel Detayı" subtitle={`${users.length} kullanıcı · bu ay teklif/poliçe, toplam prim, dönüşüm`}>
        {users.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">Kullanıcı yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-100">
                  {["Personel", "Rol", "Müşteri", "Teklif (Bu Ay/Top)", "Poliçe (Bu Ay/Top)", "Toplam Prim", "Dönüşüm", "Son Aktivite"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{u.role_label}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{fmtNum(u.customers)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap"><span className="font-bold text-indigo-600">{fmtNum(u.quotes_month)}</span> / {fmtNum(u.quotes_total)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap"><span className="font-bold text-indigo-600">{fmtNum(u.policies_month)}</span> / {fmtNum(u.policies_total)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-800 whitespace-nowrap">{fmtMoney(u.total_premium)}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <span className={u.conversion >= 50 ? "text-emerald-600 font-bold" : u.conversion >= 20 ? "text-amber-600 font-semibold" : "text-slate-400"}>%{u.conversion}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{u.last_activity ? timeAgo(u.last_activity) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {perf.unattributed > 0 && (
          <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-50">
            ℹ️ {fmtNum(perf.unattributed)} müşteri kişiye atfedilemedi (Faz 1 öncesi, created_by yok).
          </p>
        )}
      </SectionCard>
    </div>
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
