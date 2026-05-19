"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNotifications } from "@/lib/NotificationContext";

// ─── Insurance type → color scheme ──────────────────────────────────────────
type Scheme = { bg: string; text: string; accent: string };

function getScheme(type: string): Scheme {
  const t = type.toLowerCase();
  if (t.includes("trafik"))                                          return { bg: "bg-blue-100",    text: "text-blue-600",    accent: "bg-blue-500" };
  if (t.includes("kasko") || t.includes("imm") || t.includes("elektrik")) return { bg: "bg-indigo-100",  text: "text-indigo-600",  accent: "bg-indigo-500" };
  if (t.includes("sağlık") || t.includes("saglik") || t.includes("tamamlay")) return { bg: "bg-emerald-100", text: "text-emerald-600", accent: "bg-emerald-500" };
  if (t.includes("konut") || t.includes("dask") || t.includes("eşyam") || t.includes("esyam")) return { bg: "bg-amber-100", text: "text-amber-600", accent: "bg-amber-500" };
  if (t.includes("seyahat"))                                         return { bg: "bg-cyan-100",    text: "text-cyan-600",    accent: "bg-cyan-500" };
  if (t.includes("kaza") || t.includes("ferdi"))                    return { bg: "bg-rose-100",    text: "text-rose-600",    accent: "bg-rose-500" };
  if (t.includes("cep") || t.includes("telefon"))                   return { bg: "bg-violet-100",  text: "text-violet-600",  accent: "bg-violet-500" };
  if (t.includes("evcil") || t.includes("hayvan"))                  return { bg: "bg-pink-100",    text: "text-pink-600",    accent: "bg-pink-500" };
  return { bg: "bg-blue-100", text: "text-blue-600", accent: "bg-blue-500" };
}

