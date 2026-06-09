"use client";

/**
 * PolicePilot — Poliçeleştirme Sayfası v3
 *
 * Demo / Manuel modda poliçe oluşturmayı destekler.
 * Gerçek kart verisi sunucuya GÖNDERİLMEZ.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuoteResultDetail {
  id: string; quote_run_id: string; company_name: string;
  company_code: string | null; price: number; installment: string | null;
  note: string | null; status: string; source_type: string | null;
  provider_name: string | null; can_issue_policy: boolean;
  expires_at: string | null; payment_status: string; policy_status: string;
}
interface QuoteRunDetail {
  id: string; agency_id: string; customer_id: string | null;
  customer_name: string | null; customer_phone: string | null;
  customer_email: string | null; customer_tc: string | null;
  product_type: string; product_data: Record<string, string>;
  provider_type: string | null;
}
interface IssueContext { result: QuoteResultDetail; run: QuoteRunDetail; }

interface PolicyResult {
  policyNo: string; issuedAt: string; startDate: string;
  endDate: string; transactionId: string; isDemo: boolean;
}

interface CardForm {
  cardNo: string; expiry: string; cvv: string;
  holder: string; installment: string; secure3d: boolean;
}
const emptyCard: CardForm = { cardNo: "", expiry: "", cvv: "", holder: "", installment: "Peşin", secure3d: true };

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = ["Müşteri Bilgileri", "Araç Bilgileri", "Teklif Sonuçları", "Poliçeleştir"];

function Stepper() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm px-4 py-4 sm:px-6">
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold
                ${i < 3
                  ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-300"
                  : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                }`}>
                {i < 3
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  : "🛡️"
                }
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold hidden sm:block text-center leading-tight
                ${i < 3 ? "text-emerald-600" : "text-violet-700"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded ${i < 3 ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Credit card mockup ───────────────────────────────────────────────────────
function CreditCardMockup({ cardNo, holder, expiry, cvvFocused }: {
  cardNo: string; holder: string; expiry: string; cvvFocused: boolean;
}) {
  const segments = cardNo.replace(/\s/g, "").padEnd(16, "•").match(/.{1,4}/g) ?? ["••••", "••••", "••••", "••••"];
  return (
    <div className="w-full max-w-[320px] mx-auto" style={{ perspective: "1000px", height: "180px" }}>
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
        transform: cvvFocused ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* Front */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #6d28d9 100%)",
          borderRadius: 14, boxShadow: "0 16px 48px -8px rgba(109,40,217,0.40)",
        }} className="p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex gap-1">
              <div style={{ width: 28, height: 20, borderRadius: 4, background: "rgba(255,215,0,0.75)" }} />
              <div style={{ width: 18, height: 20, borderRadius: 3, background: "rgba(255,215,0,0.45)", border: "1px solid rgba(255,215,0,0.6)", marginLeft: -10 }} />
            </div>
            <div className="flex gap-0.5">
              <div className="w-6 h-6 rounded-full bg-red-500/80" />
              <div className="w-6 h-6 rounded-full bg-amber-400/80" style={{ marginLeft: -10 }} />
            </div>
          </div>
          <div>
            <div className="flex gap-2.5 mb-2.5">
              {segments.map((seg, i) => <span key={i} className="text-white font-mono text-sm tracking-widest">{seg}</span>)}
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-white/40 text-[8px] uppercase tracking-widest mb-0.5">Kart Sahibi</p>
                <p className="text-white text-xs font-semibold uppercase truncate max-w-[130px]">{holder || "AD SOYAD"}</p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-[8px] uppercase tracking-widest mb-0.5">S.K.T.</p>
                <p className="text-white text-xs font-semibold font-mono">{expiry || "AA/YY"}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)",
          borderRadius: 14,
        }}>
          <div style={{ height: 40, background: "rgba(0,0,0,0.55)", marginTop: 30 }} />
          <div className="px-4 mt-3">
            <p className="text-white/40 text-[8px] uppercase tracking-widest mb-1">CVV</p>
            <div className="bg-white/90 rounded h-8 flex items-center justify-end px-3">
              <span className="text-slate-400 tracking-[0.35em] font-mono text-sm">•••</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}
