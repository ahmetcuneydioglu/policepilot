"use client";

/**
 * Ekip / Kullanıcı Yönetimi — tam sayfa, iki sekme:
 *  • Ekip Yönetimi → TeamManagement (Ayarlar'a da gömülü)
 *  • Performans    → PerformancePanel (yalnız owner/manager; kişi-bazlı performans)
 */

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { isManagerial } from "@/lib/tenant";
import TeamManagement from "@/components/TeamManagement";
import PerformancePanel from "@/components/team/PerformancePanel";

export default function TeamPage() {
  const { profile } = useAuth();
  const canPerf = isManagerial(profile?.agency_role);
  const [tab, setTab] = useState<"ekip" | "performans">("ekip");

  return (
    <div className="max-w-5xl space-y-5">
      {canPerf && (
        <div className="flex gap-1 border-b border-slate-200">
          {([
            { k: "ekip", l: "Ekip Yönetimi" },
            { k: "performans", l: "Performans" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.k ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      )}

      {canPerf && tab === "performans" ? <PerformancePanel /> : <TeamManagement />}
    </div>
  );
}
