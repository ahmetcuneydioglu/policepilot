"use client";

/**
 * Giriş Geçmişi / Aktivite — acentenin son etkinlikleri (activity_log).
 * GET /api/activity. Kim / ne / ne zaman.
 */

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { timeAgo } from "@/components/admin/ui";

type Item = { id: string; actor_name: string | null; action: string; entity_type: string; summary: string | null; created_at: string };

const EMOJI: Record<string, string> = {
  customer: "👤", quote_run: "⚡", policy: "🛡️", document: "📎", whatsapp: "💬", user: "🔑",
};

export default function LoginHistory() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity").then((r) => r.json()).then((j) => {
      if (Array.isArray(j.items)) setItems(j.items);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" />
        <div>
          <p className="text-sm font-bold text-slate-800">Son Etkinlikler</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ekibinizin sistemdeki son işlemleri</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Henüz kayıtlı etkinlik yok.</p>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
              <span className="text-base flex-shrink-0 mt-0.5">{EMOJI[it.entity_type] ?? "•"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 leading-snug">
                  {it.actor_name && <span className="font-semibold text-slate-800">{it.actor_name} · </span>}
                  {it.summary ?? `${it.entity_type} ${it.action}`}
                </p>
              </div>
              <span className="text-[10px] text-slate-300 flex-shrink-0 whitespace-nowrap mt-0.5">{timeAgo(it.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
