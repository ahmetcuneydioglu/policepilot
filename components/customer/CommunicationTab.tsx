"use client";

/**
 * İletişim Geçmişi — müşteriyle kurulan tüm temaslar zaman sırasıyla.
 * Kaynak: timeline'ın iletişim nitelikli olayları (WhatsApp, teklif).
 * İleride telefon görüşmesi ve e-posta kayıtları aynı akışa eklenecek.
 */

import { MessageCircle } from "lucide-react";
import type { CustomerTimelineEvent } from "./types";
import { fmtDateTime } from "./types";

const COMM_TYPES = new Set(["whatsapp", "quote_run"]);

const STYLE: Record<string, { icon: string; dot: string; channel: string }> = {
  whatsapp:  { icon: "💬", dot: "bg-emerald-500", channel: "WhatsApp" },
  quote_run: { icon: "⚡", dot: "bg-violet-500",  channel: "Teklif" },
};

export default function CommunicationTab({ timeline }: { timeline: CustomerTimelineEvent[] }) {
  const events = timeline.filter(e => COMM_TYPES.has(e.type));

  if (events.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Henüz iletişim kaydı yok</p>
        <p className="text-xs text-slate-300 mt-1">WhatsApp gönderimleri ve teklif paylaşımları burada listelenir</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="relative pl-1">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />
        <div className="space-y-1">
          {events.map((e, i) => {
            const s = STYLE[e.type] ?? { icon: "•", dot: "bg-slate-400", channel: "Diğer" };
            return (
              <div key={`${e.type}-${e.ref_id}-${i}`} className="relative flex gap-3.5 py-2.5">
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-[30px] h-[30px] rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-sm shadow-sm">
                    {s.icon}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${s.dot}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">
                      {e.title}
                      <span className="ml-2 px-1.5 py-px rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold align-middle">
                        {s.channel}
                      </span>
                    </p>
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