function formatCardNo(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function cardIsValid(c: CardForm) {
  return c.cardNo.replace(/\s/g, "").length === 16 && c.expiry.length === 5 && c.cvv.length >= 3 && c.holder.trim().length >= 2;
}
function productLabel(t: string) {
  const m: Record<string, string> = { kasko: "Kasko", trafik: "Zorunlu Trafik", dask: "DASK", konut: "Konut", saglik: "Sağlık", seyahat: "Seyahat" };
  return m[t?.toLowerCase()] ?? t;
}
function sourceLabel(s: string | null) {
  const m: Record<string, string> = { demo: "Demo", manual: "Manuel", api: "API", robot: "Robot", gateway: "InsurGateway" };
  return s ? (m[s] ?? s) : "Demo";
}

const TAKSIT_OPTS = ["Peşin", "2 Taksit", "3 Taksit", "6 Taksit", "9 Taksit", "12 Taksit"];

type PageStep = "loading" | "error" | "form" | "processing" | "success" | "already_issued";

// ─── Printable Policy Summary ─────────────────────────────────────────────────
function PrintableSummary({ ctx, policy }: { ctx: IssueContext; policy: PolicyResult }) {
  const pd = ctx.run.product_data ?? {};
  return (
    <div id="print-summary" className="hidden print:block p-8 max-w-2xl mx-auto text-slate-900 font-sans">
      {/* Header */}
      <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">PoliçePilot</h1>
          <p className="text-sm text-slate-500">Sigorta CRM Sistemi</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Tarih: {fmtDate(new Date().toISOString())}</p>
          {policy.isDemo && (
            <p className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-300 px-2 py-0.5 rounded mt-1 inline-block">
              ⚠ DEMO POLİÇE — Gerçek değildir
            </p>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4">Poliçe Özeti</h2>

      <table className="w-full text-sm mb-6 border-collapse">
        <tbody>
          {[
            ["Poliçe Numarası", policy.policyNo],
            ["Sigorta Şirketi", ctx.result.company_name],
            ["Sigorta Türü", productLabel(ctx.run.product_type)],
            ["Prim Tutarı", fmt(ctx.result.price)],
            ["Başlangıç Tarihi", fmtDate(policy.startDate)],
            ["Bitiş Tarihi", fmtDate(policy.endDate)],
            ["Kesim Tarihi", fmtDate(policy.issuedAt)],
            ["İşlem No", policy.transactionId],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-semibold text-slate-600 w-48">{k}</td>
              <td className="py-2 font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="font-bold text-sm mb-2 mt-4">Sigortalı Bilgileri</h3>
      <table className="w-full text-sm mb-6 border-collapse">
        <tbody>
          {[
            ["Ad Soyad", ctx.run.customer_name ?? "—"],
            ["T.C. / VKN", ctx.run.customer_tc ?? "—"],
            ["Telefon", ctx.run.customer_phone ?? "—"],
            ["E-posta", ctx.run.customer_email ?? "—"],
          ].filter(([,v]) => v !== "—").map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-semibold text-slate-600 w-48">{k}</td>
              <td className="py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(pd.plaka || pd.marka) && (
        <>
          <h3 className="font-bold text-sm mb-2 mt-4">Araç Bilgileri</h3>
          <table className="w-full text-sm mb-6 border-collapse">
            <tbody>
              {[["Plaka", pd.plaka], ["Marka", pd.marka], ["Model", pd.model], ["Yıl", pd.yil], ["Belge Seri", pd.belge_seri]]
                .filter(([,v]) => v).map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-semibold text-slate-600 w-48">{k}</td>
                    <td className="py-2 font-mono">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {policy.isDemo && (
        <div className="mt-8 p-4 border-2 border-orange-300 rounded bg-orange-50">
          <p className="text-sm font-bold text-orange-700">⚠ DEMO UYARI</p>
          <p className="text-xs text-orange-600 mt-1">
            Bu belge bir demo poliçe özetidir. Gerçek bir sigorta poliçesi değildir.
            Hukuki geçerliliği yoktur. Gerçek poliçe için sigorta şirketinizle iletişime geçin.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-8 text-center border-t border-slate-200 pt-4">
        PoliçePilot Sigorta CRM • Bu belge otomatik oluşturulmuştur
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PolicyIssuePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.quote_result_id as string;

  const [pageStep,      setPageStep]      = useState<PageStep>("loading");
  const [ctx,           setCtx]           = useState<IssueContext | null>(null);
  const [isDemo,        setIsDemo]        = useState(false);
  const [isManual,      setIsManual]      = useState(false);
  const [alreadyNo,     setAlreadyNo]     = useState<string | null>(null);
  const [pageError,     setPageError]     = useState("");
  const [card,          setCard]          = useState<CardForm>(emptyCard);
  const [cvvFocused,    setCvvFocused]    = useState(false);
  const [payError,      setPayError]      = useState("");
  const [processingMsg, setProcessingMsg] = useState("Poliçe oluşturuluyor…");
  const [policyResult,  setPolicyResult]  = useState<PolicyResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/policy-issue/${id}`);
      const json = await res.json();
      if (!res.ok) { setPageError(json.error ?? "Teklif yüklenemedi."); setPageStep("error"); return; }

      const { context, alreadyIssued, isDemo: demo, isManual: manual } = json as {
        context: IssueContext;
        alreadyIssued: { issued: boolean; policyNo?: string };
        isDemo: boolean; isManual: boolean;
      };

      setIsDemo(demo); setIsManual(manual);

      if (alreadyIssued.issued) {
        setAlreadyNo(alreadyIssued.policyNo ?? "—"); setCtx(context); setPageStep("already_issued"); return;
      }
      setCtx(context); setPageStep("form");
    } catch { setPageError("Bağlantı hatası."); setPageStep("error"); }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── Payment ───────────────────────────────────────────────────────────────
  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx) return;
    setPayError(""); setPageStep("processing");

    const msgs = isDemo
      ? ["Demo poliçe oluşturuluyor…", "Kayıt yazılıyor…", "Tamamlanıyor…"]
      : ["Ödeme işleniyor…", "Banka onayı bekleniyor…", "Poliçe kaydı oluşturuluyor…"];

    let mi = 0; setProcessingMsg(msgs[0]);
    intervalRef.current = setInterval(() => { mi = (mi + 1) % msgs.length; setProcessingMsg(msgs[mi]); }, 800);

    try {
      const res = await fetch(`/api/policy-issue/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: ctx.result.price,
          description: `${ctx.result.company_name} - ${productLabel(ctx.run.product_type)}`,
        }),
      });
      const json = await res.json();
      if (intervalRef.current) clearInterval(intervalRef.current);

      if (!res.ok) { setPayError(json.error ?? "İşlem başarısız."); setCard(emptyCard); setPageStep("form"); return; }

      setPolicyResult({
        policyNo:      json.policyNo, issuedAt: json.issuedAt,
        startDate:     json.startDate, endDate: json.endDate,
        transactionId: json.transactionId, isDemo: json.isDemo,
      });
      setPageStep("success");
    } catch {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPayError("Bağlantı hatası."); setCard(emptyCard); setPageStep("form");
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (pageStep === "loading") return (
    <div className="flex h-64 items-center justify-center gap-3">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      <span className="text-sm text-slate-500">Yükleniyor…</span>
    </div>
  );

  // ─── Error ────────────────────────────────────────────────────────────────
  if (pageStep === "error") return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-3xl">⚠️</div>
      <h2 className="text-lg font-bold text-slate-800">Bir sorun oluştu</h2>
      <p className="text-sm text-slate-500">{pageError}</p>
      <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">← Geri dön</button>
    </div>
  );

  // ─── Already issued ───────────────────────────────────────────────────────
  if (pageStep === "already_issued" && ctx) return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl">✅</div>
      <h2 className="text-lg font-bold text-slate-800">Bu teklif zaten poliçeye dönüştürülmüş</h2>
      <p className="text-sm text-slate-500">{ctx.result.company_name}</p>
      <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-3">
        <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-1">Poliçe No</p>
        <p className="text-2xl font-mono font-bold text-emerald-700">{alreadyNo}</p>
      </div>
      <div className="flex gap-3 justify-center pt-2">
        <Link href="/policies" className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">Poliçelere Git →</Link>
        <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">Geri dön</button>
      </div>
    </div>
  );

  // ─── Processing ───────────────────────────────────────────────────────────
  if (pageStep === "processing") return (
    <div className="flex h-80 flex-col items-center justify-center gap-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
        <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-xl">🛡️</div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-slate-800 animate-pulse">{processingMsg}</p>
        <p className="text-xs text-slate-400 mt-1">Lütfen sayfayı kapatmayın.</p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  );

  // ─── SUCCESS ──────────────────────────────────────────────────────────────
  if (pageStep === "success" && policyResult && ctx) {
    const pd = ctx.run.product_data ?? {};
    const vehicleParts = [pd.plaka, pd.marka, pd.model, pd.yil].filter(Boolean);

    return (
      <div className="max-w-3xl mx-auto py-8 space-y-5 print:py-0">
        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #print-summary, #print-summary * { visibility: visible; }
            #print-summary { position: fixed; top: 0; left: 0; width: 100%; }
          }
        `}</style>

        {/* Hidden printable summary */}
        <PrintableSummary ctx={ctx} policy={policyResult} />

        {/* Demo warning banner */}
        {policyResult.isDemo && (
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-4 print:hidden">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-amber-800">Bu bir Demo Poliçedir</p>
              <p className="text-sm text-amber-700 mt-0.5">Gerçek bir sigorta poliçesi değildir. Hukuki geçerliliği yoktur. Gerçek poliçe için sigorta şirketiyle iletişime geçin.</p>
            </div>
          </div>
        )}

        {/* Success banner */}
        <div className="relative overflow-hidden rounded-2xl text-center print:hidden"
          style={{ background: policyResult.isDemo ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative py-8 px-6">
            <div className="text-5xl mb-2">{policyResult.isDemo ? "🎭" : "🎉"}</div>
            <h2 className="text-xl font-bold text-white mb-1">
              {policyResult.isDemo ? "Demo Poliçe Oluşturuldu!" : "Poliçe Başarıyla Kesildi!"}
            </h2>
            <p className="text-white/80 text-sm">
              {policyResult.isDemo ? "Demo kayıt oluşturuldu — gerçek ödeme alınmadı." : "Ödeme tamamlandı ve poliçeniz oluşturuldu."}
            </p>
          </div>
        </div>

        {/* Policy details grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
          {/* Policy number */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Poliçe Numarası</p>
              <p className="text-2xl font-mono font-bold text-white tracking-wider">{policyResult.policyNo}</p>
            </div>
            {policyResult.isDemo && (
              <span className="text-[10px] font-extrabold bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full uppercase tracking-widest">Demo</span>
            )}
          </div>

          {/* Details */}
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ["Sigorta Şirketi", ctx.result.company_name],
              ["Sigorta Türü",    productLabel(ctx.run.product_type)],
              ["Prim Tutarı",     fmt(ctx.result.price)],
              ["Müşteri",         ctx.run.customer_name ?? "—"],
              ["Başlangıç",       fmtDate(policyResult.startDate)],
              ["Bitiş",           fmtDate(policyResult.endDate)],
              ...(ctx.run.customer_tc ? [["T.C. / VKN", ctx.run.customer_tc]] : []),
              ...(vehicleParts.length > 0 ? [["Araç", vehicleParts.join(" • ")]] : []),
              ["Kaynak",          sourceLabel(ctx.run.provider_type)],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{k}</p>
                <p className="font-semibold text-slate-800 truncate">{v}</p>
              </div>
            ))}
          </div>

          {/* Transaction ID */}
          <div className="px-5 pb-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">İşlem ID</p>
              <p className="font-mono text-xs text-slate-600 break-all">{policyResult.transactionId}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 print:hidden">
          <Link href="/policies"
            className="flex-1 min-w-[160px] text-center py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all">
            Poliçelere Git →
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect width="12" height="8" x="6" y="14"/>
            </svg>
            Poliçe Özeti Yazdır
          </button>
          <Link href={`/quote-center/${ctx.run.id}`}
            className="flex items-center justify-center px-5 py-3.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">
            Teklif Çalışmasına Dön
          </Link>
        </div>
      </div>
    );
  }

  // ─── FORM ────────────────────────────────────────────────────────────────
  if (!ctx) return null;
  const { result, run } = ctx;
  const pd = run.product_data ?? {};
  const vehicleParts = [pd.plaka, pd.marka, pd.model, pd.yil].filter(Boolean);
  const modeLabel    = isDemo ? "Demo" : isManual ? "Manuel" : "Gerçek";

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:shadow-sm transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Poliçeleştirme</h1>
            {isDemo && <span className="text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-widest">Demo Mod</span>}
            {isManual && <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-300 px-2 py-0.5 rounded-full uppercase tracking-widest">Manuel</span>}
          </div>
          <p className="text-xs text-slate-400">Ödemeyi tamamla ve poliçeyi kes</p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper />

      {/* Demo / Manual mode top notice */}
      {(isDemo || isManual) && (
        <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 border-2
          ${isDemo ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
          <span className="text-xl flex-shrink-0">{isDemo ? "🎭" : "📋"}</span>
          <div>
            <p className={`font-bold text-sm ${isDemo ? "text-amber-800" : "text-blue-800"}`}>
              {isDemo ? "Demo Mod — Gerçek poliçe kesilmez" : "Manuel Kayıt Modu"}
            </p>
            <p className={`text-xs mt-0.5 ${isDemo ? "text-amber-700" : "text-blue-700"}`}>
              {isDemo
                ? "Bu işlem demo modda çalışıyor. Kart bilgileri doğrulanmayacak, gerçek ödeme alınmayacak ve demo poliçe kaydı oluşturulacaktır."
                : "Manuel kayıt modunda gerçek şirket API'si çağrılmaz. Poliçe bilgileri sisteme manuel kayıt olarak eklenir."
              }
            </p>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── LEFT ── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Selected quote hero */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Seçilen Teklif</span>
              {result.expires_at && (
                <span className="text-xs text-white/60">Son geçerlilik: {fmtDate(result.expires_at)}</span>
              )}
            </div>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shadow-sm">
                  {result.company_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">{result.company_name}</p>
                  <p className="text-xs text-slate-500">{productLabel(run.product_type)} · {modeLabel} kaynak</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-900">{fmt(result.price)}</p>
                {result.installment && result.installment !== "Peşin" && (
                  <p className="text-xs text-slate-400">{result.installment}</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {isDemo ? "Demo Ödeme Formu" : "Ödeme Bilgileri"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {isDemo ? "Kart verisi sunucuya iletilmez, ödeme alınmaz" : "Kart bilgileri sunucuya iletilmez"}
                </p>
              </div>
              <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="11" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                SSL
              </span>
            </div>

            <form onSubmit={handlePay} className="p-5 space-y-4">
              <CreditCardMockup cardNo={card.cardNo} holder={card.holder} expiry={card.expiry} cvvFocused={cvvFocused} />

              {/* Security notice */}
              <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs border
                ${isDemo ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                <span className="flex-shrink-0 mt-0.5">🔒</span>
                <span>
                  {isDemo
                    ? <><strong>Demo modu:</strong> Kart bilgileriniz sunucuya kaydedilmez ve ödeme alınmaz. Bu yalnızca arayüz demosu içindir.</>
                    : <><strong>Güvenli ödeme:</strong> Kart bilgileriniz şifrelenir ve sunucuya iletilmez. Gerçek entegrasyonda İyzico/PayTR kullanılır.</>
                  }
                </span>
              </div>

              {/* Card holder */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kart Üzerindeki İsim *</label>
                <input type="text" autoComplete="cc-name" placeholder="AD SOYAD" required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-medium uppercase placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.holder} onChange={e => setCard(c => ({ ...c, holder: e.target.value.toUpperCase() }))} />
              </div>

              {/* Card number */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kart Numarası *</label>
                <input type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000  0000  0000  0000" maxLength={19} required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono tracking-[0.2em] placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.cardNo} onChange={e => setCard(c => ({ ...c, cardNo: formatCardNo(e.target.value) }))} />
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Son Kullanma *</label>
                  <input type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="AA/YY" maxLength={5} required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono tracking-widest placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                    value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">CVV *</label>
                  <input type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                    value={card.cvv}
                    onFocus={() => setCvvFocused(true)} onBlur={() => setCvvFocused(false)}
                    onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
                </div>
              </div>

              {/* Taksit */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Taksit Seçimi</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.installment} onChange={e => setCard(c => ({ ...c, installment: e.target.value }))}>
                  {TAKSIT_OPTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* 3D Secure */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-violet-50 hover:border-violet-200 transition-all">
                <input type="checkbox" checked={card.secure3d} onChange={e => setCard(c => ({ ...c, secure3d: e.target.checked }))} className="w-4 h-4 rounded accent-violet-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">3D Secure ile Öde</p>
                  <p className="text-[11px] text-slate-400">SMS onayıyla güvenli ödeme</p>
                </div>
                <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Önerilen</span>
              </label>

              {/* Error */}
              {payError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                  <span>⚠️</span><span>{payError}</span>
                </div>
              )}

              {/* CTA */}
              <button type="submit" disabled={!cardIsValid(card)}
                className={`w-full rounded-xl px-5 py-4 text-base font-bold text-white transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                  hover:-translate-y-0.5 active:translate-y-0
                  ${isDemo
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-xl shadow-amber-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-500/25"
                  }`}>
                <span className="flex items-center justify-center gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {isDemo ? "Demo Poliçe Oluştur" : "Poliçeleştirme Yap"} — {fmt(result.price)}
                </span>
              </button>

              <p className="text-center text-[11px] text-slate-400">
                {isDemo ? "Demo mod — gerçek ödeme alınmaz, kart verisi saklanmaz" : "Gerçek ödeme yapılır"}
              </p>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Sticky summary ── */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            {/* Customer */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">👤</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sigortalı</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                    {(run.customer_name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{run.customer_name ?? "—"}</p>
                    {run.customer_tc && <p className="text-xs text-slate-400 font-mono">{run.customer_tc}</p>}
                  </div>
                </div>
                {(run.customer_phone || run.customer_email) && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    {run.customer_phone && (
                      <p className="flex items-center gap-2 text-xs text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 10.93 19.79 19.79 0 0 1 2 2.38 2 2 0 0 1 3.97 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/></svg>
                        {run.customer_phone}
                      </p>
                    )}
                    {run.customer_email && (
                      <p className="flex items-center gap-2 text-xs text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        {run.customer_email}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle */}
            {vehicleParts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-base">🚗</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Araç</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                  {pd.plaka && <div><p className="text-slate-400 mb-0.5">Plaka</p><p className="font-bold text-slate-800 font-mono">{pd.plaka}</p></div>}
                  {pd.yil   && <div><p className="text-slate-400 mb-0.5">Yıl</p><p className="font-semibold text-slate-800">{pd.yil}</p></div>}
                  {pd.marka && <div><p className="text-slate-400 mb-0.5">Marka</p><p className="font-semibold text-slate-800">{pd.marka}</p></div>}
                  {pd.model && <div><p className="text-slate-400 mb-0.5">Model</p><p className="font-semibold text-slate-800 truncate">{pd.model}</p></div>}
                </div>
              </div>
            )}

            {/* Policy summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">🛡️</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Poliçe Özeti</span>
              </div>
              <div className="p-4 space-y-2.5 text-sm">
                {[
                  ["Şirket",       result.company_name],
                  ["Sigorta Türü", productLabel(run.product_type)],
                  ["Taksit",       result.installment ?? "Peşin"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-800">{v}</span>
                  </div>
                ))}
                {result.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Son Geçerlilik</span>
                    <span className="font-semibold text-slate-800">{fmtDate(result.expires_at)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Kaynak</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border
                    ${isDemo ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-violet-100 text-violet-700 border-violet-200"}`}>
                    {modeLabel}
                  </span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex justify-between items-center pt-0.5">
                  <span className="font-semibold text-slate-600">Ödenecek Tutar</span>
                  <span className="text-xl font-bold text-emerald-600">{fmt(result.price)}</span>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 font-semibold">
                {[["🔒","SSL Şifreli"], ["🛡️","3D Secure"], [isDemo ? "🎭" : "✅", isDemo ? "Demo Mod" : "PCI DSS"]].map(([icon, label]) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="text-xl">{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
