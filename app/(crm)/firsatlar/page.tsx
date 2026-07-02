"use client";

/**
 * Satış Fırsatları — CRM satış hattı (liste + kanban).
 * KPI şeridi · Liste/Kanban görünüm · sürükle-bırak aşama · detay drawer.
 * Veri: GET /api/requests (scope). Aşama: PATCH /api/requests/[id] (optimistik).
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withScopeFilter } from "@/lib/tenant";
import { STAGES, stageOf } from "@/lib/opportunities";
import type { Customer, RequestStatus } from "@/lib/database.types";
import { fmtMoney } from "@/lib/format";
import AddRequestModal from "@/components/AddRequestModal";
import OpportunityDrawer from "@/components/opportunities/OpportunityDrawer";
import EmptyState from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Plus, LayoutList, KanbanSquare, Search, User2, CalendarClock, Undo2, ChevronDown } from "lucide-react";
import { STAGES as ALL_STAGES } from "@/lib/opportunities";

type Opp = {
  id: string; customer_id: string; request_type: string; status: RequestStatus;
  price_offer: number | null; created_at: string; updated_at: string | null;
  assigned_to: string | null; assigned_name: string | null;
  next_follow_up_date: string | null; notes: string | null; policy_id: string | null;
  customers: { name: string; phone: string | null; email: string | null; identity_no: string | null; insurance_type: string | null } | null;
};

function monthStartMs(): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = p.find((x) => x.type === "year")!.value;
  const m = p.find((x) => x.type === "month")!.value;
  return new Date(`${y}-${m}-01T00:00:00+03:00`).getTime();
}
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function fmtDay(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

export default function OpportunitiesPage() {
  const { role, agencyId, profile, user } = useAuth();
  const router = useRouter();

  const [opps, setOpps] = useState<Opp[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [managerial, setManagerial] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/requests");
    const j = await res.json();
    if (res.ok) { setOpps(j.opportunities ?? []); setMembers(j.members ?? []); setManagerial(!!j.managerial); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ⌘K / global "+ Yeni": ?new=1 → modal, ?open=<id> → drawer, ?view= → görünüm
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") setShowAdd(true);
    const openParam = sp.get("open");
    if (openParam) setOpenId(openParam);
    if (sp.get("view") === "kanban") setView("kanban");
    if (sp.get("new") || openParam) {
      window.history.replaceState({}, "", sp.get("view") === "kanban" ? "/firsatlar?view=kanban" : "/firsatlar");
    }
  }, []);

  // Görünüm tercihi URL'de yaşar (paylaşılabilir + yenilemeye dayanıklı)
  const switchView = (v: "list" | "kanban") => {
    setView(v);
    window.history.replaceState({}, "", v === "kanban" ? "/firsatlar?view=kanban" : "/firsatlar");
  };

  // ── Undo'lu toast (statü değişimleri) ──────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; undo: (() => void) | null } | null>(null);
  const toastTimer = useCallback((t: typeof toast) => {
    setToast(t);
    if (t) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 6000);
  }, []);

  // Müşteri listesi (fırsat oluşturma modalı için)
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
    if (!s) return opps;
    return opps.filter((o) =>
      (o.customers?.name ?? "").toLocaleLowerCase("tr").includes(s) ||
      o.request_type.toLocaleLowerCase("tr").includes(s) ||
      (o.assigned_name ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [opps, search]);

  const kpis = useMemo(() => {
    const cnt = (s: string) => opps.filter((o) => o.status === s).length;
    const won = cnt("Kazanıldı"), lost = cnt("Kaybedildi");
    const ms = monthStartMs();
    const wonMonth = opps.filter((o) => o.status === "Kazanıldı" && new Date(o.updated_at ?? o.created_at).getTime() >= ms).length;
    return [
      { label: "Toplam Fırsat", value: String(opps.length), tint: "bg-slate-100 text-slate-600" },
      { label: "Yeni Lead", value: String(cnt("Yeni Lead")), tint: "bg-blue-50 text-blue-600" },
      { label: "Teklif Hazırlanıyor", value: String(cnt("Teklif Hazırlanıyor")), tint: "bg-violet-50 text-violet-600" },
      { label: "Kazanılan", value: String(won), tint: "bg-emerald-50 text-emerald-600" },
      { label: "Kaybedilen", value: String(lost), tint: "bg-rose-50 text-rose-600" },
      { label: "Dönüşüm", value: `%${won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0}`, tint: "bg-indigo-50 text-indigo-600" },
      { label: "Bu Ay Kazanılan", value: String(wonMonth), tint: "bg-amber-50 text-amber-600" },
    ];
  }, [opps]);

  // Optimistik aşama taşıma (kanban drag + liste inline + drawer) + Geri Al
  const patchStage = useCallback(async (id: string, status: RequestStatus) => {
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, status, updated_at: new Date().toISOString() } : o)));
    const res = await fetch(`/api/requests/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (!res.ok) load(); // hata → sunucu doğrusuna dön
    return res.ok;
  }, [load]);

  const moveStage = useCallback(async (id: string, status: RequestStatus) => {
    const prev = opps.find((o) => o.id === id)?.status;
    if (prev === status) return;
    const ok = await patchStage(id, status);
    if (ok && prev) {
      toastTimer({
        msg: `Aşama "${status}" olarak güncellendi`,
        undo: () => { patchStage(id, prev); setToast(null); },
      });
    }
  }, [opps, patchStage, toastTimer]);

  const convert = useCallback((d: { id: string; customer_id: string; request_type: string }) => {
    router.push(`/policies?firsat=${d.id}&customer=${d.customer_id}&type=${encodeURIComponent(d.request_type)}`);
  }, [router]);

  if (loading) {
    return <div className="max-w-6xl"><ListSkeleton kpis={7} rows={6} /></div>;
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Satış Fırsatları</h1>
          <p className="text-sm text-slate-400">Lead'den poliçeye satış sürecinizi yönetin</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Yeni Fırsat
        </button>
      </div>

      {/* KPI şeridi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-3.5 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{k.label}</p>
            <p className={`text-xl font-extrabold mt-1 tabular-nums inline-block px-1.5 rounded-lg ${k.tint}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Araç çubuğu */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Müşteri, tür veya personel ara…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          {([{ k: "list", l: "Liste", I: LayoutList }, { k: "kanban", l: "Kanban", I: KanbanSquare }] as const).map((v) => (
            <button key={v.k} onClick={() => switchView(v.k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === v.k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <v.I className="w-4 h-4" /> {v.l}
            </button>
          ))}
        </div>
      </div>

      {/* İçerik */}
      {filtered.length === 0 ? (
        search.trim() ? (
          <EmptyState Icon={Search} title="Aramanızla eşleşen fırsat yok" desc="Farklı bir müşteri adı, tür veya personel deneyin." />
        ) : (
          <EmptyState Icon={KanbanSquare} title="Henüz satış fırsatı yok"
            desc="İlk fırsatınızı oluşturun; lead'den poliçeye tüm süreci buradan yönetin."
            actionLabel="Yeni Fırsat" onAction={() => setShowAdd(true)} />
        )
      ) : view === "list" ? (
        <ListView opps={filtered} onOpen={setOpenId} onStage={moveStage} />
      ) : (
        <KanbanView opps={filtered} dragId={dragId} setDragId={setDragId} onDrop={moveStage} onOpen={setOpenId} />
      )}

      {showAdd && (
        <AddRequestModal customers={customers} agencyId={agencyId}
          onClose={() => { setShowAdd(false); load(); }} />
      )}
      {openId && (
        <OpportunityDrawer id={openId} members={members} managerial={managerial}
          onClose={() => setOpenId(null)} onChanged={load} onConvert={convert} />
      )}

      {/* Undo'lu toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 bg-slate-900 text-white text-sm rounded-2xl shadow-2xl pl-4 pr-2 py-2.5 animate-fade-in-up">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button onClick={toast.undo}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors">
              <Undo2 className="w-3.5 h-3.5" /> Geri Al
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Liste görünümü ─────────────────────────────────────────────────────── */
function ListView({ opps, onOpen, onStage }: { opps: Opp[]; onOpen: (id: string) => void; onStage: (id: string, s: RequestStatus) => void }) {
  // Inline aşama değiştirme: rozet tıklanınca küçük popover (drawer'sız statü)
  const [stageOpen, setStageOpen] = useState<string | null>(null);
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="px-4 py-3">Müşteri</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3">Sorumlu</th>
              <th className="px-4 py-3">Aşama</th>
              <th className="px-4 py-3">Takip</th>
              <th className="px-4 py-3 text-right">Prim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {opps.map((o) => (
              <tr key={o.id} onClick={() => onOpen(o.id)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {initials(o.customers?.name ?? "?")}
                    </div>
                    <span className="font-medium text-slate-800">{o.customers?.name ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.request_type}</td>
                <td className="px-4 py-3 text-slate-500">{o.assigned_name ?? <span className="text-slate-300">Atanmadı</span>}</td>
                <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setStageOpen(stageOpen === o.id ? null : o.id)}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-shadow hover:ring-2 hover:ring-slate-200 ${stageOf(o.status).badge}`}
                    title="Aşamayı değiştir">
                    {o.status} <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {stageOpen === o.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStageOpen(null)} />
                      <div className="absolute left-4 top-full mt-1 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                        {ALL_STAGES.map((s) => (
                          <button key={s.key}
                            onClick={() => { setStageOpen(null); if (s.key !== o.status) onStage(o.id, s.key); }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors ${s.key === o.status ? "font-bold text-slate-900" : "text-slate-600"}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                            {s.key}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{fmtDay(o.next_follow_up_date) ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">{o.price_offer != null ? fmtMoney(o.price_offer) : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Kanban görünümü (native HTML5 drag-drop) ───────────────────────────── */
function KanbanView({
  opps, dragId, setDragId, onDrop, onOpen,
}: {
  opps: Opp[];
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (id: string, status: RequestStatus) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((stage) => {
        const items = opps.filter((o) => o.status === stage.key);
        return (
          <div key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId) { onDrop(dragId, stage.key); setDragId(null); } }}
            className={`w-64 flex-shrink-0 bg-slate-100/70 rounded-2xl border-t-4 ${stage.accent}`}>
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{stage.key}</p>
              <span className="text-[10px] font-bold text-slate-400 bg-white rounded-full px-2 py-0.5">{items.length}</span>
            </div>
            <div className="px-2 pb-2 space-y-2 min-h-[120px]">
              {items.map((o) => (
                <div key={o.id} draggable
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(o.id)}
                  className={`bg-white rounded-xl border border-slate-200/70 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragId === o.id ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {initials(o.customers?.name ?? "?")}
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{o.customers?.name ?? "—"}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-1.5">{o.request_type}{o.price_offer != null ? ` · ${fmtMoney(o.price_offer)}` : ""}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1 truncate"><User2 className="w-3 h-3 flex-shrink-0" />{o.assigned_name ?? "Atanmadı"}</span>
                    {o.next_follow_up_date && <span className="inline-flex items-center gap-1 flex-shrink-0"><CalendarClock className="w-3 h-3" />{fmtDay(o.next_follow_up_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
