"use client";

/**
 * WhatsApp Operasyon Merkezi — platform geneli mesaj trafiği.
 * 15 saniyede bir otomatik yenilenen canlı kuyruk + son 100 mesaj.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MessageCircle, RefreshCw, Send, CheckCircle2, XCircle, Clock,
  Wallet, Trophy, FlaskConical, Settings,
} from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, LoadingGrid, ErrorBox, fmtNum, fmtMoney, fmtDateTime,
} from "@/components/admin/ui";

type WaData = {
  totals: { total: number; today: number; sent: number; skipped: number; failed: number; pending: number; cost_estimate: number; cost_note: string };
  top_agency: { id: string; name: string; count: number } | null;
  messages: {
    id: string; agency_id: string; agency_name: string; phone: string; status: string;
    template_key: string | null; message: string; created_at: string; sent_at: string | null;
    error_message: string | null; provider: string | null;
  }[];
};

const STATUS_CFG: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700 ring-amber-200",     Icon: Clock },
  sent:    { label: "Gönderildi", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  failed:  { label: "Başarısız",  cls: "bg-rose-100 text-rose-700 ring-rose-200",        Icon: XCircle },
  skipped: { label: "Test",       cls: "bg-violet-100 text-violet-700 ring-violet-200",  Icon: FlaskConical },
};

export default function AdminWhatsAppPage() {
  const [data,    setData]    = useState<WaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [openId,  setOpenId]  = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch("/api/admin/whatsapp");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Veri yüklenemedi.");
      setData(json);
      setError("");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Veri yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Canlı izleme: 15 sn'de bir sessiz yenileme
  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 15000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading && !data) return <LoadingGrid rows={2} cols={4} />;
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Operasyon Merkezi"
        subtitle="Gerçek zamanlı — 15 saniyede bir yenilenir"
        Icon={MessageCircle}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/settings" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-indigo-300 transition-all shadow-sm">
              <Settings className="w-3.5 h-3.5" /> Platform Ayarları
            </Link>
            <button onClick={() => load()} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Toplam Mesaj" value={fmtNum(t.total)} Icon={MessageCircle} tone="slate" index={0} />
        <KpiCard label="Bugünkü"      value={fmtNum(t.today)} Icon={Send} tone="indigo" index={1} />
        <KpiCard label="Başarılı"     value={fmtNum(t.sent)} Icon={CheckCircle2} tone="emerald" index={2} />
        <KpiCard label="Başarısız"    value={fmtNum(t.failed)} Icon={XCircle} tone="rose" index={3} />
        <KpiCard label="Bekleyen"     value={fmtNum(t.pending)} Icon={Clock} tone="amber" index={4} />
        <KpiCard label="Maliyet"      value={fmtMoney(t.cost_estimate)} Icon={Wallet} tone="violet" index={5} sub="Tahmini" />
      </div>

      {data.top_agency && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/70">
          <Trophy className="w-4 h-4 text-amber-500" />
          <p className="text-sm text-slate-700">
            En aktif acente:{" "}
            <Link href={`/admin/agencies/${data.top_agency.id}`} className="font-bold text-amber-700 hover:underline">
              {data.top_agency.name}
            </Link>{" "}
            — {fmtNum(data.top_agency.count)} mesaj
          </p>
        </div>
      )}

      {/* Canlı kuyruk / son 100 mesaj */}
      <SectionCard title="Canlı Kuyruk" subtitle="Son 100 mesaj — en yeni üstte">
        <div className="divide-y divide-slate-50 max-h-[560px] overflow-y-auto">
          {data.messages.map(m => {
            const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.pending;
            const open = openId === m.id;
            return (
              <div key={m.id}>
                <button onClick={() => setOpenId(open ? null : m.id)} className="w-full grid grid-cols-12 gap-2 px-5 py-3 items-center text-left hover:bg-indigo-50/30 transition-colors">
                  <div className="col-span-3 sm:col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ring-1 ${cfg.cls}`}>
                      <cfg.Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </div>
                  <div className="col-span-4 sm:col-span-3 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{m.agency_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{m.phone}</p>
                  </div>
                  <div className="hidden sm:block col-span-4 text-[11px] text-slate-500 truncate">
                    {m.template_key === "daily_summary" ? "📊 Günlük özet" : m.template_key === "test_send" ? "🧪 Test mesajı" : (m.message ?? "").split("\n")[0].slice(0, 60)}
                  </div>
                  <div className="col-span-5 sm:col-span-3 text-right text-[10px] text-slate-400">
                    {fmtDateTime(m.sent_at ?? m.created_at)}
                  </div>
                </button>
                {open && (
                  <div className="px-5 pb-3 bg-slate-50/50">
                    <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans bg-white border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">{m.message}</pre>
                    {m.error_message && <p className="text-[11px] text-rose-600 mt-1.5">⚠️ {m.error_message}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {data.messages.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Henüz mesaj yok</p>}
        </div>
      </SectionCard>

      <p className="text-[11px] text-slate-400">{t.cost_note}</p>
    </div>
  );
}
