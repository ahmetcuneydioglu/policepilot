"use client";

/**
 * PolicePilot — Poliçeleştirme Sayfası v2 (Premium Redesign)
 * /policies/issue/[quote_result_id]
 *
 * Güvenlik: Kart bilgileri sunucuya GÖNDERİLMEZ.
 * POST body sadece amount + description içerir.
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

interface CardForm {
  cardNo: string; expiry: string; cvv: string; holder: string;
  installment: string; secure3d: boolean;
}

const emptyCard: CardForm = {
  cardNo: "", expiry: "", cvv: "", holder: "", installment: "Peşin", secure3d: true
};

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Müşteri Bilgileri",   icon: "👤" },
  { label: "Araç Bilgileri",      icon: "🚗" },
  { label: "Teklif Sonuçları",    icon: "📊" },
  { label: "Poliçeleştir",        icon: "🛡️" },
];

function Stepper() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm px-4 py-4 sm:px-6">
      <div className="flex items-center">
        {STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all
                ${i < 3
                  ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-300"
                  : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                }`}
              >
                {i < 3 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs">{step.icon}</span>
                )}
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold hidden sm:block text-center leading-tight
                ${i < 3 ? "text-emerald-600" : "text-violet-700"}`}
              >
                {step.label}
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
function CreditCardMockup({
  cardNo, holder, expiry, cvvFocused,
}: { cardNo: string; holder: string; expiry: string; cvvFocused: boolean }) {
  const segments = cardNo.replace(/\s/g, "").padEnd(16, "•").match(/.{1,4}/g) ?? ["••••","••••","••••","••••"];

  return (
    <div className="w-full max-w-[340px] mx-auto" style={{ perspective: "1000px", height: "196px" }}>
      <div
        style={{
          position: "relative", width: "100%", height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
          transform: cvvFocused ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── Card front ── */}
        <div
          style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #6d28d9 100%)",
            borderRadius: "16px",
            boxShadow: "0 20px 60px -10px rgba(109,40,217,0.45), 0 4px 20px -2px rgba(0,0,0,0.25)",
          }}
          className="p-5 flex flex-col justify-between"
        >
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="flex gap-1.5">
              <div style={{ width: 32, height: 24, borderRadius: 5, background: "rgba(255,215,0,0.75)" }} />
              <div style={{
                position: "absolute", left: 46, top: 22,
                width: 20, height: 24, borderRadius: 4,
                background: "rgba(255,215,0,0.45)",
                border: "1px solid rgba(255,215,0,0.6)"
              }} />
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex gap-0.5">
                <div className="w-7 h-7 rounded-full bg-red-500/80" />
                <div className="w-7 h-7 rounded-full bg-amber-400/80 -ml-3" />
              </div>
              <span className="text-white/60 text-[9px] font-bold tracking-widest uppercase">Mastercard</span>
            </div>
          </div>
          {/* Contactless icon */}
          <div className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/40">
              <path fill="currentColor" d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 20 12h2A10 10 0 0 0 12 2z"/>
              <path fill="currentColor" d="M12 6a6 6 0 0 0-4.24 10.24l1.42-1.42A4 4 0 1 1 16 12h2A6 6 0 0 0 12 6z"/>
              <path fill="currentColor" d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </svg>
          </div>
          {/* Card number */}
          <div>
            <div className="flex gap-3 mb-3">
              {segments.map((seg, i) => (
                <span key={i} className="text-white font-mono text-base tracking-widest">{seg}</span>
              ))}
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-white/40 text-[8px] uppercase tracking-widest mb-0.5">Kart Sahibi</div>
                <div className="text-white text-xs font-semibold uppercase tracking-wide truncate max-w-[140px]">
                  {holder || "AD SOYAD"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/40 text-[8px] uppercase tracking-widest mb-0.5">S.K.T.</div>
                <div className="text-white text-xs font-semibold font-mono">
                  {expiry || "AA/YY"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card back ── */}
        <div
          style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)",
            borderRadius: "16px",
            boxShadow: "0 20px 60px -10px rgba(109,40,217,0.45)",
          }}
        >
          <div style={{ height: 48, background: "rgba(0,0,0,0.55)", marginTop: 36 }} />
          <div className="px-5 mt-4">
            <div className="text-white/40 text-[8px] uppercase tracking-widest mb-1.5">CVV</div>
            <div className="bg-white/90 rounded h-9 flex items-center justify-end px-4">
              <span className="text-slate-400 tracking-[0.35em] font-mono text-sm">•••</span>
            </div>
          </div>
          <div className="px-5 mt-4 text-white/25 text-[9px] leading-relaxed">
            Bu kart demo amaçlıdır. Kart bilgileri hiçbir şekilde kayıt edilmez.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
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
  const m: Record<string, string> = {
    kasko: "Kasko", trafik: "Zorunlu Trafik", dask: "DASK",
    konut: "Konut Sigortası", saglik: "Sağlık", seyahat: "Seyahat",
  };
  return m[t?.toLowerCase()] ?? t;
}
function sourceLabel(s: string | null) {
  const m: Record<string, string> = { demo: "Demo", manual: "Manuel", api: "API", robot: "Robot", gateway: "InsurGateway" };
  return s ? (m[s] ?? s) : "Demo";
}

