"use client";

/**
 * Ek Satın Alım Merkezi — eklenti (add-on) lisansı satın alma modali.
 *
 * Açılınca GET /api/billing/catalog + GET /api/billing/summary çeker; steppers'i
 * summary.addon_quantities'ten başlatır. SOL'da eklenti kartları (stepper), SAĞ'da
 * (sticky) quotePrice ile CANLI sipariş özeti. ALT'ta "Satın Al" → /api/billing/checkout.
 *
 * Manuel akış: gerçek tahsilat YOK. Başarıda json.message gösterilir ("ödendi" denmez).
 * Yetki kontrolü çağıranındır (yalnız billing.manage olan kullanıcı açar).
 */

import { useEffect, useMemo, useState } from "react";
import { X, ShoppingCart, Plus, Minus, Loader2, CheckCircle2 } from "lucide-react";
import { quotePrice, type PriceQuote } from "@/lib/billing/pricing";
import { fmtMoney } from "@/components/admin/ui";

// ─── API tipleri (sözleşme) ─────────────────────────────────────────────────────

type AddonRow = {
  key: string;
  label: string;
  unit_label: string;
  unit_price: number;
  grants_metric: string;
  grant_per_unit: number;
  is_entitlement: boolean;
  is_active: boolean;
  sort_order: number;
};

type Catalog = { plans: unknown[]; addons: AddonRow[] };

type Summary = {
  plan: string;
  label: string;
  monthly_price: number;
  addon_quantities: Record<string, number>;
} | null;

// ─── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  onPurchased?: () => void;
};

