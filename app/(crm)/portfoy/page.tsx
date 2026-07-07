"use client";

/**
 * PORTFÖY — Satış Hattı (uzun satış döngüsü Kanban'ı).
 * İki Dünya mimarisi: kısa döngü Fırsatlar'da (requests), uzun döngü burada (deals).
 * 10 aşamalı board · sürükle-bırak · bayat iş uyarısı · Kaybedilenler listesi · drawer.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withScopeFilter } from "@/lib/tenant";
import {
  DEAL_STAGES, dealStageOf, daysSinceTouch, lostReasonLabel,
  STALE_WARN_DAYS, STALE_DANGER_DAYS, type Deal, type Account,
} from "@/lib/portfolio";
import type { Customer } from "@/lib/database.types";
import { fmtMoney } from "@/lib/format";
import AddDealModal from "@/components/portfolio/AddDealModal";
import DealDrawer from "@/components/portfolio/DealDrawer";
import EmptyState from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Plus, KanbanSquare, Search, User2, Undo2 } from "lucide-react";

type Member = { id: string; full_name: string };

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Son temas yaşı rozeti — "kim müşteriyi bekletiyor" görsel cevabı. */
function TouchBadge({ deal }: { deal: Deal }) {
  const d = daysSinceTouch(deal);
  if (d < STALE_WARN_DAYS) return <span className="text-[10px] text-slate-400">{d === 0 ? "bugün" : `${d}g önce`}</span>;
  const danger = d >= STALE_DANGER_DAYS;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${danger ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
      ⏳ {d}g
    </span>
  );
}

