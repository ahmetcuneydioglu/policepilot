"use client";

/**
 * Güvenlik Merkezi — Süper Admin (Security Center Faz 3, ilk parça).
 * Kullanıcı doğrulama durumu + OTP istatistikleri + security_logs olay akışı + cihazlar.
 * Veri: /api/admin/security (super_admin).
 */

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, Users, CheckCircle2, Clock, Send, XCircle, ScrollText, Smartphone,
} from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, LoadingGrid, ErrorBox, fmtNum, fmtDateTime,
} from "@/components/admin/ui";

type UserRow = { id: string; name: string; email: string; phone: string; verified: boolean; verifiedAt: string | null; lastLoginAt: string | null; role: string };
type LogRow = { id: string; event: string; channel: string | null; userName: string; ip: string | null; createdAt: string; metadata: Record<string, unknown> };
type DeviceRow = { id: string; userName: string; platform: string; ip: string | null; lastLoginAt: string | null };
type Data = {
  kpis: { totalUsers: number; verifiedUsers: number; unverifiedUsers: number; otpSentTotal: number; otpFailedTotal: number; otpSent24h: number };
  users: UserRow[];
  logs: LogRow[];
  devices: DeviceRow[];
};

const EVENT_STYLE: Record<string, { label: string; cls: string }> = {
  PHONE_VERIFIED: { label: "Telefon Doğrulandı", cls: "bg-emerald-50 text-emerald-700" },
  OTP_SENT:       { label: "OTP Gönderildi",     cls: "bg-blue-50 text-blue-700" },
  OTP_FAILED:     { label: "OTP Başarısız",      cls: "bg-amber-50 text-amber-700" },
  OTP_EXPIRED:    { label: "OTP Süresi Doldu",   cls: "bg-slate-100 text-slate-600" },
  NEW_DEVICE:     { label: "Yeni Cihaz",         cls: "bg-violet-50 text-violet-700" },
  PASSWORD_CHANGED: { label: "Şifre Değişti",    cls: "bg-indigo-50 text-indigo-700" },
  LOGOUT:         { label: "Çıkış",              cls: "bg-slate-100 text-slate-600" },
  SUSPICIOUS_LOGIN: { label: "Şüpheli Giriş",    cls: "bg-rose-50 text-rose-700" },
};

export default function AdminSecurityPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/security");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Güvenlik verisi yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güvenlik verisi yüklenemedi.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={3} cols={4} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Güvenlik Merkezi"
        subtitle="Telefon doğrulama, OTP istatistikleri ve güvenlik olayları"
        Icon={ShieldCheck}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Toplam Kullanıcı" value={fmtNum(data.kpis.totalUsers)} Icon={Users} tone="indigo" index={0} />
        <KpiCard label="Doğrulanmış" value={fmtNum(data.kpis.verifiedUsers)} Icon={CheckCircle2} tone="emerald" index={1} />
        <KpiCard label="Bekleyen" value={fmtNum(data.kpis.unverifiedUsers)} Icon={Clock} tone={data.kpis.unverifiedUsers > 0 ? "amber" : "emerald"} index={2} />
        <KpiCard label="OTP Gönderildi" value={fmtNum(data.kpis.otpSentTotal)} sub={`son 24s: ${fmtNum(data.kpis.otpSent24h)}`} Icon={Send} tone="blue" index={3} />
        <KpiCard label="OTP Başarısız" value={fmtNum(data.kpis.otpFailedTotal)} Icon={XCircle} tone={data.kpis.otpFailedTotal > 0 ? "rose" : "emerald"} index={4} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Kullanıcı doğrulama durumu */}
        <SectionCard title="Kullanıcılar" subtitle="Telefon doğrulama durumu">
          <div className="max-h-[28rem] overflow-y-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-semibold px-2 py-2">Kullanıcı</th>
                  <th className="text-left font-semibold px-2 py-2">Telefon</th>
                  <th className="text-left font-semibold px-2 py-2">Durum</th>
                  <th className="text-right font-semibold px-2 py-2">Son Giriş</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-slate-800 truncate max-w-[160px]">{u.name}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{u.email}</p>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 font-mono text-xs">{u.phone}</td>
                    <td className="px-2 py-2.5">
                      {u.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Doğrulandı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                          <Clock className="w-3 h-3" /> Bekliyor
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11px] text-slate-400">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.users.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Kayıt yok.</p>}
          </div>
        </SectionCard>

        {/* Güvenlik olay akışı */}
        <SectionCard title="Güvenlik Olayları" subtitle="Son 120 kayıt (security_logs)">
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
            {data.logs.map((l) => {
              const s = EVENT_STYLE[l.event] ?? { label: l.event, cls: "bg-slate-100 text-slate-600" };
              return (
                <div key={l.id} className="flex items-center gap-3 px-1 py-2.5">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${s.cls}`}>{s.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-700 truncate">{l.userName}</p>
                    <p className="text-[10px] text-slate-400">{l.ip ?? "—"}{l.channel ? ` · ${l.channel}` : ""}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtDateTime(l.createdAt)}</span>
                </div>
              );
            })}
            {data.logs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                <ScrollText className="w-6 h-6" />
                <p className="text-sm">Henüz güvenlik olayı yok.</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Cihazlar */}
      <SectionCard title="Cihazlar" subtitle="trusted_devices — altyapı hazır, doğrulama ileride">
        {data.devices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Smartphone className="w-6 h-6" />
            <p className="text-sm">Henüz cihaz kaydı yok.</p>
            <p className="text-[11px] text-slate-300">Yeni-cihaz doğrulama / şüpheli giriş özellikleri sonraki fazda aktifleşecek.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.devices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-1 py-2.5 text-sm">
                <Smartphone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="font-semibold text-slate-700 flex-1 truncate">{d.userName}</p>
                <span className="text-[11px] text-slate-400">{d.platform}</span>
                <span className="text-[11px] text-slate-400 font-mono">{d.ip ?? "—"}</span>
                <span className="text-[11px] text-slate-400">{d.lastLoginAt ? fmtDateTime(d.lastLoginAt) : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
