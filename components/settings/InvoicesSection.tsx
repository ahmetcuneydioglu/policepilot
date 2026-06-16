"use client";

/**
 * Faturalar — Ayarlar > Abonelik > Faturalar.
 * GET /api/billing/invoices → abonelik/fatura olayları (billing_events).
 * Her olay: tarih · açıklama (type'tan türetilmiş TR) · tutar · durum rozeti.
 * Manuel tahsilat modeli; "Tahsilat bekliyor / Ödendi / Kayıt" durumları.
 */

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { fmtMoney, fmtDateTime, SectionCard } from "@/components/admin/ui";

type Invoice = {
  id: string;
  type: string;
  amount: number | null;
  status: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Olay tipini TR açıklamaya çevirir. */
function describeType(type: string): string {
  switch (type) {
    case "addon_change":   return "Ek modül";
    case "plan_change":    return "Plan değişikliği";
    case "checkout":       return "Satın alma";
    case "status_change":  return "Durum";
    default:               return "İşlem";
  }
}

/** Durum kodunu rozet etiketi + renk sınıflarına çevirir. */
function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "pending_payment":
      return { label: "Tahsilat bekliyor", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    case "paid":
      return { label: "Ödendi", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "logged":
    default:
      return { label: "Kayıt", cls: "bg-slate-100 text-slate-600 ring-slate-200" };
  }
}

export default function InvoicesSection() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((j) => {
        // Yalnız gerçek faturalar gösterilir (tahsilat bekleyen/ödenen). Plan/durum/eklenti
        // değişimleri "logged" denetim izidir, fatura listesinde gürültü yapmaz.
        if (Array.isArray(j.items)) {
          setItems(j.items.filter((it: Invoice) => it.status === "pending_payment" || it.status === "paid"));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  return (
    <SectionCard title="Faturalar" subtitle="Abonelik ve ek modül işlemlerinizin dökümü">
      {items.length === 0 ? (
        <div className="px-5 py-12 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Henüz faturanız yok</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            İlk faturanız sonraki ödeme döneminde oluşur.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
          {items.map((it) => {
            const badge = statusBadge(it.status);
            return (
              <div
                key={it.id}
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {describeType(it.type)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDateTime(it.created_at)}</p>
                </div>
                <span className="text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap">
                  {fmtMoney(it.amount)}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 whitespace-nowrap ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