export default function PortfolioPage() {
  const { role, agencyId, profile, user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [managerial, setManagerial] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [showLost, setShowLost] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/portfolio");
    const j = await res.json();
    if (res.ok) {
      setDeals(j.deals ?? []);
      setAccounts(j.accounts ?? []);
      setMembers(j.members ?? []);
      setManagerial(!!j.managerial);
      setSelfId(j.selfId ?? null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ⌘K / global "+ Yeni": ?new=1 → modal, ?open=<id> → drawer
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") setShowAdd(true);
    const openParam = sp.get("open");
    if (openParam) setOpenId(openParam);
    if (sp.get("new") || openParam) window.history.replaceState({}, "", "/portfoy");
  }, []);

  // Müşteri listesi (iş açma modalı için)
  useEffect(() => {
    if (role !== "super_admin" && !agencyId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withScopeFilter(supabase.from("customers").select("id, name, phone, insurance_type, note, created_at, created_by") as any, role, agencyId, user?.id, profile?.agency_role)
      .order("name")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setCustomers((data ?? []) as Customer[]));
  }, [role, agencyId, user?.id, profile?.agency_role]);

  const filtered = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("tr");
    return deals.filter((d) => {
      if (ownerFilter && d.owner_id !== ownerFilter) return false;
      if (!s) return true;
      return (
        d.title.toLocaleLowerCase("tr").includes(s) ||
        (d.customers?.name ?? "").toLocaleLowerCase("tr").includes(s) ||
        (d.accounts?.name ?? "").toLocaleLowerCase("tr").includes(s) ||
        d.product_interest.toLocaleLowerCase("tr").includes(s) ||
        (d.owner_name ?? "").toLocaleLowerCase("tr").includes(s)
      );
    });
  }, [deals, search, ownerFilter]);

  const open = useMemo(() => filtered.filter((d) => d.status === "open"), [filtered]);
  const lost = useMemo(() => filtered.filter((d) => d.status === "lost"), [filtered]);

  const kpis = useMemo(() => {
    const openAll = deals.filter((d) => d.status === "open");
    const won = openAll.filter((d) => d.stage === "policelesti" || d.stage === "referans_kazanildi").length;
    const stale = openAll.filter((d) => d.stage !== "policelesti" && d.stage !== "referans_kazanildi" && daysSinceTouch(d) >= STALE_WARN_DAYS).length;
    const pipeline = openAll.filter((d) => d.stage !== "policelesti" && d.stage !== "referans_kazanildi")
      .reduce((sum, d) => sum + (d.expected_premium ?? 0), 0);
    return [
      { label: "Açık İş", value: String(openAll.length - won), tint: "bg-blue-50 text-blue-600" },
      { label: "Poliçeleşen", value: String(won), tint: "bg-emerald-50 text-emerald-600" },
      { label: "Bekleyen Prim", value: pipeline > 0 ? fmtMoney(pipeline) : "—", tint: "bg-indigo-50 text-indigo-600" },
      { label: "Bayat İş (7g+)", value: String(stale), tint: stale > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500" },
      { label: "Kaybedilen", value: String(deals.filter((d) => d.status === "lost").length), tint: "bg-rose-50 text-rose-600" },
    ];
  }, [deals]);

  // Optimistik aşama taşıma (drag-drop + drawer)
  const moveStage = useCallback(async (id: string, stage: string) => {
    const prev = deals.find((d) => d.id === id)?.stage;
    if (prev === stage) return;
    setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, stage, stage_changed_at: new Date().toISOString() } : d)));
    const res = await fetch(`/api/portfolio/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }),
    });
    if (!res.ok) load(); // hata → sunucu doğrusuna dön
  }, [deals, load]);

  const openDeal = openId ? deals.find((d) => d.id === openId) ?? null : null;

  if (loading) {
    return <div className="max-w-6xl"><ListSkeleton kpis={5} rows={6} /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3 flex-wrap max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Satış Hattı</h1>
          <p className="text-sm text-slate-400">Uzun döngülü işleri ilişki üzerinden yönetin — Hayat, BES, kurumsal portföyler</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Yeni İş
        </button>
      </div>

      {/* KPI şeridi */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 max-w-6xl">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-3.5 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{k.label}</p>
            <p className={`text-lg font-extrabold mt-1 tabular-nums inline-block px-1.5 rounded-lg ${k.tint}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Araç çubuğu */}
      <div className="flex items-center justify-between gap-3 flex-wrap max-w-6xl">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İş, kişi, hesap veya personel ara…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex items-center gap-2">
          {managerial && members.length > 1 && (
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Tüm personel</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
          <button onClick={() => setShowLost((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${showLost ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            Kaybedilenler {lost.length > 0 ? `(${lost.length})` : ""}
          </button>
        </div>
      </div>

      {/* İçerik */}
      {deals.length === 0 ? (
        <div className="max-w-6xl">
          <EmptyState Icon={KanbanSquare} title="Satış Hattı boş"
            desc="İlk işinizi açın: Hayat, BES veya kurumsal bir görüşmeyi Lead olarak ekleyin — poliçeye kadar buradan takip edin."
            actionLabel="Yeni İş" onAction={() => setShowAdd(true)} />
        </div>
      ) : showLost ? (
        <LostList deals={lost} onOpen={setOpenId} onReopen={(id) => fetch(`/api/portfolio/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "open" }),
        }).then(() => load())} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {DEAL_STAGES.map((stage) => {
            const items = open.filter((d) => d.stage === stage.key);
            return (
              <div key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) { moveStage(dragId, stage.key); setDragId(null); } }}
                className={`w-60 flex-shrink-0 bg-slate-100/70 rounded-2xl border-t-4 ${stage.accent}`}>
                <div className="px-3.5 py-2.5 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{stage.label}</p>
                  <span className="text-[10px] font-bold text-slate-400 bg-white rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="px-2 pb-2 space-y-2 min-h-[120px]">
                  {items.map((d) => (
                    <div key={d.id} draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setOpenId(d.id)}
                      className={`bg-white rounded-xl border border-slate-200/70 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragId === d.id ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {initials(d.customers?.name ?? d.title)}
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate">{d.customers?.name ?? d.title}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-0.5 truncate">
                        {d.product_interest}{d.expected_premium != null ? ` · ${fmtMoney(d.expected_premium)}` : ""}
                      </p>
                      {d.accounts && <p className="text-[10px] text-slate-400 mb-1 truncate">🏢 {d.accounts.name}</p>}
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1 truncate"><User2 className="w-3 h-3 flex-shrink-0" />{d.owner_name ?? "Atanmadı"}</span>
                        {stage.key !== "policelesti" && stage.key !== "referans_kazanildi" && <TouchBadge deal={d} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddDealModal customers={customers} accounts={accounts} members={members}
          managerial={managerial} selfId={selfId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }} />
      )}
      {openDeal && (
        <DealDrawer deal={openDeal} members={members} managerial={managerial}
          onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}

/* ── Kaybedilenler listesi ──────────────────────────────────────────────── */
function LostList({ deals, onOpen, onReopen }: { deals: Deal[]; onOpen: (id: string) => void; onReopen: (id: string) => void }) {
  if (deals.length === 0) {
    return <p className="text-sm text-slate-400 max-w-6xl">Kaybedilen iş yok. 🎉</p>;
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-w-6xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="px-4 py-3">İş</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Sorumlu</th>
              <th className="px-4 py-3">Kayıp Nedeni</th>
              <th className="px-4 py-3">Kaybedildiği Aşama</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {deals.map((d) => (
              <tr key={d.id} onClick={() => onOpen(d.id)} className="hover:bg-rose-50/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{d.customers?.name ?? d.title}</td>
                <td className="px-4 py-3 text-slate-600">{d.product_interest}</td>
                <td className="px-4 py-3 text-slate-500">{d.owner_name ?? "—"}</td>
                <td className="px-4 py-3 text-rose-600 font-medium">{lostReasonLabel(d.lost_reason) ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dealStageOf(d.stage).badge}`}>{dealStageOf(d.stage).label}</span>
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onReopen(d.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">
                    <Undo2 className="w-3.5 h-3.5" /> Geri Aç
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
