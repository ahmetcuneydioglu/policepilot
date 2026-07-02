"use client";

/**
 * "Bugün" şeridi — dashboard'ın devam-noktası (Monday felsefesi: rapor değil aksiyon).
 * Sabah Brifingi + 4 aksiyon kovası: görevler (tamamla ✓) / yenilemeler /
 * takip zamanı gelen fırsatlar / yeni lead'ler. "+ Görev" ile hızlı görev ekleme.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sunrise, RefreshCw, CalendarClock, Zap, ChevronRight, CheckCircle2, Circle, Plus, X, ListTodo } from "lucide-react";
import { stageOf } from "@/lib/opportunities";

type Cust = { name: string } | null;
type Today = {
  briefing: string;
  today: string;
  renewals: { id: string; policy_type: string; end_date: string; customers: Cust }[];
  followups: { id: string; request_type: string; status: string; customers: Cust }[];
  leads: { id: string; request_type: string; created_at: string; customers: Cust }[];
  tasks?: { id: string; title: string; due_date: string | null; customers: Cust }[];
};

function dayDiff(iso: string, today: string): number {
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5);
}

/* ── Hızlı görev ekleme modalı ─────────────────────────────────────────────── */
function TaskQuickAdd({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Yönetici ise atama listesi (değilse endpoint 403 döner → alan gizli kalır)
    fetch("/api/agency/members").then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.members)) setMembers(j.members); })
      .catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Görev başlığı yazın."); return; }
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), due_date: due || null, assigned_to: assignee || undefined }),
    });
    setSaving(false);
    if (res.ok) { onSaved(); onClose(); }
    else setError((await res.json())?.error ?? "Kaydedilemedi.");
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">Yeni Görev</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="Örn: Salı günü Ayşe Hanım'ı ara"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vade</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {members.length > 0 && (
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sorumlu</label>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Ben</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {saving ? "Kaydediliyor…" : "Görevi Oluştur"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Ana şerit ─────────────────────────────────────────────────────────────── */
export default function TodayStrip() {
  const [data, setData] = useState<Today | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [doneBusy, setDoneBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/today").then((r) => r.json()).then((j) => { if (!j?.error) setData(j); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Sidebar "+ Yeni → Yeni Görev": /dashboard?task=1 → modal aç
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("task") === "1") {
      setAddOpen(true);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const completeTask = async (id: string) => {
    setDoneBusy(id);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }),
    });
    setDoneBusy(null);
    if (res.ok) setData((d) => d ? { ...d, tasks: (d.tasks ?? []).filter((t) => t.id !== id) } : d);
  };

  if (!data || !data.briefing) return null;
  const tasks = data.tasks ?? [];

  const buckets = [
    {
      key: "ren", title: "Yenileme Bekleyen", Icon: RefreshCw,
      tint: "bg-amber-50 text-amber-600", href: "/renewals",
      items: data.renewals.map((r) => {
        const d = dayDiff(r.end_date, data.today);
        return { id: r.id, href: "/renewals", name: r.customers?.name ?? "Müşteri", sub: r.policy_type, tag: d < 0 ? `${Math.abs(d)}g gecikti` : d === 0 ? "bugün" : `${d}g kaldı`, tagCls: d <= 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700" };
      }),
    },
    {
      key: "fol", title: "Takip Zamanı Geldi", Icon: CalendarClock,
      tint: "bg-indigo-50 text-indigo-600", href: "/firsatlar",
      items: data.followups.map((f) => ({ id: f.id, href: `/firsatlar?open=${f.id}`, name: f.customers?.name ?? "Müşteri", sub: f.request_type, tag: f.status, tagCls: stageOf(f.status).badge })),
    },
    {
      key: "led", title: "Yeni Lead", Icon: Zap,
      tint: "bg-blue-50 text-blue-600", href: "/firsatlar",
      items: data.leads.map((l) => ({ id: l.id, href: `/firsatlar?open=${l.id}`, name: l.customers?.name ?? "Müşteri", sub: l.request_type, tag: "yanıt bekliyor", tagCls: "bg-blue-50 text-blue-700" })),
    },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* Sabah Brifingi + Görev ekle */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-900 to-blue-950">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Sunrise className="w-4 h-4 text-amber-300" />
        </div>
        <p className="flex-1 text-sm text-blue-100 font-medium leading-snug">{data.briefing}</p>
        <button onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors flex-shrink-0">
          <Plus className="w-3.5 h-3.5" /> Görev
        </button>
      </div>

      {/* Görevler (tamamla ✓) */}
      {tasks.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ListTodo className="w-3.5 h-3.5" /></span>
            <span className="text-xs font-bold text-slate-700">Görevler</span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 tabular-nums">{tasks.length}</span>
          </div>
          <div className="space-y-1">
            {tasks.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group">
                <button onClick={() => completeTask(t.id)} disabled={doneBusy === t.id}
                  className="flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors" title="Tamamla">
                  {doneBusy === t.id ? <CheckCircle2 className="w-4.5 h-4.5 w-[18px] h-[18px] text-emerald-500" /> : <Circle className="w-[18px] h-[18px] group-hover:hidden" />}
                  {doneBusy !== t.id && <CheckCircle2 className="w-[18px] h-[18px] hidden group-hover:block" />}
                </button>
                <p className="text-xs font-semibold text-slate-800 truncate flex-1">
                  {t.title}{t.customers?.name ? <span className="text-slate-400 font-normal"> · {t.customers.name}</span> : null}
                </p>
                {t.due_date && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${dayDiff(t.due_date, data.today) < 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>
                    {dayDiff(t.due_date, data.today) < 0 ? `${Math.abs(dayDiff(t.due_date, data.today))}g gecikti` : "bugün"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aksiyon kovaları */}
      {buckets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-t border-slate-50">
          {buckets.map((b) => (
            <div key={b.key} className="p-4">
              <Link href={b.href} className="flex items-center justify-between mb-2.5 group">
                <span className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${b.tint}`}><b.Icon className="w-3.5 h-3.5" /></span>
                  <span className="text-xs font-bold text-slate-700">{b.title}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 tabular-nums">{b.items.length}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </Link>
              <div className="space-y-1">
                {b.items.slice(0, 3).map((it) => (
                  <Link key={it.id} href={it.href}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{it.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{it.sub}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${it.tagCls}`}>{it.tag}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && <TaskQuickAdd onClose={() => setAddOpen(false)} onSaved={load} />}
    </div>
  );
}
