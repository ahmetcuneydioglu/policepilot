"use client";

/**
 * Abonelik — Paketim & Kullanım Limitleri (Stripe benzeri).
 * Plan kartı (planPricing) + 4 limit progress bar (UsageLimits).
 * focus="plan" → plan vurgulu; focus="usage" → kullanım vurgulu (aynı veri).
 */

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Check, Plus } from "lucide-react";
import UsageLimits from "@/components/UsageLimits";
import { PLAN_LABELS, PLAN_PRICING } from "@/lib/planPricing";
import { useAuth } from "@/lib/AuthContext";
import AddonModal from "@/components/settings/AddonModal";

const PLAN_PERKS: Record<string, string[]> = {
  starter:    ["Temel CRM", "Sınırlı kullanıcı", "WhatsApp özet"],
  pro:        ["Sınırsız müşteri akışı", "AI Asistan", "WhatsApp otomasyon", "Öncelikli destek"],
  enterprise: ["Tüm Pro özellikleri", "Özel entegrasyonlar", "Adanmış destek", "SLA garantisi"],
};

export default function SubscriptionSection({ focus = "plan" }: { focus?: "plan" | "usage" }) {
  const { can } = useAuth();
  const canManageBilling = can("billing.manage");

  const [plan, setPlan] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [nextPayment, setNextPayment] = useState<string | null>(null);
  const [addonOpen, setAddonOpen] = useState(false);
  // Artırınca hem /api/usage'ı hem UsageLimits'i (remount ile) yeniden tetikler.
  const [refreshKey, setRefreshKey] = useState(0);

  const loadUsage = useCallback(() => {
    fetch("/api/usage").then((r) => r.json()).then((j) => {
      if (j?.agency) { setPlan(j.agency.plan); setActive(j.agency.is_active); setNextPayment(j.agency.next_payment ?? null); }
    }).catch(() => {});
  }, []);

  useEffect(() => { loadUsage(); }, [loadUsage, refreshKey]);

  const planKey = plan ?? "starter";
  const price = PLAN_PRICING[planKey] ?? 0;
  const perks = PLAN_PERKS[planKey] ?? PLAN_PERKS.starter;
  const nextDate = nextPayment ? new Date(nextPayment).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) : null;

  return (
    <div className="space-y-5">
      {focus === "plan" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <CreditCard className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mevcut Paket</p>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">{PLAN_LABELS[planKey] ?? "Starter"}</h3>
                </div>
                <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                  {active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                <span className="text-2xl font-extrabold text-slate-900">{price === 0 ? "Ücretsiz" : `${price.toLocaleString("tr-TR")} ₺`}</span>
                {price > 0 && <span className="text-slate-400"> / ay</span>}
              </p>
              {nextDate && (
                <p className="text-[11px] text-slate-400 mt-1">Sonraki ödeme/yenileme: <span className="font-semibold text-slate-600">{nextDate}</span></p>
              )}
              <ul className="mt-3 space-y-1.5">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <button disabled className="px-4 py-2 rounded-xl border border-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed bg-slate-50">
                Paketi Yükselt
              </button>
              {canManageBilling && (
                <button
                  onClick={() => setAddonOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-500/25 hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" /> Ek Lisans Al
                </button>
              )}
              <p className="text-[10px] text-slate-300 max-w-[140px]">Plan değişimi için platform yöneticinizle görüşün</p>
            </div>
          </div>
        </div>
      )}

      {/* Kullanım barları (her iki odakta da gösterilir) — refreshKey ile remount edilir */}
      <UsageLimits key={refreshKey} />

      {focus === "usage" && (
        <p className="text-[11px] text-slate-400 px-1">
          Limitler paketinize göre platform tarafından belirlenir. Limit artışı için yöneticinizle görüşün.
        </p>
      )}

      {canManageBilling && (
        <AddonModal
          open={addonOpen}
          onClose={() => setAddonOpen(false)}
          onPurchased={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
