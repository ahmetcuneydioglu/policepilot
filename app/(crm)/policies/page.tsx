"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Policy } from "@/lib/database.types";
import WhatsAppModal from "@/components/WhatsAppModal";

type PolicyWithCustomer = Policy & { customers: { name: string; phone: string } | null };

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 864e5));
}

function DaysLeftBadge({ days }: { days: number }) {
  const cfg =
    days <= 5
      ? { cls: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" }
      : days <= 15
      ? { cls: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" }
      : { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {days} gün
    </span>
  );
}

function ProgressBar({ days }: { days: number }) {
  const pct = Math.min((days / 90) * 100, 100);
  const color = days <= 5 ? "bg-red-500" : days <= 15 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-fade-in-up"
      onAnimationEnd={() => setTimeout(onDone, 2500)}
    >
      <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white text-xs">✓</span>
      {message}
    </div>
  );
}

const WA_SVG = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [waPolicy, setWaPolicy] = useState<PolicyWithCustomer | null>(null);
  const [toast, setToast] = useState("");

  const { role, agencyId } = useAuth();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("policies") as any)
      .select("*, customers(name, phone)")
      .order("end_date", { ascending: true });
    if (role === "agency_user" && agencyId) {
      q = q.eq("agency_id", agencyId);
    }
    q.then(({ data }: { data: PolicyWithCustomer[] | null }) => {
      setPolicies(data ?? []);
      setLoading(false);
    });
  }, [role, agencyId]);

  const critical = policies.filter((p) => daysLeft(p.end_date) <= 5 && p.status === "Aktif");
  const warning = policies.filter((p) => {
    const d = daysLeft(p.end_date);
    return d > 5 && d <= 15 && p.status === "Aktif";
  });

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900">Poliçe Takibi</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          {loading ? "Yükleniyor..." : `${policies.length} poliçe`}
        </p>
      </div>

      {!loading && (critical.length > 0 || warning.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up stagger-1">
          {critical.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
              <p className="text-sm text-red-700 font-medium">
                <span className="font-bold">{critical.length} poliçe</span> kritik — 5 gün veya daha az kaldı
              </p>
            </div>
          )}
          {warning.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                <span className="font-bold">{warning.length} poliçe</span> yaklaşıyor — 15 gün içinde bitiyor
              </p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
          </div>
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Henüz poliçe yok</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Müşteri</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poliçe Türü</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlangıç</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bitiş</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kalan</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hatırlatma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {policies.map((p, i) => {
                  const days = daysLeft(p.end_date);
                  const isCritical = days <= 5 && p.status === "Aktif";
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-blue-50/30 transition-colors group animate-fade-in-up ${isCritical ? "bg-red-50/30" : ""}`}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {isCritical && <span className="w-1.5 h-8 rounded-full bg-red-500 flex-shrink-0" />}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 group-hover:scale-105 transition-transform ${isCritical ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                            {(p.customers?.name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="font-semibold text-slate-800">{p.customers?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{p.policy_type}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{p.start_date}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{p.end_date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DaysLeftBadge days={days} />
                          <ProgressBar days={days} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setWaPolicy(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-all border border-emerald-100"
                        >
                          {WA_SVG}
                          Hatırlat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {waPolicy && (
        <WhatsAppModal
          customerName={waPolicy.customers?.name ?? "Müşteri"}
          phone={waPolicy.customers?.phone ?? ""}
          insuranceType={waPolicy.policy_type}
          onClose={() => setWaPolicy(null)}
          onSent={() => setToast("WhatsApp mesajı hazırlandı")}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
