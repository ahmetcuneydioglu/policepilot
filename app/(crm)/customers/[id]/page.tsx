"use client";

/**
 * SigortaOS — Müşteri Kontrol Merkezi
 *
 * /customers/[id] — müşteriye ait tüm operasyonların tam ekran merkezi.
 * Veri tek istekte /api/customers/[id] üzerinden gelir; sekmeler
 * components/customer/ altında bağımsız bileşenlerdir (mobilde yeniden
 * kullanılabilir).
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, RefreshCw, LayoutDashboard, FileText, Zap,
  FolderOpen, StickyNote, History, AlertTriangle, Phone, MessageCircle,
  HeartHandshake,
} from "lucide-react";

import type { CustomerBundle } from "@/components/customer/types";
import { initials, fmtDate } from "@/components/customer/types";
import OverviewTab      from "@/components/customer/OverviewTab";
import PoliciesTab      from "@/components/customer/PoliciesTab";
import RenewalsTab      from "@/components/customer/RenewalsTab";
import QuotesTab        from "@/components/customer/QuotesTab";
import DocumentsTab     from "@/components/customer/DocumentsTab";
import NotesTab         from "@/components/customer/NotesTab";
import TimelineTab      from "@/components/customer/TimelineTab";
import RelationshipTab  from "@/components/customer/RelationshipTab";
import CommunicationTab from "@/components/customer/CommunicationTab";

type TabKey = "relationship" | "overview" | "policies" | "renewals" | "quotes" | "documents" | "communication" | "notes" | "timeline";

const TABS: { key: TabKey; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "relationship",  label: "İlişki",         Icon: HeartHandshake },
  { key: "overview",      label: "Genel Bakış",    Icon: LayoutDashboard },
  { key: "policies",      label: "Poliçeler",      Icon: FileText },
  { key: "renewals",      label: "Yenilemeler",    Icon: RefreshCw },
  { key: "quotes",        label: "Teklifler",      Icon: Zap },
  { key: "documents",     label: "Evraklar",       Icon: FolderOpen },
  { key: "communication", label: "İletişim",       Icon: MessageCircle },
  { key: "notes",         label: "Notlar",         Icon: StickyNote },
  { key: "timeline",      label: "İşlem Geçmişi",  Icon: History },
];

export default function CustomerControlCenterPage() {
  const { id } = useParams<{ id: string }>();
  const { loading: authLoading } = useAuth();

  const [data,    setData]    = useState<CustomerBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<TabKey>("relationship");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/customers/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Müşteri yüklenemedi.");
      setData(json as CustomerBundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Müşteri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  // ── Sekme rozetleri (sayılar) ───────────────────────────────────────────────
  const counts: Partial<Record<TabKey, number>> = data ? {
    policies:      data.policies.length,
    renewals:      data.stats.upcoming_renewals,
    quotes:        data.quote_runs.length,
    documents:     data.documents.length,
    communication: data.timeline.filter(e => e.type === "whatsapp" || e.type === "quote_run").length,
    timeline:      data.timeline.length,
  } : {};

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Müşteri yüklenemedi</h2>
        <p className="text-sm text-slate-500">{error || "Bilinmeyen hata."}</p>
        <Link href="/customers"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Müşterilere Dön
        </Link>
      </div>
    );
  }

  const { customer } = data;

  return (
    <div className="space-y-5">

      {/* ── Üst bar ── */}
      <Link href="/customers" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Müşteriler
      </Link>

      {/* ── Müşteri başlığı ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-5">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
            {initials(customer.name)}
          </div>
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-xl font-bold text-white tracking-tight">{customer.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {customer.phone && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-200">
                  <Phone className="w-3 h-3" /> {customer.phone}
                </span>
              )}
              <span className="text-xs text-blue-300/70">
                Müşteri: {fmtDate(customer.created_at)}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold text-blue-200">
                {customer.insurance_type}
              </span>
            </div>
          </div>
          {/* ── Müşteri Durumu mini özeti — 5 saniyede anla ── */}
          <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 min-w-[180px]">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${data.insights.status_summary.state === "active" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
              <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">
                Müşteri Durumu · {data.insights.status_summary.state === "active" ? "Aktif" : "Pasif"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-0.5 text-[11px] text-blue-100">
              <span><b className="text-white">{data.insights.status_summary.active_policies}</b> aktif poliçe</span>
              <span><b className="text-white">{data.insights.status_summary.upcoming_renewals}</b> yaklaşan yenileme</span>
              <span><b className="text-white">{data.insights.status_summary.documents}</b> evrak · <b className="text-white">{data.insights.status_summary.open_quotes}</b> açık teklif</span>
              <span><b className="text-emerald-300">{data.insights.status_summary.cross_sell}</b> çapraz satış fırsatı</span>
            </div>
          </div>

          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-blue-200 hover:bg-white/20 transition-all"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Sekme çubuğu ── */}
      <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              tab === t.key
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
            {counts[t.key] != null && counts[t.key]! > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sekme içeriği ── */}
      {tab === "relationship"  && (
        <RelationshipTab
          customerId={customer.id}
          customerAgencyId={customer.agency_id}
          timeline={data.timeline}
          tags={customer.tags ?? []}
          onTagsChange={(tags) => setData(prev => prev ? { ...prev, customer: { ...prev.customer, tags } } : prev)}
          summary={customer.relationship_summary ?? null}
          summaryAt={customer.relationship_summary_at ?? null}
          onSummary={(relationship_summary, relationship_summary_at) =>
            setData(prev => prev ? { ...prev, customer: { ...prev.customer, relationship_summary, relationship_summary_at } } : prev)}
        />
      )}
      {tab === "overview"      && <OverviewTab data={data} onNavigate={(t) => setTab(t as TabKey)} />}
      {tab === "policies"      && <PoliciesTab policies={data.policies} />}
      {tab === "renewals"      && <RenewalsTab policies={data.policies} />}
      {tab === "quotes"        && <QuotesTab quoteRuns={data.quote_runs} />}
      {tab === "documents"     && <DocumentsTab documents={data.documents} customerPhone={customer.phone || null} customerName={customer.name} />}
      {tab === "communication" && <CommunicationTab timeline={data.timeline} />}
      {tab === "notes"         && (
        <NotesTab
          customerId={customer.id}
          initialNote={customer.note}
          onSaved={(note) => setData(prev => prev ? { ...prev, customer: { ...prev.customer, note } } : prev)}
        />
      )}
      {tab === "timeline"  && <TimelineTab timeline={data.timeline} />}
    </div>
  );
}
