"use client";

/**
 * SigortaOS — WhatsApp Kuyruğu
 *
 * whatsapp_queue tablosunun yönetim ekranı.
 * Multi-tenant: agency_user kendi kayıtlarını, super_admin hepsini görür
 * (filtreleme /api/whatsapp/queue içinde service role ile yapılır).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  MessageCircle, RefreshCw, Clock, CheckCircle2, XCircle,
  FlaskConical, Settings, ChevronDown, ChevronUp,
  Send, CalendarDays, Gauge, CalendarClock, Power,
} from "lucide-react";

type QueueItem = {
  id: string;
  agency_id: string;
  phone: string;
  message: string;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  provider: string | null;
  template_key: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
};

type StatusFilter = "Tümü" | "pending" | "sent" | "failed" | "skipped";

const STATUS_CFG: Record<QueueItem["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",       icon: <Clock className="w-3 h-3" /> },
  sent:    { label: "Gönderildi", cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:  { label: "Başarısız",  cls: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",          icon: <XCircle className="w-3 h-3" /> },
  skipped: { label: "Test",       cls: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",    icon: <FlaskConical className="w-3 h-3" /> },
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "Tümü",    label: "Tümü" },
  { key: "pending", label: "Bekliyor" },
  { key: "sent",    label: "Gönderildi" },
  { key: "failed",  label: "Başarısız" },
  { key: "skipped", label: "Test" },
];

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function WhatsAppQueuePage() {
  const { loading: authLoading } = useAuth();

  const [items,   setItems]   = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<StatusFilter>("Tümü");
  const [openId,  setOpenId]  = useState<string | null>(null);
  const [error,   setError]   = useState("");
  const [systemOn, setSystemOn] = useState<boolean | null>(null);
  // "Şimdi" değeri render'da değil veri yüklemede sabitlenir (saf render)
  const [nowMs, setNowMs] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNowMs(Date.now());
    try {
      const [queueRes, settingsRes] = await Promise.all([
        fetch("/api/whatsapp/queue?limit=200"),
        fetch("/api/whatsapp/settings"),
      ]);
      const json = await queueRes.json();
      if (!queueRes.ok) throw new Error(json.error ?? "Kuyruk yüklenemedi.");
      setItems(json.items ?? []);

      if (settingsRes.ok) {
        const sj = await settingsRes.json();
        setSystemOn(Boolean(sj.settings?.whatsapp_enabled && sj.settings?.daily_summary_enabled));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuyruk yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const counts = {
    "Tümü":   items.length,
    pending:  items.filter(i => i.status === "pending").length,
    sent:     items.filter(i => i.status === "sent").length,
    failed:   items.filter(i => i.status === "failed").length,
    skipped:  items.filter(i => i.status === "skipped").length,
  };

  const filtered = filter === "Tümü" ? items : items.filter(i => i.status === filter);

  // ── Operasyon metrikleri (TR günü bazlı, "şimdi" load anında sabitlenir) ───
  const trDay = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : null;
  const todayTr  = nowMs != null ? new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : null;
  const weekAgo  = nowMs != null ? new Date(nowMs - 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : null;
  const delivered = items.filter(i => i.status === "sent" || i.status === "skipped");

  const sentToday = todayTr ? delivered.filter(i => trDay(i.sent_at ?? i.created_at) === todayTr).length : 0;
  const sentWeek  = weekAgo ? delivered.filter(i => {
    const d = trDay(i.sent_at ?? i.created_at);
    return d != null && d >= weekAgo;
  }).length : 0;
  const attempted   = delivered.length + counts.failed;
  const successRate = attempted > 0 ? Math.round((delivered.length / attempted) * 100) : null;
  const lastSentAt  = delivered.reduce<string | null>((max, i) => {
    const d = i.sent_at ?? i.created_at;
    return !max || d > max ? d : max;
  }, null);

  // Sonraki planlanan gönderim: her gün 09:00 TR — bugünkü geçtiyse yarın
  let nextLabel = "—";
  if (nowMs != null) {
    const nowTr = new Date(new Date(nowMs).toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const next  = new Date(nowTr);
    next.setHours(9, 0, 0, 0);
    if (nowTr.getTime() >= next.getTime()) next.setDate(next.getDate() + 1);
    nextLabel = `${next.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} 09:00`;
  }

  const OPS_CARDS = [
    { label: "Bugün Gönderilen",   value: String(sentToday),                                  Icon: Send,          cls: "from-emerald-50 to-teal-100/60 ring-emerald-200/60",  iconBg: "bg-emerald-500", val: "text-emerald-700" },
    { label: "Bu Hafta Gönderilen",value: String(sentWeek),                                   Icon: CalendarDays,  cls: "from-blue-50 to-indigo-100/60 ring-blue-200/60",      iconBg: "bg-blue-500",    val: "text-blue-700" },
    { label: "Başarı Oranı",       value: successRate != null ? `%${successRate}` : "—",      Icon: Gauge,         cls: "from-violet-50 to-purple-100/60 ring-violet-200/60",  iconBg: "bg-violet-500",  val: "text-violet-700" },
    { label: "Son Gönderim",       value: lastSentAt ? fmtDateTime(lastSentAt) : "—",         Icon: Clock,         cls: "from-slate-50 to-slate-100/60 ring-slate-200/60",     iconBg: "bg-slate-500",   val: "text-slate-700" },
    { label: "Sonraki Planlanan",  value: nextLabel,                                          Icon: CalendarClock, cls: "from-amber-50 to-orange-100/60 ring-amber-200/60",    iconBg: "bg-amber-500",   val: "text-amber-700" },
    { label: "Sistem Durumu",      value: systemOn == null ? "—" : systemOn ? "🟢 Aktif" : "🔴 Pasif", Icon: Power, cls: systemOn ? "from-emerald-50 to-green-100/60 ring-emerald-200/60" : "from-rose-50 to-red-100/60 ring-rose-200/60", iconBg: systemOn ? "bg-emerald-600" : "bg-rose-500", val: systemOn ? "text-emerald-700" : "text-rose-700" },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">WhatsApp Kuyruğu</h1>
            <p className="text-sm text-slate-400">Günlük özet ve otomasyon mesajlarının gönderim durumu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/whatsapp"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-300 transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" /> Ayarlar
          </Link>
          <button
            onClick={load}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Operasyon kartları ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {OPS_CARDS.map(c => (
          <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.cls} ring-1 p-3.5`}>
            <div className={`w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center mb-2.5 shadow-sm`}>
              <c.Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{c.label}</p>
            <p className={`text-sm font-bold mt-1 leading-tight ${c.val}`}>
              {loading ? <span className="inline-block w-12 h-4 rounded bg-current opacity-20 animate-pulse" /> : c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filtre chipleri */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              filter === f.key
                ? "bg-emerald-600 text-white border-transparent shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
              filter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
      )}

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse" />
                <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 flex-1 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-6">
            <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">Kuyrukta mesaj yok</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Günlük özetler her sabah 09:00&apos;da (TR) otomatik oluşturulur.{" "}
              <Link href="/settings/whatsapp" className="text-emerald-600 font-semibold hover:underline">
                WhatsApp ayarlarından
              </Link>{" "}
              günlük özeti aktifleştirin.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Başlık */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50/70">
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Durum</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefon</div>
              <div className="col-span-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mesaj</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gönderim</div>
              <div className="col-span-1" />
            </div>

            {filtered.map(item => {
              const cfg  = STATUS_CFG[item.status];
              const open = openId === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="w-full grid grid-cols-12 gap-2 px-5 py-3.5 items-center text-left hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="col-span-4 sm:col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-xs font-mono text-slate-600">{item.phone}</div>
                    <div className="hidden sm:block col-span-5 text-xs text-slate-500 truncate">
                      {item.message.replace(/\n+/g, " · ").slice(0, 90)}
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-[11px] text-slate-400">
                      {fmtDateTime(item.sent_at ?? item.created_at)}
                    </div>
                    <div className="col-span-1 flex justify-end text-slate-300">
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {open && (
                    <div className="px-5 pb-4 bg-slate-50/50">
                      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{item.message}</pre>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                          <span>Şablon: <b className="text-slate-600">{item.template_key ?? "—"}</b></span>
                          <span>Sağlayıcı: <b className="text-slate-600">{item.provider ?? "—"}</b></span>
                          <span>Deneme: <b className="text-slate-600">{item.attempts}</b></span>
                          <span>Oluşturma: <b className="text-slate-600">{fmtDateTime(item.created_at)}</b></span>
                          {item.error_message && (
                            <span className="text-rose-500 w-full">Hata: {item.error_message}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
