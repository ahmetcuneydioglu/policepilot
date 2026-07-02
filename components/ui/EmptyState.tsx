"use client";

/**
 * EmptyState — boş durum standardı (design system çekirdeği).
 * Kural: her boş liste tek ikon + kısa başlık + yönlendirme + EN FAZLA bir CTA.
 */

import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  Icon, title, desc, actionLabel, onAction,
}: {
  Icon: LucideIcon;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {desc && <p className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
