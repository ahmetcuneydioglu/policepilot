"use client";

/**
 * Personel Performans Merkezi (acente owner/manager) — /api/team/performance.
 * Kişi-bazlı: müşteri/teklif/poliçe/prim/komisyon/dönüşüm/son-aktivite/son-giriş
 * + liderlik şeridi + atıl uyarısı + ekip ort. kıyas + 7-gün aktivite.
 */

import { useEffect, useMemo, useState } from "react";
import { Trophy, TrendingUp, Wallet, Activity, AlertTriangle, Users } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { AgencyPerformance, UserPerf } from "@/lib/performance";

const IDLE_DAYS = 7; // bu kadar gün işlemsiz → atıl uyarısı

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}
function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function LeaderChip({ Icon, label, user, value, tone }: { Icon: typeof Trophy; label: string; user: UserPerf | null; value: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{user?.name ?? "—"}</p>
        <p className="text-xs text-slate-500">{user ? value : "veri yok"}</p>
      </div>
    </div>
  );
}

export default function PerformancePanel() {
  const [data, setData] = useState<AgencyPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/team/performance")
      .then((r) => r.json())
      .then((j) => { if (j?.error) setErr(j.error); else setData(j as AgencyPerformance); })
      .catch(() => setErr("Performans verisi alınamadı."))
      .finally(() => setLoading(false));
  }, []);

  // Üreticileri prime göre sırala (en çok üreten üstte)
  const ranked = useMemo(
    () => (data ? [...data.users].sort((a, b) => b.total_premium - a.total_premium) : []),
    [data]
  );
  const idle = useMemo(
    () => ranked.filter((u) => daysSince(u.last_activity) >= IDLE_DAYS),
    [ranked]
  );
  const maxDay = useMemo(() => Math.max(1, ...(data?.last7.map((d) => d.count) ?? [1])), [data]);

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;
  if (err) return <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>;
  if (!data || data.users.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">Henüz personel verisi yok</p>
        <p className="text-xs text-slate-400 mt-1">Ekibe kullanıcı ekledikçe performans burada görünür.</p>
      </div>
    );
  }

  const { leaders, team, last7 } = data;

  return (
    <div className="space-y-5">
      {/* Liderlik şeridi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <LeaderChip Icon={Trophy} label="En Çok Poliçe" user={leaders.top_policies} value={`${leaders.top_policies?.policies_total ?? 0} poliçe`} tone="bg-amber-50 text-amber-600" />
        <LeaderChip Icon={Wallet} label="En Yüksek Prim" user={leaders.top_premium} value={fmtMoney(leaders.top_premium?.total_premium ?? 0)} tone="bg-emerald-50 text-emerald-600" />
        <LeaderChip Icon={TrendingUp} label="En İyi Dönüşüm" user={leaders.top_conversion} value={`%${leaders.top_conversion?.conversion ?? 0}`} tone="bg-indigo-50 text-indigo-600" />
        <LeaderChip Icon={Activity} label="En Aktif" user={leaders.most_active} value={relTime(leaders.most_active?.last_activity ?? null)} tone="bg-blue-50 text-blue-600" />
      </div>

      {/* Atıl uyarısı */}
      {idle.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">{idle.length} personel</span> {IDLE_DAYS}+ gündür işlem yapmadı:{" "}
            <span className="font-medium">{idle.map((u) => u.name).join(", ")}</span>
          </p>
        </div>
      )}

      {/* Ekip özet şeridi + 7 gün */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Toplam Prim", value: fmtMoney(team.total_premium) },
            { label: "Toplam Poliçe", value: String(team.total_policies) },
            { label: "Ekip Ort. Dönüşüm", value: `%${team.avg_conversion}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Son 7 Gün Aktivite</p>
          <div className="flex items-end gap-1.5 h-16">
            {last7.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count}`}>
                <div className="w-full rounded-t bg-indigo-400" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} />
                <span className="text-[9px] text-slate-400">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Personel kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ranked.map((u) => {
          const convDelta = u.quotes_total >= 2 ? u.conversion - team.avg_conversion : null;
          return (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-400">{u.role_label}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">son işlem</p>
                  <p className={`text-xs font-semibold ${daysSince(u.last_activity) >= IDLE_DAYS ? "text-amber-600" : "text-slate-600"}`}>{relTime(u.last_activity)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { k: "Müşteri", v: u.customers },
                  { k: "Teklif", v: u.quotes_total },
                  { k: "Poliçe", v: u.policies_total },
                ].map((m) => (
                  <div key={m.k} className="bg-slate-50 rounded-xl px-2.5 py-2 text-center">
                    <p className="text-base font-extrabold text-slate-900 tabular-nums leading-none">{m.v}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{m.k}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Prim <span className="font-bold text-slate-800">{fmtMoney(u.total_premium)}</span></span>
                  <span className="text-slate-500">Kom. <span className="font-bold text-slate-800">{fmtMoney(u.total_commission)}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800">%{u.conversion}</span>
                  {convDelta != null && convDelta !== 0 && (
                    <span className={`text-[10px] font-bold ${convDelta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {convDelta > 0 ? "↑" : "↓"}{Math.abs(convDelta)}
                    </span>
                  )}
                </div>
              </div>
              {u.last_login && (
                <p className="text-[10px] text-slate-300 mt-2">Son giriş: {relTime(u.last_login)}</p>
              )}
            </div>
          );
        })}
      </div>

      {data.unattributed > 0 && (
        <p className="text-[11px] text-slate-400 px-1">
          {data.unattributed} eski müşteri kaydı bir personele atfedilemiyor (sistem öncesi). Yeni kayıtlar otomatik atanır.
        </p>
      )}
    </div>
  );
}
