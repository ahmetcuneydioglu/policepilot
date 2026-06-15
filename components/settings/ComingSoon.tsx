"use client";

/**
 * Premium "Yakında" boş-durum — altyapısı henüz olmayan bölümler için.
 * Sahte form/input yok; net mesaj + zarif görsel.
 */

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, Icon, description }: {
  title: string; Icon: LucideIcon; description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="relative px-8 py-16 text-center">
        {/* yumuşak arka plan dokusu */}
        <div className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold mb-3">
            <Sparkles className="w-3 h-3" /> Yakında
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">{title}</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
