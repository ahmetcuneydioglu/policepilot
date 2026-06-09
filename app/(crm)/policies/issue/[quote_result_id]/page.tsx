"use client";

/**
 * PolicePilot — Poliçeleştirme Sayfası
 * /policies/issue/[quote_result_id]
 *
 * Akış:
 *  1. Teklif özeti + müşteri/araç bilgileri yükle (GET /api/policy-issue/:id)
 *  2. Mock kart formu doldur (kart verisi sunucuya GÖNDERİLMEZ)
 *  3. "Ödemeyi Tamamla" → POST /api/policy-issue/:id  (sadece tutar gönderilir)
 *  4. Başarı ekranı: Poliçe No + "Poliçelere Git" butonu
 */

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams }                     from "next/navigation";
import Link                                         from "next/link";

// ─── Types (local mirror) ─────────────────────────────────────────────────────

interface QuoteResultDetail {
  id:              string;
  quote_run_id:    string;
  company_name:    string;
  company_code:    string | null;
  price:           number;
  installment:     string | null;
  note:            string | null;
  status:          string;
  source_type:     string | null;
  provider_name:   string | null;
  can_issue_policy: boolean;
  expires_at:      string | null;
  payment_status:  string;
  policy_status:   string;
}

interface QuoteRunDetail {
  id:             string;
  agency_id:      string;
  customer_id:    string | null;
  customer_name:  string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_tc:    string | null;
  product_type:   string;
  product_data:   Record<string, string>;
  provider_type:  string | null;
}

interface IssueContext {
  result: QuoteResultDetail;
  run:    QuoteRunDetail;
}

// ─── Card form state (never sent to server) ───────────────────────────────────

interface CardForm {
  cardNo:  string;  // Display only — masked before any action
  expiry:  string;
  cvv:     string;
  holder:  string;
}

