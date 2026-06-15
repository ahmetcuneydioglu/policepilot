"use client";

/**
 * Roller & Yetkiler — 5 acente rolünün yetki şablonlarını gruplu ✓/✗ gösterir.
 * Salt-okunur ("checkbox cehennemi" değil). Kişi-bazlı override Kullanıcılar'da.
 */

import { Check, X, Info } from "lucide-react";
import {
  AGENCY_ROLES, PERMISSIONS, PERMISSION_GROUPS, resolvePermissions,
} from "@/lib/permissions";

export default function RolesMatrix() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
        <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Her rol, varsayılan olarak aşağıdaki yetkilerle gelir. Belirli bir kullanıcı için yetkileri
          özelleştirmek isterseniz <strong>Kullanıcılar</strong> bölümünden o kişiyi düzenleyebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {AGENCY_ROLES.map((role) => {
          const perms = resolvePermissions(role.value, null);
          const granted = PERMISSIONS.filter((p) => perms[p.key]).length;
          return (
            <div key={role.value} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{role.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{role.description}</p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  {granted}/{PERMISSIONS.length} yetki
                </span>
              </div>
              <div className="p-4 space-y-3">
                {PERMISSION_GROUPS.map((group) => {
                  const items = PERMISSIONS.filter((p) => p.group === group);
                  if (!items.length) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {items.map((p) => {
                          const ok = perms[p.key];
                          return (
                            <div key={p.key} className={`flex items-center gap-1.5 text-xs ${ok ? "text-slate-700" : "text-slate-300"}`}>
                              {ok
                                ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                              {p.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
