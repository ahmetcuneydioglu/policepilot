"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/NotificationContext";

type Props = {
  compact?: boolean;
};

export default function NotifPermissionButton({ compact = false }: Props) {
  const { soundEnabled, setSoundEnabled } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  // Not yet hydrated
  if (permission === null) return null;

  const isFullyEnabled = soundEnabled && permission === "granted";

  async function handleEnable() {
    if (permission !== "granted" && permission !== "unsupported" && "Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
    // setSoundEnabled also initializes AudioContext (user gesture context)
    setSoundEnabled(true);
  }

  if (isFullyEnabled) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-700">Bildirimler Açık</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleEnable}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
        title="Sesli uyarı ve browser bildirimi için tıkla"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Bildirimleri Aç
      </button>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4.5 h-4.5 text-amber-600" style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-900">Bildirimleri Etkinleştir</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          Yeni teklif taleplerinde sesli uyarı ve browser bildirimi almak için tıkla.
        </p>
        <button
          onClick={handleEnable}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Etkinleştir
        </button>
      </div>
    </div>
  );
}
