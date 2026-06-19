"use client";

/**
 * (crm) hata sınırı — bir ekran render sırasında çökerse TÜM uygulama kabuğunu
 * (sidebar/sekmeler) dondurmak yerine, yalnız içerik alanında zarif bir hata
 * gösterir. Sidebar layout'ta kaldığı için diğer sekmeler tıklanabilir kalır.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function CRMError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[crm/error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-600" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Bir şeyler ters gitti</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-5">
        Bu ekran yüklenirken bir hata oluştu. Tekrar deneyin; sorun sürerse sayfayı yenileyin.
        Diğer bölümler çalışmaya devam ediyor.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Tekrar dene
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
        >
          Sayfayı yenile
        </button>
      </div>
      {error?.digest && <p className="text-[11px] text-slate-300 mt-4">Hata kodu: {error.digest}</p>}
    </div>
  );
}
