"use client";

/**
 * Satış Merkezi — platform lead kanbanı (yeni acente kazanımı).
 * Sürükle-bırak ile durum değişimi; veriler platform_leads tablosunda.
 */

import { useEffect, useState, useCallback } from "react";
import { Target, RefreshCw, Plus, Trash2, Phone } from "lucide-react";
import { PageHeader, LoadingGrid, ErrorBox, timeAgo } from "@/components/admin/ui";

type Lead = {
  id: string; name: string; company: string | null; phone: string | null;
  email: string | null; source: string | null; status: string; note: string | null;
  created_at: string;
};

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "new",          label: "Yeni Lead",        accent: "border-t-blue-500" },
  { key: "contacted",    label: "İletişim Kuruldu", accent: "border-t-indigo-500" },
  { key: "demo_planned", label: "Demo Planlandı",   accent: "border-t-violet-500" },
  { key: "demo_done",    label: "Demo Yapıldı",     accent: "border-t-purple-500" },
  { key: "proposal",     label: "Teklif Verildi",   accent: "border-t-amber-500" },
  { key: "won",          label: "Müşteri Oldu",     accent: "border-t-emerald-500" },
  { key: "lost",         label: "Kaybedildi",       accent: "border-t-rose-400" },
];

export default function AdminLeadsPage() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState({ name: "", company: "", phone: "", source: "" });
  const [dragId,  setDragId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/leads");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lead'ler yüklenemedi.");
      setLeads(json.leads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lead'ler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function addLead() {
    if (!form.name.trim()) return;
    const res  = await fetch("/api/admin/leads", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setLeads(prev => [json.lead, ...prev]);
      setForm({ name: "", company: "", phone: "", source: "" });
      setAdding(false);
    } else {
      setError(json.error ?? "Lead eklenemedi.");
    }
  }

  async function moveLead(id: string, status: string) {
    // Optimistic — UI anında güncellenir, hata olursa geri yüklenir
    const prev = leads;
    setLeads(p => p.map(l => (l.id === id ? { ...l, status } : l)));
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (!res.ok) setLeads(prev);
  }

  async function removeLead(id: string) {
    const prev = leads;
    setLeads(p => p.filter(l => l.id !== id));
    const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    if (!res.ok) setLeads(prev);
  }

  if (loading) return <LoadingGrid rows={2} cols={5} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Satış Merkezi"
        subtitle={`${leads.length} lead · ${leads.filter(l => l.status === "won").length} kazanıldı`}
        Icon={Target}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Yeni Lead
            </button>
            <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {error && <ErrorBox message={error} />}

      {/* Hızlı ekleme */}
      {adding && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 flex items-end gap-2 flex-wrap">
          {([
            ["name", "Acente / Yetkili adı *"],
            ["company", "Firma"],
            ["phone", "Telefon"],
            ["source", "Kaynak (web, referans…)"],
          ] as const).map(([k, ph]) => (
            <input key={k} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              placeholder={ph}
              className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          ))}
          <button onClick={addLead} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all">Ekle</button>
          <button onClick={() => setAdding(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500">Vazgeç</button>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.map(col => {
          const items = leads.filter(l => l.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragId) { moveLead(dragId, col.key); setDragId(null); } }}
              className={`w-60 flex-shrink-0 bg-slate-100/70 rounded-2xl border-t-4 ${col.accent}`}
            >
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{col.label}</p>
                <span className="text-[10px] font-bold bg-white text-slate-500 rounded-full px-1.5 py-0.5 border border-slate-200">{items.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-[120px]">
                {items.map(l => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`bg-white rounded-xl border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${dragId === l.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-bold text-slate-800 leading-tight">{l.name}</p>
                      <button onClick={() => removeLead(l.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {l.company && <p className="text-[10px] text-slate-400 mt-0.5">{l.company}</p>}
                    {l.phone && (
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                        <Phone className="w-2.5 h-2.5" /> {l.phone}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {l.source ? <span className="text-[9px] font-bold bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">{l.source}</span> : <span />}
                      <span className="text-[9px] text-slate-300">{timeAgo(l.created_at)}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-[10px] text-slate-300 text-center py-6">Sürükleyip bırakın</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