function InsuranceIcon({ type, className }: { type: string; className?: string }): ReactNode {
  const t = type.toLowerCase();

  if (t.includes("trafik") || t.includes("kasko") || t.includes("imm") || t.includes("elektrik")) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 17a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4zM1 1h4l2.68 13.39a2 2 0 001.95 1.61h9.72a2 2 0 001.95-1.61L23 6H6" />
      </svg>
    );
  }
  if (t.includes("sağlık") || t.includes("saglik") || t.includes("tamamlay")) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  if (t.includes("konut") || t.includes("dask") || t.includes("eşyam") || t.includes("esyam")) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  }
  if (t.includes("seyahat")) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (t.includes("cep") || t.includes("telefon")) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  // Default: shield-check
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();
  const [minimized, setMinimized] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // Track user activity to detect inactivity
  useEffect(() => {
    const reset = () => {
      lastActivityRef.current = Date.now();
      if (minimized) setMinimized(false);
    };
    window.addEventListener("mousemove", reset, { passive: true });
    window.addEventListener("keydown",   reset, { passive: true });
    window.addEventListener("click",     reset, { passive: true });
    window.addEventListener("touchstart",reset, { passive: true });
    return () => {
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown",   reset);
      window.removeEventListener("click",     reset);
      window.removeEventListener("touchstart",reset);
    };
  }, [minimized]);

  // Poll every 10 s: minimize after 60 s inactivity
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 60_000) setMinimized(true);
    }, 10_000);
    return () => clearInterval(interval);
  }, [toasts.length]);

  // New toast → always expand and reset timer
  useEffect(() => {
    if (toasts.length > 0) {
      setMinimized(false);
      lastActivityRef.current = Date.now();
    }
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  const activeCount = toasts.filter((t) => !t.removing).length;

  return (
    <>
      <style>{`
        @keyframes toast-spring-in {
          0%   { opacity:0; transform:translateX(calc(100% + 24px)) scale(0.9); }
          55%  { opacity:1; transform:translateX(-8px) scale(1.02); }
          75%  { transform:translateX(4px) scale(0.99); }
          100% { opacity:1; transform:translateX(0) scale(1); }
        }
        @keyframes toast-spring-out {
          0%   { opacity:1; transform:translateX(0) scale(1); }
          100% { opacity:0; transform:translateX(calc(100% + 24px)) scale(0.9); }
        }
        @keyframes mini-fade-in {
          from { opacity:0; transform:scale(0.9) translateY(-4px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .toast-in  { animation: toast-spring-in  0.48s cubic-bezier(0.34,1.56,0.64,1) both; }
        .toast-out { animation: toast-spring-out 0.28s ease-in both; }
        .mini-in   { animation: mini-fade-in 0.25s ease both; }
      `}</style>

      {/* Fixed overlay: bottom-right on mobile, top-right on sm+ */}
      <div
        className="fixed z-[9999] pointer-events-none
                   bottom-4 right-4 flex flex-col-reverse gap-3 items-end
                   sm:bottom-auto sm:top-4 sm:flex-col"
        style={{ maxWidth: "min(380px, calc(100vw - 1rem))" }}
      >
        <div className="flex flex-col gap-3 items-end w-full">
          {minimized ? (
            /* ── Minimized pill ────────────────────────────────────────────── */
            <button
              className="pointer-events-auto mini-in flex items-center gap-2.5 px-4 py-2.5
                         rounded-full border border-white/60
                         text-slate-700 text-xs font-semibold
                         hover:shadow-2xl active:scale-95 transition-all"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
              onClick={() => {
                setMinimized(false);
                lastActivityRef.current = Date.now();
              }}
            >
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              {activeCount} yeni teklif bekleniyor
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          ) : (
            /* ── Toast stack ───────────────────────────────────────────────── */
            toasts.map((t) => {
              const scheme = getScheme(t.requestType);
              return (
                <div
                  key={t.id}
                  className={`pointer-events-auto w-full rounded-2xl overflow-hidden
                              ${t.removing ? "toast-out" : "toast-in"}`}
                  style={{
                    background: "rgba(255,255,255,0.97)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow:
                      "0 24px 64px rgba(0,0,0,0.13), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                    border: "1px solid rgba(255,255,255,0.5)",
                  }}
                >
                  {/* Colored top accent */}
                  <div className={`h-1 w-full ${scheme.accent}`} />

                  <div className="flex">
                    {/* Left colored bar */}
                    <div className={`w-1 flex-shrink-0 ${scheme.accent} opacity-40`} />

                    <div className="flex-1 p-4">
                      {/* Header: icon + text + close */}
                      <div className="flex items-start gap-3">
                        {/* Insurance icon */}
                        <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${scheme.bg} ${scheme.text}`}>
                          <InsuranceIcon type={t.requestType} className="w-5 h-5" />
                        </div>

                        {/* Text block */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                            Yeni teklif talebi
                          </p>
                          <p className="text-[15px] font-bold text-slate-900 leading-tight truncate">
                            {t.customerName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{t.requestType}</p>
                        </div>

                        {/* Close button */}
                        <button
                          onClick={() => dismissToast(t.id)}
                          className="flex-shrink-0 -mt-0.5 -mr-0.5 w-7 h-7 rounded-lg
                                     flex items-center justify-center
                                     text-gray-300 hover:text-gray-600 hover:bg-gray-100
                                     transition-all duration-150"
                          aria-label="Kapat"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3.5">
                        <a
                          href="/requests"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                                     rounded-xl bg-blue-600 text-white text-xs font-semibold
                                     hover:bg-blue-700 active:bg-blue-800
                                     transition-colors shadow-sm shadow-blue-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Teklife Git
                        </a>

                        {t.phone ? (
                          <a
                            href={`https://wa.me/${t.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                                       rounded-xl bg-emerald-500 text-white text-xs font-semibold
                                       hover:bg-emerald-600 active:bg-emerald-700
                                       transition-colors shadow-sm shadow-emerald-200"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp Aç
                          </a>
                        ) : (
                          <span
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                                       rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold
                                       cursor-not-allowed select-none"
                            title="Telefon numarası bulunamadı"
                          >
                            WhatsApp Aç
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
