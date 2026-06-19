"use client";

/**
 * Personel Performans Merkezi (acente owner/manager) — satış performans yönetimi.
 * Üç bölüm:
 *   1) Ekip Özeti      — acente geneli toplam (müşteri/teklif/poliçe/prim/dönüşüm) + 7-gün
 *   2) Personel Sıralaması — YALNIZ çalışanlar (acente sahibi hariç), performans skoruyla sıralı
 *   3) Personel Detayı  — karta tıklanınca açılan tam kırılım (modal)
 * Acente sahibi (owner) ekip yöneticisidir → sıralama kartlarında listelenmez.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Users, FileText, ShieldCheck, Wallet, TrendingUp, Activity,
  AlertTriangle, Crown, X, LogIn, Award,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { AgencyPerformance, UserPerf } from "@/lib/performance";
import CoachingCard from "./CoachingCard";

const IDLE_DAYS = 7;

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
function scoreTone(s: number) {
  if (s >= 75) return { text: "text-emerald-700", bg: "bg-emerald-50", ring: "#10b981", label: "Yüksek" };
  if (s >= 50) return { text: "text-indigo-700", bg: "bg-indigo-50", ring: "#6366f1", label: "İyi" };
  if (s >= 25) return { text: "text-amber-700", bg: "bg-amber-50", ring: "#f59e0b", label: "Orta" };
  return { text: "text-rose-700", bg: "bg-rose-50", ring: "#f43f5e", label: "Düşük" };
}

/** Dairesel skor göstergesi (SVG) */
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone.ring} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-extrabold leading-none ${tone.text}`} style={{ fontSize: size * 0.32 }}>{score}</span>
      </div>
    </div>
  );
}

function StatCard({ Icon, label, value, tint }: { Icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tint}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

/* ── Detay modalı ───────────────────────────────────────────────────────── */
function DetailModal({ user, avgConversion, rank, onClose }: { user: UserPerf; avgConversion: number; rank: number; onClose: () => void }) {
  const convDelta = user.quotes_total >= 2 ? user.conversion - avgConversion : null;
  const metrics: { k: string; v: string; sub?: string }[] = [
    { k: "Müşteri", v: String(user.customers) },
    { k: "Teklif", v: String(user.quotes_total), sub: `bu ay ${user.quotes_month}` },
    { k: "Poliçe", v: String(user.policies_total), sub: `bu ay ${user.policies_month}` },
    { k: "Kazanılan Teklif", v: String(user.quotes_won) },
    { k: "Toplam Prim", v: fmtMoney(user.total_premium) },
    { k: "Komisyon", v: fmtMoney(user.total_commission) },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* başlık */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold">
              {initials(user.name)}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-400">{user.role_label} · Sıralama #{rank}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {/* skor + dönüşüm */}
        <div className="flex items-center gap-5 p-5 bg-slate-50/60">
          <ScoreRing score={user.score} size={88} />
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performans Skoru</p>
            <p className={`text-sm font-bold ${scoreTone(user.score).text}`}>{scoreTone(user.score).label}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-slate-500">Dönüşüm <span className="font-bold text-slate-800">%{user.conversion}</span></span>
              {convDelta != null && convDelta !== 0 && (
                <span className={`text-xs font-bold ${convDelta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  ekip ort. {convDelta > 0 ? "+" : ""}{convDelta}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* metrik kırılımı */}
        <div className="grid grid-cols-3 gap-px bg-slate-100 p-px">
          {metrics.map((m) => (
            <div key={m.k} className="bg-white p-4 text-center">
              <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{m.v}</p>
              <p className="text-[10px] text-slate-400 mt-1">{m.k}</p>
              {m.sub && <p className="text-[9px] text-slate-300 mt-0.5">{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* zaman bilgileri */}
        <div className="p-5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-500"><Activity className="w-4 h-4 text-slate-400" /> Son işlem</span>
            <span className={`font-semibold ${daysSince(user.last_activity) >= IDLE_DAYS ? "text-amber-600" : "text-slate-700"}`}>{relTime(user.last_activity)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-500"><LogIn className="w-4 h-4 text-slate-400" /> Son giriş</span>
            <span className="font-semibold text-slate-700">{relTime(user.last_login)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sıralama kartı ─────────────────────────────────────────────────────── */
function RankCard({ user, rank, onClick }: { user: UserPerf; rank: number; onClick: () => void }) {
  const tone = scoreTone(user.score);
  const isIdle = daysSince(user.last_activity) >= IDLE_DAYS;
  const rankTint = rank === 1 ? "bg-amber-100 text-amber-700" : rank === 2 ? "bg-slate-200 text-slate-600" : rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400";
  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all p-4 flex items-center gap-4">
      {/* sıra */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${rankTint}`}>
        {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
      </div>
      {/* kimlik */}
      <div className="flex items-center gap-3 min-w-0 w-44 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
          <p className={`text-[11px] ${isIdle ? "text-amber-600" : "text-slate-400"}`}>
            {isIdle ? `${daysSince(user.last_activity)} gün önce` : relTime(user.last_activity)}
          </p>
        </div>
      </div>
      {/* metrikler */}
      <div className="hidden md:flex items-center gap-4 flex-1 text-xs text-slate-500">
        <span>Müşteri <b className="text-slate-800">{user.customers}</b></span>
        <span>Teklif <b className="text-slate-800">{user.quotes_total}</b></span>
        <span>Poliçe <b className="text-slate-800">{user.policies_total}</b></span>
        <span className="ml-auto">Prim <b className="text-slate-800">{fmtMoney(user.total_premium)}</b></span>
        <span>Dönüşüm <b className="text-slate-800">%{user.conversion}</b></span>
      </div>
      {/* skor */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0 ${tone.bg}`}>
        <Award className={`w-3.5 h-3.5 ${tone.text}`} />
        <span className={`text-sm font-extrabold tabular-nums ${tone.text}`}>{user.score}</span>
      </div>
    </button>
  );
}

/* ── Ana panel ──────────────────────────────────────────────────────────── */
export default function PerformancePanel() {
  const [data, setData] = useState<AgencyPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<UserPerf | null>(null);

  useEffect(() => {
    fetch("/api/team/performance")
      .then((r) => r.json())
      .then((j) => { if (j?.error) setErr(j.error); else setData(j as AgencyPerformance); })
      .catch(() => setErr("Performans verisi alınamadı."))
      .finally(() => setLoading(false));
  }, []);

  // Yalnız çalışanlar (acente sahibi hariç), skora göre sıralı
  const staff = useMemo(
    () => (data ? data.users.filter((u) => u.agency_role !== "owner").sort((a, b) => b.score - a.score) : []),
    [data]
  );
  const idle = useMemo(() => staff.filter((u) => daysSince(u.last_activity) >= IDLE_DAYS), [staff]);
  const maxDay = useMemo(() => Math.max(1, ...(data?.last7.map((d) => d.count) ?? [1])), [data]);
  const selectedRank = selected ? staff.findIndex((u) => u.id === selected.id) + 1 : 0;

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;
  if (err) return <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>;
  if (!data) return null;

  const { team, last7 } = data;

  return (
    <div className="space-y-7">
      {/* ══ 1) EKİP ÖZETİ ══════════════════════════════════════════════════ */}
      <section>
        <SectionHead title="Ekip Özeti" sub="Acentenizin toplam üretimi (tüm ekip)" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard Icon={Users}       label="Müşteri"  value={String(team.total_customers)} tint="bg-blue-50 text-blue-600" />
          <StatCard Icon={FileText}    label="Teklif"   value={String(team.total_quotes)}    tint="bg-violet-50 text-violet-600" />
          <StatCard Icon={ShieldCheck} label="Poliçe"   value={String(team.total_policies)}  tint="bg-emerald-50 text-emerald-600" />
          <StatCard Icon={Wallet}      label="Prim"     value={fmtMoney(team.total_premium)} tint="bg-amber-50 text-amber-600" />
          <StatCard Icon={TrendingUp}  label="Dönüşüm"  value={`%${team.conversion}`}        tint="bg-indigo-50 text-indigo-600" />
        </div>
        {/* 7 gün aktivite */}
        <div className="mt-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Son 7 Gün Aktivite</p>
          <div className="flex items-end gap-2 h-14">
            {last7.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count}`}>
                <div className="w-full rounded-t bg-indigo-400" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} />
                <span className="text-[9px] text-slate-400">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 2) PERSONEL SIRALAMASI ════════════════════════════════════════ */}
      <section>
        <SectionHead title="Personel Sıralaması" sub="Çalışan performansı — performans skoruna göre (acente sahibi hariç)" />

        {staff.length > 0 && (
          <CoachingCard onPickUser={(id) => { const u = staff.find((x) => x.id === id); if (u) setSelected(u); }} />
        )}

        {idle.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 mb-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <span className="font-bold">{idle.length} çalışan</span> {IDLE_DAYS}+ gündür işlem yapmadı:{" "}
              <span className="font-medium">{idle.map((u) => u.name).join(", ")}</span>
            </p>
          </div>
        )}

        {staff.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-14 text-center">
            <Users className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Henüz çalışan yok</p>
            <p className="text-xs text-slate-400 mt-1">Satış personeli ekledikçe performans sıralaması burada oluşur.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {staff.map((u, i) => (
              <RankCard key={u.id} user={u} rank={i + 1} onClick={() => setSelected(u)} />
            ))}
          </div>
        )}

        {data.unattributed > 0 && (
          <p className="text-[11px] text-slate-400 px-1 mt-3">
            {data.unattributed} eski müşteri kaydı bir personele atfedilemiyor (sistem öncesi). Yeni kayıtlar otomatik atanır.
          </p>
        )}
      </section>

      {/* ══ 3) PERSONEL DETAYI (modal) ════════════════════════════════════ */}
      {selected && (
        <DetailModal user={selected} avgConversion={team.avg_conversion} rank={selectedRank} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
