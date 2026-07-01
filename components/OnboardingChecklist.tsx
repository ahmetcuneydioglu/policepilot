"use client";

/**
 * Kurulum Checklist'i — yeni acenteler için aktivasyon kartı (monday'den ilham).
 * Gerçek verilerle (/api/onboarding) ilerleme; %100'de otomatik gizlenir,
 * kapatılabilir (localStorage). Yalnız owner/manager görür.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, Check, X, ArrowRight, UserPlus, ShieldCheck, MessageSquare, Target, Users } from "lucide-react";

const DISMISS_KEY = "sigortaos_onboarding_dismissed";

type Status = {
  show: boolean;
  customer?: boolean; policy?: boolean; opportunity?: boolean; team?: boolean; whatsapp?: boolean;
};

export default function OnboardingChecklist() {
  const [st, setSt] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(true); // flash önlemek için başta gizli

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1");
    fetch("/api/onboarding").then((r) => r.json()).then((j) => setSt(j)).catch(() => {});
  }, []);

  if (dismissed || !st || !st.show) return null;

  const steps = [
    { key: "account",     Icon: Rocket,        label: "Hesabını oluştur",         desc: "SigortaOS'a hoş geldin!",              done: true,               href: null,                 cta: null },
    { key: "customer",    Icon: UserPlus,      label: "İlk müşterini ekle",       desc: "Portföyünü dijitale taşı.",            done: !!st.customer,      href: "/customers",         cta: "Müşteriler" },
    { key: "policy",      Icon: ShieldCheck,   label: "İlk poliçeni işle",        desc: "Poliçe takibini başlat.",              done: !!st.policy,        href: "/policies",          cta: "Poliçeler" },
    { key: "whatsapp",    Icon: MessageSquare, label: "WhatsApp'ı bağla",         desc: "Otomatik hatırlatmaların anahtarı.",   done: !!st.whatsapp,      href: "/settings?s=whatsapp", cta: "WhatsApp" },
    { key: "opportunity", Icon: Target,        label: "İlk satış fırsatını aç",   desc: "Satış hattını (kanban) kur.",          done: !!st.opportunity,   href: "/firsatlar",         cta: "Fırsatlar" },
    { key: "team",        Icon: Users,         label: "Ekibini davet et",         desc: "Personelini sisteme ekle.",            done: !!st.team,          href: "/team",              cta: "Ekip" },
  ];

  const doneN = steps.filter((s) => s.done).length;
  const pct = Math.round((doneN / steps.length) * 100);
  if (pct === 100) return null; // tamamlandı → kartı kaldır

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); };

  return (
    <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm p-5">
      {/* Başlık + ilerleme */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">SigortaOS kurulumunu tamamla</h2>
            <p className="text-xs text-slate-500">Acenteni tam verimle çalıştırmak için birkaç adım kaldı.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold text-indigo-700">{doneN}/{steps.length}</span>
          <button onClick={dismiss} className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100" aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* İlerleme çubuğu */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Adımlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {steps.map((s) => {
          const inner = (
            <>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.done ? "bg-emerald-100 text-emerald-600" : "bg-white border border-slate-200 text-slate-400"}`}>
                {s.done ? <Check className="w-4 h-4" /> : <s.Icon className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${s.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{s.label}</p>
                <p className="text-[11px] text-slate-400 truncate">{s.desc}</p>
              </div>
              {!s.done && s.href && <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
            </>
          );
          const cls = `flex items-center gap-2.5 rounded-xl p-2.5 transition-all ${s.done ? "bg-slate-50/60" : "bg-white border border-slate-200/70 hover:border-indigo-300 hover:shadow-sm"}`;
          return s.done || !s.href
            ? <div key={s.key} className={cls}>{inner}</div>
            : <Link key={s.key} href={s.href} className={cls}>{inner}</Link>;
        })}
      </div>
    </div>
  );
}
