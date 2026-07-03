"use client";

/**
 * Kurulum Checklist'i — kompakt aktivasyon şeridi (Monday'in "Profilinizi
 * Tamamlayın" kartından ilham; tam genişlik yer kaplamaz).
 *
 * Kapalıyken: tek ince satır (ikon + başlık + ilerleme çubuğu + 3/6 + oklar).
 * Tıklayınca: kalan adımlar kompakt satırlar halinde açılır.
 * %100'de otomatik gizlenir; X ile kalıcı kapatılır. Açık/kapalı tercihi hatırlanır.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, Check, X, ChevronDown, ArrowRight, UserPlus, ShieldCheck, MessageSquare, Target, Users } from "lucide-react";

const DISMISS_KEY = "sigortaos_onboarding_dismissed";
const EXPAND_KEY = "sigortaos_onboarding_expanded";

type Status = {
  show: boolean;
  customer?: boolean; policy?: boolean; opportunity?: boolean; team?: boolean; whatsapp?: boolean;
};

export default function OnboardingChecklist() {
  const [st, setSt] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(true); // flash önlemek için başta gizli
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1");
    setExpanded(typeof window !== "undefined" && localStorage.getItem(EXPAND_KEY) === "1");
    fetch("/api/onboarding").then((r) => r.json()).then((j) => setSt(j)).catch(() => {});
  }, []);

  if (dismissed || !st || !st.show) return null;

  const steps = [
    { key: "account",     Icon: Rocket,        label: "Hesabını oluştur",       done: true,             href: null as string | null },
    { key: "customer",    Icon: UserPlus,      label: "İlk müşterini ekle",     done: !!st.customer,    href: "/customers?new=1" },
    { key: "policy",      Icon: ShieldCheck,   label: "İlk poliçeni işle",      done: !!st.policy,      href: "/policies?new=1" },
    { key: "whatsapp",    Icon: MessageSquare, label: "WhatsApp'ı bağla",       done: !!st.whatsapp,    href: "/settings?s=whatsapp" },
    { key: "opportunity", Icon: Target,        label: "İlk satış fırsatını aç", done: !!st.opportunity, href: "/firsatlar?new=1" },
    { key: "team",        Icon: Users,         label: "Ekibini davet et",       done: !!st.team,        href: "/team" },
  ];

  const doneN = steps.filter((s) => s.done).length;
  const pct = Math.round((doneN / steps.length) * 100);
  if (pct === 100) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); };
  const toggle = () => setExpanded((p) => { localStorage.setItem(EXPAND_KEY, String(!p)); return !p; });
  const remaining = steps.filter((s) => !s.done);

  return (
    <div className="rounded-2xl border border-indigo-200/60 bg-white shadow-sm overflow-hidden">
      {/* İnce şerit */}
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 h-12 hover:bg-indigo-50/40 transition-colors">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/30">
          <Rocket className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-semibold text-slate-800 flex-shrink-0">Kurulumu tamamla</span>
        <div className="hidden sm:block flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold text-indigo-600 tabular-nums flex-shrink-0">{doneN}/{steps.length}</span>
        <span className="flex-1 sm:hidden" />
        <span className="hidden sm:block flex-1" />
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
        <span role="button" tabIndex={0} aria-label="Kapat"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); dismiss(); } }}
          className="p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Açılır adımlar — yalnız kalanlar, kompakt satırlar */}
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 bg-slate-50/40">
          {remaining.map((s) => (
            s.href ? (
              <Link key={s.key} href={s.href}
                className="flex items-center gap-2.5 px-2.5 h-9 rounded-lg bg-white border border-slate-200/70 hover:border-indigo-300 hover:shadow-sm transition-all group">
                <s.Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
                <span className="text-xs font-medium text-slate-700 truncate flex-1">{s.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
              </Link>
            ) : null
          ))}
          {steps.filter((s) => s.done).map((s) => (
            <div key={s.key} className="flex items-center gap-2.5 px-2.5 h-9 rounded-lg opacity-60">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-400 line-through truncate">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
