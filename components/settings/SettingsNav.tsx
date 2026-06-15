"use client";

/**
 * Ayarlar Merkezi sol navigasyonu — kategorilere gruplu.
 * Yetkisi olmayan bölümler gizlenir. Mobilde yatay scroller'a düşer.
 */

import type { PermissionKey } from "@/lib/permissions";
import { SETTINGS_GROUPS, type SectionKey } from "./sections";

export default function SettingsNav({
  active, onSelect, can,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  can: (perm: PermissionKey) => boolean;
}) {
  const groups = SETTINGS_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || can(it.perm)) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav
      className="lg:w-60 flex-shrink-0 lg:sticky lg:top-4 lg:self-start
                 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible
                 pb-2 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0"
    >
      {groups.map((g) => (
        <div key={g.group} className="flex lg:flex-col gap-1 lg:gap-0.5 lg:mb-3 flex-shrink-0">
          <p className="hidden lg:block px-3 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {g.group}
          </p>
          {g.items.map((it) => {
            const isActive = active === it.key;
            return (
              <button
                key={it.key}
                onClick={() => onSelect(it.key)}
                className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-all
                  ${isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                    : "text-slate-600 hover:bg-slate-100"}`}
              >
                <it.Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span>{it.label}</span>
                {it.soon && (
                  <span className={`ml-auto hidden lg:inline text-[9px] font-bold px-1.5 py-0.5 rounded-full
                    ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                    Yakında
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
