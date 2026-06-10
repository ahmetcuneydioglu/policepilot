"use client";

/**
 * PolicePilot — WhatsApp Kuyruğu
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/queue?limit=200");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kuyruk yüklenemedi.");
      setItems(json.items ?? []);
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
