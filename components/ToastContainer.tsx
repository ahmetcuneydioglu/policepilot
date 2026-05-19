"use client";

import { useNotifications } from "@/lib/NotificationContext";

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            opacity: t.removing ? 0 : 1,
            transform: t.removing ? "translateX(16px)" : "translateX(0)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
          className="pointer-events-auto w-72 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-start gap-3 px-4 py-3.5">
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 leading-snug">{t.message}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t.sub}</p>
            </div>
            {/* Dismiss */}
            <button
              onClick={() => dismissToast(t.id)}
              className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors -mt-0.5"
              aria-label="Kapat"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Progress bar */}
          <div
            className="h-0.5 bg-blue-500"
            style={{
              animation: "shrink 5.5s linear forwards",
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
