"use client";

/**
 * Sistem Merkezi — veritabanı, storage, aktivite, cron/hata logları, deploy.
 */

import { useEffect, useState, useCallback } from "react";
import {
  ServerCog, RefreshCw, Database, HardDrive, Users, Activity,
  ScrollText, AlertTriangle, Rocket,
} from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, StatusDot, LoadingGrid, ErrorBox, fmtNum, fmtDateTime,
} from "@/components/admin/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SystemData = any;

export default function AdminSystemPage() {
  const [data,    setData]    = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/system");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sistem verisi yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sistem verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={3} cols={4} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistem Merkezi"
        subtitle="Altyapı durumu ve operasyon logları"
        Icon={ServerCog}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Veritabanı" value={data.database.status === "ok" ? "Sağlıklı" : "Sorunlu"} sub={`${data.database.latency_ms}ms · ${fmtNum(data.database.total_rows)} satır`} Icon={Database} tone={data.database.status === "ok" ? "emerald" : "rose"} index={0} />
        <KpiCard label="Storage" value={data.storage.used_label} sub={`${data.storage.document_count} dosya · ${data.storage.buckets.length} bucket`} Icon={HardDrive} tone="blue" index={1} />
        <KpiCard label="Toplam Kullanıcı" value={fmtNum(data.activity.total_users)} Icon={Users} tone="violet" index={2} />
        <KpiCard label="Son 24 Saat" value={fmtNum(data.activity.customers_24h + data.activity.quotes_24h + data.activity.whatsapp_24h)} sub={`${data.activity.customers_24h} müşteri · ${data.activity.quotes_24h} teklif · ${data.activity.whatsapp_24h} mesaj`} Icon={Activity} tone="indigo" index={3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Tablo durumları */}
        <SectionCard title="Veritabanı Tabloları" subtitle="Satır sayıları">
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {data.database.tables.map((t: { table: string; count: number | null; error: string | null }) => (
              <div key={t.table} className="flex items-center gap-3 px-5 py-2.5">
                <StatusDot status={t.error ? "down" : "ok"} />
                <p className="text-xs font-mono font-semibold text-slate-700 flex-1">{t.table}</p>
                <p className="text-xs text-slate-500">{t.error ?? `${fmtNum(t.count)} satır`}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Deploy bilgisi */}
        <SectionCard title="Deploy Bilgileri" subtitle="Vercel ortamı">
          <div className="p-5 space-y-2.5">
            {[
              ["Ortam",   data.deploy.env],
              ["Commit",  data.deploy.commit ?? "—"],
              ["Branch",  data.deploy.branch ?? "—"],
              ["Mesaj",   data.deploy.message ?? "—"],
              ["Bölge",   data.deploy.region ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5"><Rocket className="w-3 h-3" /> {k}</span>
                <span className="text-xs font-mono font-semibold text-slate-700 text-right truncate max-w-[60%]">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Cron logları */}
        <SectionCard title="Cron Logları" subtitle="Günlük özet üretimleri" actions={<ScrollText className="w-4 h-4 text-slate-300" />}>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {data.cron_logs.map((c: { created_at: string; status: string; phone: string }, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                <StatusDot status={c.status === "sent" ? "ok" : c.status === "failed" ? "down" : c.status === "skipped" ? "warn" : "off"} />
                <span className="font-mono text-slate-600">{c.phone}</span>
                <span className="flex-1 text-slate-400">{c.status}</span>
                <span className="text-slate-400">{fmtDateTime(c.created_at)}</span>
              </div>
            ))}
            {data.cron_logs.length === 0 && <p className="px-5 py-6 text-xs text-slate-400">Cron henüz çalışmadı</p>}
          </div>
        </SectionCard>

        {/* Hata logları */}
        <SectionCard title="Hata Logları" subtitle="Başarısız gönderimler" actions={<AlertTriangle className="w-4 h-4 text-rose-300" />}>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {data.error_logs.map((e: { created_at: string; phone: string; error_message: string | null }, i: number) => (
              <div key={i} className="px-5 py-2.5">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-mono font-semibold text-slate-700">{e.phone}</span>
                  <span className="text-slate-400">{fmtDateTime(e.created_at)}</span>
                </div>
                <p className="text-[11px] text-rose-600 leading-relaxed">{e.error_message ?? "—"}</p>
              </div>
            ))}
            {data.error_logs.length === 0 && <p className="px-5 py-6 text-xs text-emerald-600">Hata kaydı yok 🎉</p>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