export default function AddonModal({ open, onClose, onPurchased }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [planLabel, setPlanLabel] = useState("Starter");
  const [planPrice, setPlanPrice] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [initialQty, setInitialQty] = useState<Record<string, number>>({});
  const [serverQuote, setServerQuote] = useState<PriceQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Açılışta katalog + özet çek; steppers'i mevcut adetlerden başlat.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setDone(null);
    (async () => {
      try {
        const [catRes, sumRes] = await Promise.all([
          fetch("/api/billing/catalog"),
          fetch("/api/billing/summary"),
        ]);
        if (!catRes.ok) throw new Error("Katalog yüklenemedi");
        const cat: Catalog = await catRes.json();
        const sumJson: { agency: Summary } = sumRes.ok ? await sumRes.json() : { agency: null };
        if (cancelled) return;

        const active = (cat.addons ?? [])
          .filter((a) => a.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
        setAddons(active);

        const agency = sumJson?.agency ?? null;
        if (agency) {
          setPlanLabel(agency.label ?? "Starter");
          setPlanPrice(agency.monthly_price ?? 0);
        }
        const start: Record<string, number> = {};
        for (const a of active) {
          start[a.key] = Math.max(0, agency?.addon_quantities?.[a.key] ?? 0);
        }
        setQty(start);
        setInitialQty(start); // "değişiklik var mı" karşılaştırması için başlangıç adetleri
        setServerQuote(null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Bir hata oluştu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const setOne = (key: string, next: number) =>
    setQty((q) => ({ ...q, [key]: Math.max(0, next) }));

  // Canlı fiyat — her keystroke'ta /quote'a gitmeden saf fonksiyonla hesapla.
  const quote: PriceQuote = useMemo(
    () =>
      quotePrice({
        planLabel,
        planPrice,
        addons: addons.map((a) => ({
          key: a.key,
          label: a.label,
          quantity: qty[a.key] ?? 0,
          unitPrice: a.unit_price,
        })),
      }),
    [planLabel, planPrice, addons, qty]
  );

  // "Değişiklik var mı?" — buton/checkout bunu temel alır (3→0 iptal de değişikliktir).
  const dirty = useMemo(
    () => addons.some((a) => (qty[a.key] ?? 0) !== (initialQty[a.key] ?? 0)),
    [addons, qty, initialQty]
  );

  // Kıst (proration) OTORİTESİ sunucudadır (expires_at'i bilir). Stepper değişince
  // debounce'lu /api/billing/quote çekilir; istemci quotePrice yalnız anlık placeholder.
  // Böylece ekrandaki "Şimdi Ödenecek" = sunucunun checkout'ta tahsil edeceği tutar.
  useEffect(() => {
    if (!open || loading) return;
    if (!dirty) { setServerQuote(null); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const body = { addons: Object.fromEntries(addons.map((a) => [a.key, qty[a.key] ?? 0])) };
        const res = await fetch("/api/billing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!cancelled && res.ok && json?.quote) setServerQuote(json.quote as PriceQuote);
      } catch {
        /* sessizce placeholder'da kal */
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, loading, dirty, addons, qty]);

  // Görüntülenecek kıst: yalnız sunucu otoritesinden (istemci hesaplayamaz).
  const proration = serverQuote?.proration;

  async function handleCheckout() {
    setSubmitting(true);
    setErr(null);
    try {
      const body = {
        addons: Object.fromEntries(addons.map((a) => [a.key, qty[a.key] ?? 0])),
      };
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "İşlem tamamlanamadı");
      setDone(json.message || "Talebiniz alındı, faturanız oluşturuldu (tahsilat bekliyor).");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
    if (done) onPurchased?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Arkaplan */}
      <button
        aria-label="Kapat"
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col">
        {/* Başlık */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <ShoppingCart className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Ek Lisans Al</h2>
              <p className="text-[11px] text-slate-400">Paketinize ek kapasite ekleyin</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            aria-label="Kapat"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* İçerik */}
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Talebiniz Alındı</h3>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{done}</p>
            <button
              onClick={handleClose}
              className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-md shadow-indigo-500/25 hover:opacity-95 transition-opacity"
            >
              Kapat
            </button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid md:grid-cols-[1fr_300px]">
              {/* SOL — eklenti kartları */}
              <div className="p-5 space-y-3">
                {err && (
                  <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
                    ⚠️ {err}
                  </div>
                )}
                {addons.length === 0 && !err && (
                  <p className="text-sm text-slate-400 py-8 text-center">Şu an eklenebilecek bir lisans yok.</p>
                )}
                {addons.map((a) => {
                  const n = qty[a.key] ?? 0;
                  return (
                    <div
                      key={a.key}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{a.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{a.unit_label}</p>
                        <p className="text-xs font-semibold text-indigo-600 mt-1">
                          {fmtMoney(a.unit_price)} <span className="text-slate-400 font-normal">/ adet</span>
                        </p>
                      </div>
                      {/* Stepper */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setOne(a.key, n - 1)}
                          disabled={n <= 0}
                          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Azalt"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm font-bold text-slate-900 tabular-nums">{n}</span>
                        <button
                          onClick={() => setOne(a.key, n + 1)}
                          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors"
                          aria-label="Artır"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SAĞ — sticky sipariş özeti */}
              <div className="border-t md:border-t-0 md:border-l border-slate-100 bg-slate-50/50">
                <div className="md:sticky md:top-0 p-5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sipariş Özeti</p>

                  <div className="space-y-2">
                    {quote.lineItems.map((li) => (
                      <div key={li.key} className="flex items-start justify-between gap-3 text-xs">
                        <span className="text-slate-600">
                          {li.label}
                          {li.quantity > 1 && <span className="text-slate-400"> × {li.quantity}</span>}
                        </span>
                        <span className="font-semibold text-slate-700 tabular-nums whitespace-nowrap">{fmtMoney(li.total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="my-3 border-t border-dashed border-slate-200" />

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Ek Modüller</span>
                      <span className="tabular-nums">{fmtMoney(quote.addonsTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Aylık Toplam</span>
                      <span className="tabular-nums">{fmtMoney(quote.monthlyTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>KDV (%20)</span>
                      <span className="tabular-nums">{fmtMoney(quote.vat)}</span>
                    </div>
                  </div>

                  <div className="my-3 border-t border-slate-200" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Tahmini Sonraki Fatura</span>
                    <span className="text-lg font-extrabold text-slate-900 tabular-nums">{fmtMoney(quote.nextInvoiceEstimate)}</span>
                  </div>

                  {proration && proration.immediateCharge > 0 && (
                    <div className="mt-3 px-3 py-2.5 rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700">Şimdi Ödenecek</span>
                        <span className="text-sm font-extrabold text-indigo-700 tabular-nums">
                          {fmtMoney(proration.immediateCharge)}
                        </span>
                      </div>
                      <p className="text-[10px] text-indigo-400 mt-0.5">
                        Kalan {proration.remainingDays} gün için kıst tutar
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    Tahsilat manuel yapılır; onayınızdan sonra faturanız oluşturulur.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alt — satın al */}
        {!done && !loading && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 flex-shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleCheckout}
              disabled={submitting || !dirty}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Gönderiliyor…" : "Değişiklikleri Uygula"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
