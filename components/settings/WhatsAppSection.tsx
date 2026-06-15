"use client";

/**
 * WhatsApp — acentenin bildirim tercihleri + durum kartları.
 * GET/PUT /api/whatsapp/settings, son gönderimler /api/whatsapp/queue.
 * Meta Cloud teknik yapılandırması (token vb.) PLATFORM/super_admin işidir →
 * "Gelişmiş ayarlar" /settings/whatsapp'a yönlendirir.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MessageCircle, CheckCircle2, Clock, Send, Settings2 } from "lucide-react";

type Settings = { whatsapp_enabled: boolean; whatsapp_phone: string; daily_summary_enabled: boolean };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative rounded-full transition-colors flex-shrink-0 ${on ? "bg-emerald-500" : "bg-slate-200"}`} style={{ width: 42, height: 24 }}>
      <span className="absolute bg-white rounded-full shadow-sm transition-transform" style={{ width: 18, height: 18, top: 3, transform: on ? "translateX(21px)" : "translateX(3px)" }} />
    </button>
  );
}

export default function WhatsAppSection() {
  const [s, setS] = useState<Settings>({ whatsapp_enabled: false, whatsapp_phone: "", daily_summary_enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [sentToday, setSentToday] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setRes, qRes] = await Promise.all([
        fetch("/api/whatsapp/settings"),
        fetch("/api/whatsapp/queue?limit=200").catch(() => null),
      ]);
      const setJson = await setRes.json();
      if (setRes.ok) setS(setJson.settings);
      if (qRes && qRes.ok) {
        const qJson = await qRes.json();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        const cnt = ((qJson.items ?? []) as { status: string; created_at: string }[])
          .filter((r) => (r.created_at ?? "").slice(0, 10) === today && (r.status === "sent" || r.status === "skipped")).length;
        setSentToday(cnt);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(next: Settings) {
    setS(next); setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Kaydedilemedi."); }
      setMsg({ ok: true, text: "Kaydedildi ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  const cards = [
    { label: "Bağlantı Durumu", value: s.whatsapp_enabled ? "Aktif" : "Kapalı", Icon: CheckCircle2, tone: s.whatsapp_enabled ? "emerald" : "slate" },
    { label: "Günlük Özet",     value: s.daily_summary_enabled ? "Açık" : "Kapalı", Icon: Clock, tone: s.daily_summary_enabled ? "indigo" : "slate" },
    { label: "Bugün Gönderilen", value: sentToday == null ? "—" : String(sentToday), Icon: Send, tone: "violet" },
  ];
  const toneCls: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-600", indigo: "bg-indigo-100 text-indigo-600",
    violet: "bg-violet-100 text-violet-600", slate: "bg-slate-100 text-slate-400",
  };

  return (
    <div className="space-y-4">
      {/* Durum kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toneCls[c.tone]}`}>
              <c.Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.label}</p>
              <p className="text-lg font-bold text-slate-800 leading-tight">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <p className={`text-xs rounded-xl px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>
      )}

      {/* Tercihler */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">Bildirim Tercihleri</p>
        </div>
        <div className="divide-y divide-slate-50">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">WhatsApp Bildirimleri</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Operasyon özetleri ve hatırlatmalar WhatsApp ile gönderilsin</p>
            </div>
            <Toggle on={s.whatsapp_enabled} onClick={() => persist({ ...s, whatsapp_enabled: !s.whatsapp_enabled })} />
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Günlük Operasyon Özeti</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Her sabah 09:00'da günlük özet mesajı al</p>
            </div>
            <Toggle on={s.daily_summary_enabled} onClick={() => persist({ ...s, daily_summary_enabled: !s.daily_summary_enabled })} />
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-slate-800 mb-1.5">Bildirim Numarası</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={s.whatsapp_phone}
                onChange={(e) => setS({ ...s, whatsapp_phone: e.target.value })}
                onBlur={() => persist(s)}
                placeholder="905XXXXXXXXX"
                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-white"
              />
              {saving && <span className="text-[11px] text-slate-400">kaydediliyor…</span>}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Günlük özet ve bildirimler bu numaraya gönderilir.</p>
          </div>
        </div>
      </div>

      <Link href="/settings/whatsapp" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
        <Settings2 className="w-3.5 h-3.5" /> Gelişmiş WhatsApp ayarları & test gönderimi
      </Link>
    </div>
  );
}
