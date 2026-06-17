"use client";

/**
 * SigortaOS — Tek Tıkla Yenileme Teklifi
 *
 * Akış: Yenilemeler → Teklif Çalış → (bu sayfa) → Teklif Sonuçları
 *
 * 1. Poliçe + müşteri + araç bilgileri otomatik yüklenir
 * 2. createQuoteRun otomatik tetiklenir (kullanıcı butona basmaz)
 * 3. Canlı şirket ilerleme ekranı gösterilir
 * 4. Sonuçlar kaydedilir → /quote-center/[runId] sonuç ekranına yönlendirilir
 *
 * Hedef: Teklif Çalış → sonuç ekranı ≤ 3 saniye.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { activeProvider, STATUS_UI, type ResultStatus } from "@/lib/quote-providers";
import { DEMO_COMPANIES } from "@/lib/demo-mode";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Zap,
  ShieldCheck, AlertTriangle, ChevronLeft,
} from "lucide-react";
import Link from "next/link";

// ─── Ürün grubu eşlemesi ──────────────────────────────────────────────────────
type ProductGroup = "vehicle" | "property" | "health" | "travel";

const PRODUCT_GROUP: Record<string, ProductGroup> = {
  Trafik: "vehicle", Kasko: "vehicle", "İMM": "vehicle", "Yeşil Kart": "vehicle",
  DASK: "property", Konut: "property",
  TSS: "health", "Ferdi Kaza": "health", "Özel Sağlık": "health", "Sağlık": "health", Hayat: "health",
  Seyahat: "travel",
};

const COMPANIES: Record<ProductGroup, string[]> = {
  vehicle:  DEMO_COMPANIES,
  property: ["Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Ergo Sigorta","Groupama Sigorta","Güneş Sigorta","HDI Sigorta","Mapfre Sigorta","Türkiye Sigorta","Unico Sigorta"],
  health:   ["Acıbadem Sigorta","Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Cigna Sigorta","Groupama Sigorta","Güneş Sigorta","Türkiye Sigorta"],
  travel:   ["Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Ergo Sigorta","Groupama Sigorta","Neova Sigorta","Türkiye Sigorta"],
};

// ─── Types ────────────────────────────────────────────────────────────────────
type PolicyDetail = {
  id: string;
  customer_id: string | null;
  agency_id: string | null;
  policy_type: string;
  policy_no: string | null;
  premium: number | null;
  end_date: string;
  quote_run_id: string | null;
  customers: { id: string; name: string; phone: string } | null;
};

type CompanyProgress = {
  name: string;
  state: "waiting" | "running" | "done";
  status?: ResultStatus;
  price?: number | null;
};

type Phase = "loading" | "quoting" | "saving" | "error";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RenewalAutoQuotePage() {
  const { policyId } = useParams<{ policyId: string }>();
  const router = useRouter();
  const { role, agencyId } = useAuth();

  const [phase,     setPhase]     = useState<Phase>("loading");
  const [policy,    setPolicy]    = useState<PolicyDetail | null>(null);
  const [vehicle,   setVehicle]   = useState<Record<string, string>>({});
  const [progress,  setProgress]  = useState<CompanyProgress[]>([]);
  const [errorMsg,  setErrorMsg]  = useState("");
  const startedRef = useRef(false);

  // ── Tüm otomatik akış tek effect içinde ────────────────────────────────────
  useEffect(() => {
    if (!policyId || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function run() {
      try {
        // ── 1. Poliçe + müşteri bilgilerini çek ─────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pq = (supabase.from("policies") as any)
          .select("id, customer_id, agency_id, policy_type, policy_no, premium, end_date, quote_run_id, customers(id, name, phone)")
          .eq("id", policyId);
        if (role === "agency_user" && agencyId) pq = pq.eq("agency_id", agencyId);
        const { data: pol, error: polErr } = await pq.single();

        if (cancelled) return;
        if (polErr || !pol) {
          setErrorMsg("Poliçe bulunamadı veya erişim yetkiniz yok.");
          setPhase("error");
          return;
        }
        setPolicy(pol as PolicyDetail);

        // ── 1b. Çift quote koruması ─────────────────────────────────────────
        // Bu poliçe için iptal edilmemiş bir teklif çalışması zaten varsa
        // yenisini oluşturma; mevcut çalışmanın detayına yönlendir.
        // (Teklif Merkezi ile aynı API — service role, RLS'e takılmaz)
        try {
          const runRes  = await fetch(`/api/quote-runs?renewal_of_policy_id=${policyId}`);
          const runJson = await runRes.json();
          if (cancelled) return;
          if (runRes.ok) {
            const existingRun = (runJson.runs ?? []).find(
              (r: { id: string; status: string }) => r.status !== "İptal"
            );
            if (existingRun) {
              router.replace(`/quote-center/${existingRun.id}`);
              return;
            }
          }
        } catch {
          // Kontrol başarısız olursa akışı engelleme; teklif normal devam eder
        }

        // ── 2. Araç/ürün bilgileri: bağlı quote_run'dan çek ─────────────────
        let productData: Record<string, string> = {};
        if (pol.quote_run_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: prevRun } = await (supabase.from("quote_runs") as any)
            .select("product_data")
            .eq("id", pol.quote_run_id)
            .single();
          if (prevRun?.product_data) productData = prevRun.product_data;
        }
        if (cancelled) return;
        setVehicle(productData);

        // ── 3. Teklif motoru — otomatik başlat ──────────────────────────────
        const group     = PRODUCT_GROUP[pol.policy_type] ?? "vehicle";
        const companies = COMPANIES[group];
        const seed      = productData.plaka || pol.customers?.name || pol.id;

        setProgress(companies.map(name => ({ name, state: "waiting" })));
        setPhase("quoting");

        const providerResults = await activeProvider.runQuote({
          productType:  pol.policy_type,
          companyNames: companies,
          seed,
          customerTc:   "",
          plaka:        productData.plaka ?? "",
          customerName: pol.customers?.name ?? "",
        });
        if (cancelled) return;

        // ── 4. Hızlı canlı ilerleme: şirket başına ~150ms ───────────────────
        // (3 saniye hedefi: 12 şirket × 150ms ≈ 1.8s + kayıt ≈ 2.5s)
        const STEP = 150;
        providerResults.forEach((r, i) => {
          timers.push(setTimeout(() => {
            if (cancelled) return;
            setProgress(prev => prev.map((c, ci) =>
              c.name === r.companyName
                ? { ...c, state: "done", status: r.status, price: r.price ?? null }
                : ci === i + 1 ? { ...c, state: "running" } : c
            ));
          }, i * STEP));
        });
        // İlk şirketi hemen "running" yap
        setProgress(prev => prev.map((c, i) => i === 0 ? { ...c, state: "running" } : c));

        // ── 5. Tüm animasyon bitince kaydet + yönlendir ─────────────────────
        timers.push(setTimeout(async () => {
          if (cancelled) return;
          setPhase("saving");

          const results = providerResults.map(r => ({
            company_name:  r.companyName,
            price:         r.price ?? null,
            installment:   r.installment ?? "Peşin",
            note:          r.note ?? null,
            status:        r.status === "success" ? "Aktif"
                         : r.status === "no_offer" ? "Teklif Yok"
                         : r.status,
            source_type:   r.sourceType,
            provider_name: r.providerName,
            error_source:  r.errorSource ?? null,
            error_code:    r.errorCode   ?? null,
            error_message: r.errorMessage ?? null,
            action_hint:   r.actionHint  ?? null,
            raw_response:  {},
          }));

          const successN = providerResults.filter(r => r.status === "success").length;
          const errorN   = providerResults.filter(r => STATUS_UI[r.status]?.isError).length;

          const res = await fetch("/api/quote-runs", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agency_id:       pol.agency_id ?? agencyId ?? null,
              customer_id:     pol.customer_id ?? null,
              create_customer: false,
              customer_name:   pol.customers?.name  ?? "",
              customer_phone:  pol.customers?.phone ?? "",
              customer_email:  "",
              customer_tc:     "",
              product_type:    pol.policy_type,
              product_data:    { ...productData, group },
              notes:           `Yenileme teklifi — eski poliçe: ${pol.policy_no ?? pol.id} (bitiş: ${pol.end_date})`,
              provider_type:   activeProvider.sourceType,
              success_count:   successN,
              error_count:     errorN,
              results,
              renewal_of_policy_id: pol.id, // eski poliçe → quoted, poliçeleşince → completed
            }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setErrorMsg(data.error ?? "Teklif çalışması kaydedilemedi.");
            setPhase("error");
            return;
          }
          router.replace(`/quote-center/${data.runId}`);
        }, providerResults.length * STEP + 300));

      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu.");
          setPhase("error");
        }
      }
    }

    run();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId, role, agencyId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const doneN  = progress.filter(c => c.state === "done").length;
  const totalN = progress.length;
  const pct    = totalN > 0 ? Math.round((doneN / totalN) * 100) : 0;

  // ─── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Teklif başlatılamadı</h2>
        <p className="text-sm text-slate-500">{errorMsg}</p>
        <Link href="/renewals"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Yenilemelere Dön
        </Link>
      </div>
    );
  }

  // ─── LOADING / QUOTING / SAVING ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-5">

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-20 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Zap className="w-7 h-7 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {phase === "loading" ? "Yenileme Bilgileri Yükleniyor…"
             : phase === "saving" ? "Sonuçlar Kaydediliyor…"
             : "Yenileme Teklifleri Hazırlanıyor"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {phase === "loading"
              ? "Poliçe ve müşteri bilgileri otomatik alınıyor"
              : phase === "saving"
              ? "Teklif sonuç ekranına yönlendiriliyorsunuz"
              : `${totalN} şirketten teklifler alınıyor…`}
          </p>
        </div>
      </div>

      {/* Müşteri/poliçe özet şeridi — yüklenince görünür */}
      {policy && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
            👤 {policy.customers?.name ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> {policy.policy_type}
          </span>
          {vehicle.plaka && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 font-mono shadow-sm">
              🚗 {vehicle.plaka}
            </span>
          )}
          {policy.premium != null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 shadow-sm">
              Mevcut prim: {fmt(policy.premium)}
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {phase !== "loading" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-slate-400">{doneN} / {totalN} şirket</span>
            <span className="text-amber-600">%{pct}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Şirket listesi — canlı ilerleme */}
      {phase === "loading" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
              <div className="ml-auto h-3 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
          {progress.map(c => {
            const ok    = c.state === "done" && c.status === "success";
            const noOff = c.state === "done" && c.status === "no_offer";
            const err   = c.state === "done" && !ok && !noOff;
            return (
              <div key={c.name}
                className={`flex items-center gap-3 px-5 py-3 transition-colors duration-200
                  ${c.state === "running" ? "bg-amber-50/60" : ok ? "bg-emerald-50/30" : ""}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${ok ? "bg-emerald-100 text-emerald-700"
                   : err ? "bg-rose-50 text-rose-400"
                   : c.state === "running" ? "bg-amber-100 text-amber-700"
                   : "bg-slate-100 text-slate-400"}`}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={`text-sm font-semibold ${c.state === "waiting" ? "text-slate-400" : "text-slate-700"}`}>
                  {c.name}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {c.state === "waiting" && (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                      <Clock className="w-3 h-3" /> Bekliyor…
                    </span>
                  )}
                  {c.state === "running" && (
                    <span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Çalışıyor…
                    </span>
                  )}
                  {ok && (
                    <>
                      <span className="text-xs font-bold text-emerald-600">{fmt(c.price)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tamamlandı
                      </span>
                    </>
                  )}
                  {noOff && (
                    <span className="text-[11px] text-slate-400 italic">Teklif yok</span>
                  )}
                  {err && (
                    <span className="flex items-center gap-1 text-[11px] text-rose-500 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> Hata
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-400">
        {phase === "saving"
          ? "Neredeyse hazır…"
          : "Bu işlem otomatik tamamlanır — sayfayı kapatmayın."}
      </p>
    </div>
  );
}