const TAKSIT_OPTS = ["Peşin", "2 Taksit", "3 Taksit", "6 Taksit", "9 Taksit", "12 Taksit"];

type Step = "loading" | "error" | "form" | "processing" | "success" | "already_issued";

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PolicyIssuePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.quote_result_id as string;

  const [step,          setStep]          = useState<Step>("loading");
  const [ctx,           setCtx]           = useState<IssueContext | null>(null);
  const [alreadyNo,     setAlreadyNo]     = useState<string | null>(null);
  const [pageError,     setPageError]     = useState("");
  const [card,          setCard]          = useState<CardForm>(emptyCard);
  const [cvvFocused,    setCvvFocused]    = useState(false);
  const [payError,      setPayError]      = useState("");
  const [processingMsg, setProcessingMsg] = useState("Ödeme işleniyor…");
  const [policyResult,  setPolicyResult]  = useState<{ policyNo: string; issuedAt: string; transactionId: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/policy-issue/${id}`);
      const json = await res.json();
      if (!res.ok) { setPageError(json.error ?? "Teklif yüklenemedi."); setStep("error"); return; }
      const { context, alreadyIssued } = json as { context: IssueContext; alreadyIssued: { issued: boolean; policyNo?: string } };
      if (alreadyIssued.issued) { setAlreadyNo(alreadyIssued.policyNo ?? "—"); setCtx(context); setStep("already_issued"); return; }
      setCtx(context);
      setStep("form");
    } catch { setPageError("Bağlantı hatası."); setStep("error"); }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── Payment ───────────────────────────────────────────────────────────────
  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx) return;
    setPayError(""); setStep("processing");
    const msgs = ["Ödeme işleniyor…", "Banka onayı bekleniyor…", "Poliçe kaydı oluşturuluyor…"];
    let mi = 0;
    intervalRef.current = setInterval(() => { mi = (mi + 1) % msgs.length; setProcessingMsg(msgs[mi]); }, 900);
    try {
      const res = await fetch(`/api/policy-issue/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: ctx.result.price, description: `${ctx.result.company_name} - ${productLabel(ctx.run.product_type)}` }),
      });
      const json = await res.json();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!res.ok) { setPayError(json.error ?? "Ödeme başarısız."); setCard(emptyCard); setStep("form"); return; }
      setPolicyResult({ policyNo: json.policyNo, issuedAt: json.issuedAt, transactionId: json.transactionId });
      setStep("success");
    } catch {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPayError("Bağlantı hatası."); setCard(emptyCard); setStep("form");
    }
  }

  // ─── Render: Loading ──────────────────────────────────────────────────────
  if (step === "loading") return (
    <div className="flex h-64 items-center justify-center gap-3">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      <span className="text-sm text-slate-500">Teklif bilgileri yükleniyor…</span>
    </div>
  );

  // ─── Render: Error ────────────────────────────────────────────────────────
  if (step === "error") return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-3xl">⚠️</div>
      <h2 className="text-lg font-bold text-slate-800">Bir sorun oluştu</h2>
      <p className="text-sm text-slate-500">{pageError}</p>
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">
        ← Geri dön
      </button>
    </div>
  );

  // ─── Render: Already issued ───────────────────────────────────────────────
  if (step === "already_issued" && ctx) return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl">✅</div>
      <h2 className="text-lg font-bold text-slate-800">Bu teklif zaten poliçeye dönüştürülmüş</h2>
      <p className="text-sm text-slate-500">{ctx.result.company_name}</p>
      <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-3">
        <p className="text-xs text-emerald-600 font-semibold uppercase tracking-widest mb-1">Poliçe No</p>
        <p className="text-2xl font-mono font-bold text-emerald-700">{alreadyNo}</p>
      </div>
      <div className="flex gap-3 justify-center pt-2">
        <Link href="/policies" className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">Poliçelere Git →</Link>
        <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">Geri dön</button>
      </div>
    </div>
  );

  // ─── Render: Processing ───────────────────────────────────────────────────
  if (step === "processing") return (
    <div className="flex h-80 flex-col items-center justify-center gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-violet-100" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-xl">🛡️</div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-slate-800 animate-pulse">{processingMsg}</p>
        <p className="text-xs text-slate-400 mt-1">Lütfen sayfayı kapatmayın.</p>
      </div>
      <div className="flex gap-1.5 mt-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  // ─── Render: Success ──────────────────────────────────────────────────────
  if (step === "success" && policyResult && ctx) return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Big success banner */}
      <div className="relative overflow-hidden rounded-2xl text-center"
        style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative py-10 px-6">
          <div className="text-6xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-1">Poliçe Başarıyla Kesildi!</h2>
          <p className="text-emerald-100 text-sm">Ödeme tamamlandı ve poliçeniz oluşturuldu.</p>
        </div>
      </div>

      {/* Policy number hero */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Poliçe Numarası</p>
        <p className="text-4xl font-mono font-bold text-emerald-600 tracking-wider mb-4">{policyResult.policyNo}</p>
        <div className="grid grid-cols-2 gap-3 text-sm text-left">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Şirket</p>
            <p className="font-semibold text-slate-800">{ctx.result.company_name}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Prim</p>
            <p className="font-bold text-slate-800">{fmt(ctx.result.price)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Müşteri</p>
            <p className="font-semibold text-slate-800">{ctx.run.customer_name ?? "—"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Kesim Tarihi</p>
            <p className="font-semibold text-slate-800">{new Date(policyResult.issuedAt).toLocaleDateString("tr-TR")}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 col-span-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">İşlem ID</p>
            <p className="font-mono text-xs text-slate-600">{policyResult.transactionId}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/policies"
          className="flex-1 text-center py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all">
          Poliçelere Git →
        </Link>
        <Link href={`/quote-center/${ctx.run.id}`}
          className="flex-1 text-center py-3.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors">
          Teklif Çalışmasına Dön
        </Link>
      </div>
    </div>
  );

  // ─── Render: FORM ─────────────────────────────────────────────────────────
  if (!ctx) return null;
  const { result, run } = ctx;
  const pd = run.product_data ?? {};
  const vehicleParts = [pd.plaka, pd.marka, pd.model, pd.yil].filter(Boolean);

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
          <h1 className="text-lg font-bold text-slate-900">Poliçeleştirme</h1>
          <p className="text-xs text-slate-400">Ödemeyi tamamla ve poliçeni kes</p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── LEFT: Payment ── */}
        <div className="lg:col-span-7 space-y-5">

          {/* Selected quote hero */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Seçilen Teklif</span>
              {result.expires_at && (
                <span className="text-xs text-white/60">
                  Son geçerlilik: {new Date(result.expires_at).toLocaleDateString("tr-TR")}
                </span>
              )}
            </div>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shadow-sm">
                  {result.company_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">{result.company_name}</p>
                  <p className="text-xs text-slate-500">{productLabel(run.product_type)}</p>
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

          {/* Payment form card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Ödeme Bilgileri</h2>
                <p className="text-[11px] text-slate-400">Kart bilgileri sunucuya iletilmez</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="11" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                256-bit SSL
              </div>
            </div>

            <form onSubmit={handlePay} className="p-5 space-y-5">
              {/* Credit card visual */}
              <CreditCardMockup
                cardNo={card.cardNo} holder={card.holder}
                expiry={card.expiry} cvvFocused={cvvFocused}
              />

              {/* Security notice */}
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                <span className="text-base flex-shrink-0 mt-0.5">🔒</span>
                <span>
                  <strong>Demo modu:</strong> Kart bilgileriniz şifrelenir ve sunucuya iletilmez. Gerçek entegrasyonda İyzico/PayTR kullanılacaktır.
                </span>
              </div>

              {/* Card holder */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kart Üzerindeki İsim *</label>
                <input
                  type="text" autoComplete="cc-name" placeholder="AD SOYAD" required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-medium uppercase placeholder-slate-300
                             focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.holder}
                  onChange={e => setCard(c => ({ ...c, holder: e.target.value.toUpperCase() }))}
                />
              </div>

              {/* Card number */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kart Numarası *</label>
                <input
                  type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000  0000  0000  0000"
                  maxLength={19} required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono tracking-[0.2em] placeholder-slate-300
                             focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.cardNo}
                  onChange={e => setCard(c => ({ ...c, cardNo: formatCardNo(e.target.value) }))}
                />
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Son Kullanma Tarihi *</label>
                  <input
                    type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="AA/YY"
                    maxLength={5} required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono tracking-widest placeholder-slate-300
                               focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                    value={card.expiry}
                    onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">CVV *</label>
                  <input
                    type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••"
                    maxLength={4} required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 font-mono placeholder-slate-300
                               focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                    value={card.cvv}
                    onFocus={() => setCvvFocused(true)}
                    onBlur={() => setCvvFocused(false)}
                    onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  />
                </div>
              </div>

              {/* Taksit */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Taksit Seçimi</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 font-medium
                             focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:bg-white transition-all"
                  value={card.installment}
                  onChange={e => setCard(c => ({ ...c, installment: e.target.value }))}
                >
                  {TAKSIT_OPTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* 3D Secure */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-violet-50 hover:border-violet-200 transition-all">
                <input
                  type="checkbox" checked={card.secure3d}
                  onChange={e => setCard(c => ({ ...c, secure3d: e.target.checked }))}
                  className="w-4 h-4 rounded accent-violet-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">3D Secure ile Öde</p>
                  <p className="text-[11px] text-slate-400">SMS onayıyla güvenli ödeme</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Önerilen</span>
                </div>
              </label>

              {/* Error */}
              {payError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                  <span>⚠️</span><span>{payError}</span>
                </div>
              )}

              {/* CTA */}
              <button
                type="submit"
                disabled={!cardIsValid(card)}
                className="w-full rounded-xl px-5 py-4 text-base font-bold text-white transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                           bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                           shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40
                           hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              >
                <span className="flex items-center justify-center gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Poliçeleştirme Yap — {fmt(result.price)}
                </span>
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Demo ortamı — gerçek ödeme alınmaz
              </p>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Sticky summary panel ── */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">

            {/* Customer info */}
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
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    {run.customer_phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 10.93 19.79 19.79 0 0 1 2 2.38 2 2 0 0 1 3.97 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/>
                        </svg>
                        {run.customer_phone}
                      </div>
                    )}
                    {run.customer_email && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                        {run.customer_email}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle / product info */}
            {vehicleParts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-base">🚗</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Araç Bilgileri</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                  {pd.plaka && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Plaka</p>
                      <p className="font-bold text-slate-800 font-mono">{pd.plaka}</p>
                    </div>
                  )}
                  {pd.yil && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Model Yılı</p>
                      <p className="font-semibold text-slate-800">{pd.yil}</p>
                    </div>
                  )}
                  {pd.marka && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Marka</p>
                      <p className="font-semibold text-slate-800">{pd.marka}</p>
                    </div>
                  )}
                  {pd.model && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Model</p>
                      <p className="font-semibold text-slate-800 truncate">{pd.model}</p>
                    </div>
                  )}
                  {pd.belge_seri && (
                    <div className="col-span-2">
                      <p className="text-slate-400 mb-0.5">Belge Seri</p>
                      <p className="font-mono text-slate-700">{pd.belge_seri}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Policy summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">🛡️</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Poliçe Özeti</span>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Şirket</span>
                  <span className="font-semibold text-slate-800">{result.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sigorta Türü</span>
                  <span className="font-semibold text-slate-800">{productLabel(run.product_type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taksit</span>
                  <span className="font-semibold text-slate-800">{result.installment ?? "Peşin"}</span>
                </div>
                {result.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Son Geçerlilik</span>
                    <span className="font-semibold text-slate-800">{new Date(result.expires_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Kaynak</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                    {sourceLabel(run.provider_type)}
                  </span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Ödenecek Tutar</span>
                  <span className="text-xl font-bold text-emerald-600">{fmt(result.price)}</span>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 font-semibold">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">🔒</span>
                  <span>SSL Şifreli</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">🛡️</span>
                  <span>3D Secure</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">✅</span>
                  <span>PCI DSS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
