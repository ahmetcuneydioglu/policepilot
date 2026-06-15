"use client";

/**
 * /davet — Davet kabul & şifre belirleme.
 *
 * Acente sahibinin davet linki buraya yönlenir. Supabase davet (invite) /
 * parola (recovery) linki, doğrulama sonrası bu sayfaya oturum token'larıyla
 * gelir. Sayfa oturumu kurar, kullanıcıya şifre belirletir, hesabı aktive eder
 * (bootstrap invited→active) ve panele yönlendirir.
 *
 * Public rota (CRMShell dışında) — auth gate yok.
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const INPUT =
  "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl text-slate-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition bg-white";

type Phase = "checking" | "ready" | "invalid" | "done";

function AcceptInvite() {
  const router = useRouter();
  const [phase, setPhase]   = useState<Phase>("checking");
  const [email, setEmail]   = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  // ── Oturumu davet linkinden kur ────────────────────────────────────────────
  useEffect(() => {
    // URL parçalarını HEMEN yakala — client (detectSessionInUrl) hash'i tüketip
    // temizlemeden önce. Aksi halde yarış oluşur, token kaybolur.
    const rawHash   = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const rawSearch = typeof window !== "undefined" ? window.location.search : "";
    const hp = new URLSearchParams(rawHash);
    const sp = new URLSearchParams(rawSearch);
    const errDesc = hp.get("error_description") || sp.get("error_description");

    let done = false;
    const finish = (session: { user?: { email?: string | null } } | null) => {
      if (done || !session?.user) return;
      done = true;
      setEmail(session.user.email ?? null);
      setPhase("ready");
      if (typeof window !== "undefined") window.history.replaceState(null, "", "/davet");
    };

    if (errDesc) { setError(decodeURIComponent(errDesc)); setPhase("invalid"); return; }

    // Oturum otomatik kurulunca (detectSessionInUrl / recovery) yakala
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => finish(session));

    (async () => {
      // 1) Zaten oturum var mı?
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return finish(session);

      // 2) Hash token'ları (verify endpoint implicit redirect)
      const access_token = hp.get("access_token");
      const refresh_token = hp.get("refresh_token");
      if (access_token && refresh_token) {
        const { data } = await supabase.auth.setSession({ access_token, refresh_token });
        if (data.session) return finish(data.session);
      }

      // 3) PKCE code param
      const code = sp.get("code");
      if (code) {
        try {
          const { data } = await supabase.auth.exchangeCodeForSession(code);
          if (data.session) return finish(data.session);
        } catch { /* verifier yoksa atla; listener/grace devreye girer */ }
      }
    })();

    // Otomatik işleme + listener'a süre tanı; hâlâ oturum yoksa geçersiz say
    const timer = setTimeout(() => { if (!done) setPhase("invalid"); }, 3500);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Şifre en az 6 karakter olmalı."); return; }
    if (password !== confirm) { setError("Şifreler eşleşmiyor."); return; }
    setError(""); setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw new Error(updErr.message);
      // Hesabı aktive et (invited→active) + acente kurulumu
      await fetch("/api/auth/bootstrap", { method: "POST" }).catch(() => {});
      setPhase("done");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre belirlenemedi.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-lg">PoliçePilot</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          {phase === "checking" && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Davet doğrulanıyor…</p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-1.5">Davet linki geçersiz veya süresi dolmuş</h1>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                {error || "Bu davet bağlantısı kullanılmış ya da artık geçerli değil. Acente yöneticinizden yeni bir davet linki isteyin."}
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
                Giriş sayfasına dön
              </Link>
            </div>
          )}

          {phase === "ready" && (
            <>
              <h1 className="text-xl font-extrabold text-slate-900 mb-1">Ekibe hoş geldiniz 👋</h1>
              <p className="text-sm text-slate-500 mb-5">
                {email && <><strong>{email}</strong> için </>}bir şifre belirleyin, hesabınız hemen aktive olsun.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yeni Şifre</label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="En az 6 karakter" className={INPUT} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Şifre (Tekrar)</label>
                  <input type={showPwd ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Şifreyi tekrar girin" className={INPUT} />
                </div>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <span className="text-red-500">⚠️</span>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-200">
                  {saving ? "Kaydediliyor…" : "Şifreyi Belirle ve Giriş Yap"}
                </button>
              </form>
            </>
          )}

          {phase === "done" && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-1">Hesabınız hazır!</h1>
              <p className="text-sm text-slate-500">Panele yönlendiriliyorsunuz…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DavetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <AcceptInvite />
    </Suspense>
  );
}