const emptyCard: CardForm = { cardNo: "", expiry: "", holder: "", cvv: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function formatCardNo(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function cardIsValid(c: CardForm) {
  return (
    c.cardNo.replace(/\s/g, "").length === 16 &&
    c.expiry.length === 5 &&
    c.cvv.length >= 3 &&
    c.holder.trim().length >= 2
  );
}

function productTypeLabel(t: string) {
  const map: Record<string, string> = {
    kasko:    "Kasko",
    trafik:   "Zorunlu Trafik Sigortası",
    dask:     "DASK",
    konut:    "Konut Sigortası",
    saglik:   "Sağlık Sigortası",
    seyahat:  "Seyahat Sigortası",
  };
  return map[t?.toLowerCase()] ?? t;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = "loading" | "error" | "form" | "processing" | "success" | "already_issued";

export default function PolicyIssuePage() {
  const router = useRouter();
  const params = useParams();
  const quoteResultId = params.quote_result_id as string;

  const [step,         setStep]         = useState<Step>("loading");
  const [context,      setContext]       = useState<IssueContext | null>(null);
  const [alreadyNo,    setAlreadyNo]     = useState<string | null>(null);
  const [pageError,    setPageError]     = useState<string>("");
  const [card,         setCard]          = useState<CardForm>(emptyCard);
  const [payError,     setPayError]      = useState<string>("");
  const [policyResult, setPolicyResult]  = useState<{
    policyNo: string; issuedAt: string; transactionId: string;
  } | null>(null);
  const [processingMsg, setProcessingMsg] = useState("Ödeme işleniyor…");

  // ── Load quote context ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/policy-issue/${quoteResultId}`);
      const json = await res.json();

      if (!res.ok) {
        setPageError(json.error ?? "Teklif yüklenemedi.");
        setStep("error");
        return;
      }

      const { context: ctx, alreadyIssued } = json as {
        context: IssueContext;
        alreadyIssued: { issued: boolean; policyNo?: string };
      };

      if (alreadyIssued.issued) {
        setAlreadyNo(alreadyIssued.policyNo ?? "—");
        setContext(ctx);
        setStep("already_issued");
        return;
      }

      setContext(ctx);
      setStep("form");
    } catch {
      setPageError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setStep("error");
    }
  }, [quoteResultId]);

  useEffect(() => { load(); }, [load]);

  // ── Payment submit ──────────────────────────────────────────────────────────
  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!context) return;
    setPayError("");
    setStep("processing");

    const messages = [
      "Ödeme işleniyor…",
      "Banka onayı bekleniyor…",
      "Poliçe kaydı oluşturuluyor…",
    ];
    let mi = 0;
    const interval = setInterval(() => {
      mi = (mi + 1) % messages.length;
      setProcessingMsg(messages[mi]);
    }, 900);

    try {
      // ⚠️  Kart bilgisi gönderilmiyor — yalnızca tutar
      const res = await fetch(`/api/policy-issue/${quoteResultId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          amount:      context.result.price,
          description: `${context.result.company_name} - ${productTypeLabel(context.run.product_type)}`,
        }),
      });
      const json = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        setPayError(json.error ?? "Ödeme başarısız.");
        setCard(emptyCard); // Formu sıfırla (güvenlik)
        setStep("form");
        return;
      }

      setPolicyResult({
        policyNo:      json.policyNo,
        issuedAt:      json.issuedAt,
        transactionId: json.transactionId,
      });
      setStep("success");
    } catch {
      clearInterval(interval);
      setPayError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setCard(emptyCard);
      setStep("form");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <span className="ml-3 text-sm text-white/60">Teklif bilgileri yükleniyor…</span>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold text-white">Bir sorun oluştu</h2>
        <p className="mb-6 text-sm text-white/60">{pageError}</p>
        <button onClick={() => router.back()}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors">
          ← Geri dön
        </button>
      </div>
    );
  }

  if (step === "already_issued" && context) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h2 className="mb-1 text-xl font-semibold text-white">Bu teklif zaten poliçeye dönüştürülmüş</h2>
        <p className="mb-1 text-sm text-white/60">Şirket: <span className="text-white">{context.result.company_name}</span></p>
        <p className="mb-6 text-lg font-mono font-bold text-violet-300">{alreadyNo}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/policies"
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
            Poliçelere Git →
          </Link>
          <button onClick={() => router.back()}
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors">
            Geri dön
          </button>
        </div>
      </div>
    );
  }

  if (step === "success" && policyResult && context) {
    return (
      <div className="mx-auto max-w-lg py-16">
        {/* Success card */}
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center backdrop-blur">
          <div className="mb-4 text-6xl">🎉</div>
          <h2 className="mb-1 text-2xl font-bold text-white">Poliçe Kesildi!</h2>
          <p className="mb-6 text-sm text-white/60">Ödeme başarıyla tamamlandı ve poliçe oluşturuldu.</p>

          {/* Policy number — big */}
          <div className="mb-6 rounded-xl bg-black/30 px-6 py-4">
            <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Poliçe Numarası</p>
            <p className="text-3xl font-mono font-bold text-green-400 tracking-wider">
              {policyResult.policyNo}
            </p>
          </div>

          {/* Details grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-0.5">Şirket</p>
              <p className="font-medium text-white">{context.result.company_name}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-0.5">Prim</p>
              <p className="font-medium text-white">{formatPrice(context.result.price)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-0.5">Müşteri</p>
              <p className="font-medium text-white">{context.run.customer_name ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-0.5">Sigorta Türü</p>
              <p className="font-medium text-white">{productTypeLabel(context.run.product_type)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 col-span-2">
              <p className="text-xs text-white/40 mb-0.5">İşlem ID</p>
              <p className="font-mono text-xs text-white/70">{policyResult.transactionId}</p>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Link href="/policies"
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
              Poliçelere Git →
            </Link>
            <Link href={`/quote-center/${context.run.id}`}
              className="rounded-xl bg-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors">
              Teklif Çalışmasına Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-sm font-medium text-white/70 animate-pulse">{processingMsg}</p>
        <p className="text-xs text-white/30">Lütfen sayfayı kapatmayın.</p>
      </div>
    );
  }

  // ── FORM step ──────────────────────────────────────────────────────────────
  if (!context) return null;

  const { result, run } = context;

  // Product data helpers
  const pd = run.product_data ?? {};
  const vehicleInfo = [pd.plaka, pd.marka, pd.model, pd.yil].filter(Boolean).join(" • ");
  const vehicleDisplay = vehicleInfo || null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8 px-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="rounded-xl bg-white/8 p-2 text-white/60 hover:bg-white/15 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Poliçeleştir</h1>
          <p className="text-xs text-white/40">Teklifi onayla ve ödemeyi tamamla</p>
        </div>
      </div>

      {/* ── Quote summary card ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        {/* Header stripe */}
        <div className="bg-gradient-to-r from-violet-600/30 to-indigo-600/20 px-5 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              Teklif Özeti
            </span>
            {result.expires_at && (
              <span className="text-xs text-white/40">
                Son geçerlilik: {new Date(result.expires_at).toLocaleDateString("tr-TR")}
              </span>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Sigorta Şirketi</p>
            <p className="font-semibold text-white text-base">{result.company_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 mb-0.5">Prim Tutarı</p>
            <p className="font-bold text-white text-2xl">{formatPrice(result.price)}</p>
            {result.installment && result.installment !== "Peşin" && (
              <p className="text-xs text-white/40">{result.installment}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-white/40 mb-0.5">Sigorta Türü</p>
            <p className="font-medium text-white">{productTypeLabel(run.product_type)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 mb-0.5">Kaynak</p>
            <p className="text-white/70 capitalize">{result.source_type ?? "demo"}</p>
          </div>
        </div>
      </div>

      {/* ── Customer / Vehicle info ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
          Sigortalı Bilgileri
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Ad Soyad</p>
            <p className="font-medium text-white">{run.customer_name ?? "—"}</p>
          </div>
          {run.customer_tc && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">T.C. Kimlik No</p>
              <p className="font-medium text-white">{run.customer_tc}</p>
            </div>
          )}
          {run.customer_phone && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">Telefon</p>
              <p className="font-medium text-white">{run.customer_phone}</p>
            </div>
          )}
          {run.customer_email && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">E-posta</p>
              <p className="font-medium text-white">{run.customer_email}</p>
            </div>
          )}
          {vehicleDisplay && (
            <div className="col-span-2">
              <p className="text-xs text-white/40 mb-0.5">Araç</p>
              <p className="font-medium text-white">{vehicleDisplay}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mock payment form ── */}
      <form onSubmit={handlePay}
        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">

        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/10 px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-blue-400">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Ödeme Bilgileri
            </span>
            <span className="ml-auto text-xs text-white/30 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <rect width="11" height="11" x="3" y="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Güvenli ödeme (demo)
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Security notice */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-200/80 flex items-start gap-2">
            <span className="mt-0.5">🔒</span>
            <span>
              Kart bilgileriniz şifrelenmiş bir demo formdur ve <strong>sunucuya iletilmez</strong>.
              Gerçek sistemde kart verisi yalnızca ödeme sağlayıcısına (İyzico/PayTR) iletilir.
            </span>
          </div>

          {/* Card holder */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Kart Üzerindeki İsim</label>
            <input
              type="text"
              autoComplete="cc-name"
              placeholder="AD SOYAD"
              className="w-full rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/25
                         focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all uppercase"
              value={card.holder}
              onChange={(e) => setCard(c => ({ ...c, holder: e.target.value.toUpperCase() }))}
              required
            />
          </div>

          {/* Card number */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Kart Numarası</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/25
                         font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
              value={card.cardNo}
              onChange={(e) => setCard(c => ({ ...c, cardNo: formatCardNo(e.target.value) }))}
              required
            />
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Son Kullanma Tarihi</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="AA/YY"
                maxLength={5}
                className="w-full rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/25
                           font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                value={card.expiry}
                onChange={(e) => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">CVV</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="• • •"
                maxLength={4}
                className="w-full rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/25
                           font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                value={card.cvv}
                onChange={(e) => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                required
              />
            </div>
          </div>

          {payError && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-2.5 text-sm text-red-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{payError}</span>
            </div>
          )}

          {/* Pay button */}
          <button
            type="submit"
            disabled={!cardIsValid(card)}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white
                       shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
            <span className="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <line x1="2" x2="22" y1="10" y2="10"/>
              </svg>
              Ödemeyi Tamamla — {formatPrice(result.price)}
            </span>
          </button>
        </div>
      </form>

      {/* Legal note */}
      <p className="text-center text-xs text-white/20 px-4">
        Bu işlem demo ortamında gerçekleştirilmektedir. Gerçek bir ödeme alınmamaktadır.
      </p>
    </div>
  );
}
