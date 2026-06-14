"use client";

/**
 * Acente kullanım/limit göstergesi — kendi panelinde ilerleme barları + uyarı.
 * /api/usage'dan veri çeker. Limite yaklaşınca (≥%80) sarı, dolunca (≥%100) kırmızı.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge } from "lucide-react";

type Limit = { used: number; max: number };
type Usage = {
  plan: string;
  is_active: boolean;
  limits: { users: Limit; customers: Limit; requests: Limit; policies: Limit };
};

const LABELS: Record<string, string> = {
  users: "Kullanıcı", customers: "Müşteri", requests: "Teklif", policies: "Poliçe",
};

export default function UsageLimits() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/usage");
        const json = await res.json();
        if (res.ok && json.agency) setUsage(json.agency);
      } catch {
        // sessiz — dashboard'u bozmaz
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded || !usage) return null;

  const entries = Object.entries(usage.limits) as [string, Limit][];
  const nearLimit = entries.filter(([, v]) => v.max > 0 && v.used / v.max >= 0.8);
  const full = entries.filter(([, v]) => v.max > 0 && v.used >= v.max);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Gauge className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Paket Kullanımı</p>
            <p className="text-[11px] text-slate-400 capitalize">{usage.plan} paketi</p>
          </div>
        </div>
        {(full.length > 0 || nearLimit.length > 0) && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            full.length > 0 ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <AlertTriangle className="w-3 h-3" />
            {full.length > 0 ? "Limit doldu" : "Limite yaklaşılıyor"}
          </span>
        )}
      </div>

      {(full.length > 0 || nearLimit.length > 0) && (
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          {full.length > 0
            ? `${full.map(([k]) => LABELS[k]).join(", ")} limitiniz doldu. Yeni kayıt için paketinizi yükseltin (yöneticinizle iletişime geçin).`
            : `${nearLimit.map(([k]) => LABELS[k]).join(", ")} limitinize yaklaşıyorsunuz.`}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
        {entries.map(([key, v]) => {
          const pct = v.max > 0 ? Math.min(100, Math.round((v.used / v.max) * 100)) : 0;
          const tone = pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500";
          const txt  = pct >= 100 ? "text-rose-600" : pct >= 80 ? "text-amber-600" : "text-slate-400";
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">{LABELS[key] ?? key}</span>
                <span className={`text-xs font-semibold ${txt}`}>{v.used} / {v.max} (%{pct})</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
