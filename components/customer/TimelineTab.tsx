"use client";

import { History } from "lucide-react";
import type { CustomerTimelineEvent } from "./types";
import { fmtDateTime } from "./types";

const EVENT_STYLE: Record<string, { icon: string; dot: string }> = {
  customer_created:     { icon: "👤", dot: "bg-blue-500" },
  quote_run:            { icon: "⚡", dot: "bg-violet-500" },
  policy_issued:        { icon: "🛡️", dot: "bg-emerald-500" },
  policy_created:       { icon: "📄", dot: "bg-indigo-500" },
  renewal_completed:    { icon: "🔄", dot: "bg-teal-500" },
  whatsapp:             { icon: "💬", dot: "bg-green-500" },
  renewal_notification: { icon: "🔔", dot: "bg-amber-500" },
};

export default function TimelineTab({ timeline }: { timeline: CustomerTimelineEvent[] }) {
  if (timeline.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <History className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Henüz işlem geçmişi yok</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="relative pl-1">
        {/* Dikey çizgi */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />

        <div className="space-y-1">
          {timeline.map((e, i) => {
            const style = EVENT_STYLE[e.type] ?? { icon: "•", dot: "bg-slate-400" };
            return (
              <div key={`${e.type}-${e.ref_id}-${i}`} className="relative flex gap-3.5 py-2.5">
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-[30px] h-[30px] rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-sm shadow-sm">
                    {style.icon}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${style.dot}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{e.title}</p>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(e.date)}</p>
                  </div>
                  {e.description && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
