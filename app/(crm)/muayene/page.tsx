"use client";

/**
 * SigortaOS — Araç Muayene Takibi (Faz 1)
 *
 * customers.muayene_bitis tarihlerini takip eder; yaklaşan muayeneler için
 * WhatsApp hatırlatması. Yenileme motorunun (renewals) yalın ikizi.
 * Multi-tenant: agency_user yalnız kendi kayıtlarını görür.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withScopeFilter, isManagerial } from "@/lib/tenant";
import {
  Car, Search, CalendarClock, CalendarDays, CalendarRange,
  AlertTriangle, RefreshCw, ChevronRight, Phone, Wand2, Info,
} from "lucide-react";

type InspCustomer = {
  id: string;
  name: string;
  phone: string | null;
  vehicle_plate: string | null;
  muayene_bitis: string;
  muayene_tahmini: boolean;
};

type FilterKey = "Tümü" | "Bugün" | "Bu Hafta" | "30 Gün" | "Geciken";

function daysLeft(d: string): number {
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}
function dayBadge(days: number): { label: string; cls: string; bar: string } {
  if (days < 0)   return { label: `${Math.abs(days)} gün gecikti`, cls: "bg-red-100 text-red-700 ring-1 ring-red-200",          bar: "bg-red-500" };
  if (days === 0) return { label: "Bugün",                          cls: "bg-red-100 text-red-700 ring-1 ring-red-200",          bar: "bg-red-500" };
  if (days <= 7)  return { label: `${days} gün`,                    cls: "bg-orange-100 text-orange-700 ring-1 ring-orange-200", bar: "bg-orange-500" };
  if (days <= 30) return { label: `${days} gün`,                    cls: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",    bar: "bg-amber-500" };
  return            { label: `${days} gün`,                          cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", bar: "bg-emerald-500" };
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function waPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "90");
}
function buildMessage(c: InspCustomer): string {
  const d = daysLeft(c.muayene_bitis);
  const when = d < 0 ? "süresi dolmuştur" : d === 0 ? "bugün doluyor" : `${d} gün içinde (${fmtDate(c.muayene_bitis)}) doluyor`;
  const plate = c.vehicle_plate ? `${c.vehicle_plate} plakalı ` : "";
  return (
    `Merhaba ${c.name},\n\n` +
    `${plate}aracınızın muayene ${when}.\n\n` +
    `Muayene öncesi sigorta ve işlemleriniz için size yardımcı olmaktan memnuniyet duyarız. 🚗`
  );
}

const WA_SVG = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function MuayenePage() {
  const { role, agencyId, profile } = useAuth();

  const [rows, setRows]       = useState<InspCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterKey>("Tümü");
  const [search, setSearch]   = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const canBackfill = role !== "super_admin" && isManagerial(profile?.agency_role);

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const to   = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("customers") as any)
      .select("id, name, phone, vehicle_plate, muayene_bitis, muayene_tahmini, agency_id, created_by")
      .not("muayene_bitis", "is", null)
      .gte("muayene_bitis", from)
      .lte("muayene_bitis", to)
      .order("muayene_bitis", { ascending: true });
    q = withScopeFilter(q, role, agencyId, profile?.id, profile?.agency_role);

    const { data, error } = await q;
    if (error) console.error("[muayene] fetch error:", error.message);
    setRows((data ?? []) as InspCustomer[]);
    setLoading(false);
  }, [role, agencyId, profile?.id, profile?.agency_role]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function runBackfill() {
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await fetch("/api/muayene/backfill", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const json = await res.json();
      if (!res.ok) { setBackfillMsg(json.error ?? "İşlem başarısız."); return; }
      setBackfillMsg(`${json.updated} aracın muayenesi tahmini olarak dolduruldu (model yılından). Kesin tarihler için müşterilerle teyitleşin.`);
      await load();
    } catch {
      setBackfillMsg("Sunucuya ulaşılamadı. Tekrar deneyin.");
    } finally {
      setBackfilling(false);
    }
  }

  const overdue  = rows.filter(c => daysLeft(c.muayene_bitis) < 0);
  const today    = rows.filter(c => daysLeft(c.muayene_bitis) === 0);
  const thisWeek = rows.filter(c => { const d = daysLeft(c.muayene_bitis); return d >= 0 && d <= 7; });
  const in30     = rows.filter(c => { const d = daysLeft(c.muayene_bitis); return d >= 0 && d <= 30; });

  const filtered = rows
    .filter(c => {
      const d = daysLeft(c.muayene_bitis);
      if (filter === "Bugün")    return d === 0;
      if (filter === "Bu Hafta") return d >= 0 && d <= 7;
      if (filter === "30 Gün")   return d >= 0 && d <= 30;
      if (filter === "Geciken")  return d < 0;
      return true;
    })
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.name ?? "").toLowerCase().includes(q) || (c.vehicle_plate ?? "").toLowerCase().includes(q);
    });

  const KPI: { key: FilterKey; label: string; value: number; Icon: typeof CalendarClock; grad: string; ring: string; iconBg: string; val: string }[] = [
    { key: "Bugün",    label: "Bugün Doluyor", value: today.length,    Icon: CalendarClock, grad: "from-red-50 to-red-100/60",       ring: "ring-red-200/60",    iconBg: "bg-red-500",    val: "text-red-700" },
    { key: "Bu Hafta", label: "Bu Hafta",      value: thisWeek.length, Icon: CalendarDays,  grad: "from-orange-50 to-orange-100/60", ring: "ring-orange-200/60", iconBg: "bg-orange-500", val: "text-orange-700" },
    { key: "30 Gün",   label: "30 Gün İçinde", value: in30.length,     Icon: CalendarRange, grad: "from-amber-50 to-amber-100/60",   ring: "ring-amber-200/60",  iconBg: "bg-amber-500",  val: "text-amber-700" },
    { key: "Geciken",  label: "Gecikenler",    value: overdue.length,  Icon: AlertTriangle, grad: "from-rose-50 to-rose-100/60",     ring: "ring-rose-200/60",   iconBg: "bg-rose-600",   val: "text-rose-700" },
  ];
  const FILTERS: FilterKey[] = ["Tümü", "Bugün", "Bu Hafta", "30 Gün", "Geciken"];

  return (
    <div className="relative space-y-6">
      <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/30">
              <Car className="w-[18px] h-[18px] text-white" />
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Araç Muayeneleri</h1>
          </div>
          <p className="text-sm text-slate-400 pl-[46px]">
            Muayene bitiş tarihlerini takip edin, müşterilerinize zamanında hatırlatın.
          </p>
        </div>

        {canBackfill && (
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-teal-200 text-teal-700 text-sm font-semibold hover:bg-teal-50 transition-all shadow-sm disabled:opacity-50"
            title="Eski araç müşterilerinde model yılından muayeneyi tahmini doldurur (mevcut/teyitli tarihleri ezmez)"
          >
            <Wand2 className="w-4 h-4" />
            {backfilling ? "Dolduruluyor…" : "Eski araçlardan tahmini doldur"}
          </button>
        )}
      </div>

      {backfillMsg && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" /> {backfillMsg}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(filter === c.key ? "Tümü" : c.key)}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} ring-1 ${c.ring} p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ${filter === c.key ? "ring-2 shadow-md" : ""}`}
          >
            <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center mb-3 shadow-sm`}>
              <c.Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{c.label}</p>
            <p className={`text-[26px] font-bold mt-1 leading-none ${c.val}`}>
              {loading ? <span className="inline-block w-10 h-6 rounded bg-current opacity-20 animate-pulse" /> : c.value}
            </p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri veya plaka ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>
        <div className="flex items-center bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm gap-0.5 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${filter === f ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-2xl flex items-center justify-center shadow-inner">
              <Car className="w-7 h-7 text-teal-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">
              {search || filter !== "Tümü" ? "Sonuç bulunamadı" : "Yaklaşan muayene yok"}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              {search || filter !== "Tümü"
                ? "Arama kriterlerinizi veya filtreyi değiştirin"
                : "Müşteri detayından muayene tarihi ekledikçe burada listelenir"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Müşteri</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Araç</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kalan</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Muayene Tarihi</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Aksiyonlar</div>
            </div>
            <div className="divide-y divide-slate-50/80">
              {filtered.map(c => {
                const d = daysLeft(c.muayene_bitis);
                const badge = dayBadge(d);
                const phone = c.phone ?? "";
                return (
                  <div key={c.id} className="grid grid-cols-12 gap-2 px-5 py-4 hover:bg-teal-50/30 transition-all duration-150 items-center">
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                          {initials(c.name)}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${badge.bar}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                        {phone && <p className="text-[11px] text-slate-400 truncate">{phone}</p>}
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{c.vehicle_plate ?? "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.bar}`} />
                        {badge.label}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-600">{fmtDate(c.muayene_bitis)}</p>
                      {c.muayene_tahmini && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold ring-1 ring-amber-200" title="Model yılından tahmin — kesin tarih için müşteriyle teyitleşin">
                          ~ tahmini
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                      {phone ? (
                        <a
                          href={`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(buildMessage(c))}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200"
                          title="WhatsApp muayene hatırlatması"
                        >
                          {WA_SVG} WA
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-300 text-[11px] font-bold ring-1 ring-slate-100" title="Telefon bilgisi yok">
                          {WA_SVG} WA
                        </span>
                      )}
                      {phone && (
                        <a href={`tel:${phone}`} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors" title="Ara">
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-700 transition-colors"
                        title="Müşteri detayı"
                      >
                        Detay <ChevronRight className="w-3 h-3 -mr-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-600">{filtered.length}</span> araç muayenesi
                {filter !== "Tümü" && <span> · <span className="text-teal-600">&ldquo;{filter}&rdquo;</span> filtresi</span>}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
