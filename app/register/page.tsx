"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── helpers ──────────────────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RegisterPage() {
  // — acente fields
  const [agencyName,  setAgencyName]  = useState("");
  const [agencySlug,  setAgencySlug]  = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [slugEdited,  setSlugEdited]  = useState(false);

  // — yetkili fields
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // — ui state
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);
  const [finalSlug, setFinalSlug] = useState("");

  // auto-generate slug from agency name (unless user has manually edited it)
  function handleAgencyName(val: string) {
    setAgencyName(val);
    if (!slugEdited) setAgencySlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setAgencySlug(slugify(val) || val.toLowerCase());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agencyName.trim())  { setError("Acente adı zorunludur."); return; }
    if (!agencySlug.trim())  { setError("Acente bağlantısı zorunludur."); return; }
    if (password.length < 6) { setError("Şifre en az 6 karakter olmalı."); return; }
    setError("");
    setLoading(true);

    // 1. Check slug uniqueness
    const { data: existing } = await (supabase.from("agencies") as any)
      .select("id")
      .eq("slug", agencySlug.trim())
      .maybeSingle();

    if (existing) {
      setError("Bu acente bağlantısı kullanımda. Lütfen farklı bir bağlantı adı seçin.");
      setLoading(false);
      return;
    }

    // 2. Sign up — pass agency meta in options.data (DB trigger will create agency + profile)
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name:    fullName.trim(),
          agency_name:  agencyName.trim(),
          agency_slug:  agencySlug.trim(),
          agency_phone: agencyPhone.trim() || null,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setFinalSlug(agencySlug.trim());
    setDone(true);
    setLoading(false);
  }

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://policepilot.com";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)",
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">PoliçePilot</h1>
          <p className="text-slate-400 text-sm mt-1">Yeni acente kaydı oluştur</p>
        </div>

        <div
          className="rounded-2xl p-6 border border-white/10"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {done ? (
            /* ── Success state ────────────────────────────────────────── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Kayıt Tamamlandı!</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                E-posta adresinize doğrulama linki gönderildi. Hesabınızı aktive ettikten sonra giriş yapabilirsiniz.
              </p>

              {/* Teklif link preview */}
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-5 text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Müşterilere göndereceğiniz teklif linki</p>
                <p className="text-blue-300 text-sm font-mono break-all">
                  {origin}/a/{finalSlug}/teklif-al
                </p>
                <button
                  className="mt-3 text-[11px] text-slate-400 hover:text-white transition-colors underline underline-offset-2"
                  onClick={() => navigator.clipboard.writeText(`${origin}/a/${finalSlug}/teklif-al`)}
                >
                  Kopyala
                </button>
              </div>

              <Link
                href="/login"
                className="inline-flex mt-1 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Giriş Sayfasına Git →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Section: Acente Bilgileri ──────────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Acente Bilgileri
                </p>
                <div className="space-y-3">

                  {/* Agency name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Acente Adı *</label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => handleAgencyName(e.target.value)}
                      required
                      placeholder="Örn: Atlas Sigorta"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15
                                 text-white placeholder-slate-500 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                    />
                  </div>

                  {/* Agency slug */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Acente Bağlantısı *
                    </label>
                    <div className="flex items-center rounded-xl overflow-hidden border border-white/15 bg-white/10 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition">
                      <span className="px-3 text-slate-500 text-xs select-none whitespace-nowrap border-r border-white/10 py-2.5">/a/</span>
                      <input
                        type="text"
                        value={agencySlug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        required
                        placeholder="atlas-sigorta"
                        className="flex-1 px-3 py-2.5 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
                      />
                    </div>
                    {agencySlug && (
                      <p className="text-[11px] text-slate-500 mt-1.5 ml-0.5">
                        Teklif linkiniz: <span className="text-blue-400">{origin}/a/{agencySlug}/teklif-al</span>
                      </p>
                    )}
                  </div>

                  {/* Agency phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Acente Telefonu <span className="text-slate-500 font-normal">(isteğe bağlı)</span></label>
                    <input
                      type="tel"
                      value={agencyPhone}
                      onChange={(e) => setAgencyPhone(e.target.value)}
                      placeholder="0212 123 45 67"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15
                                 text-white placeholder-slate-500 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10" />

              {/* ── Section: Yetkili Bilgileri ─────────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Yetkili Bilgileri
                </p>
                <div className="space-y-3">

                  {/* Full name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Ad Soyad *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Ahmet Yılmaz"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15
                                 text-white placeholder-slate-500 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-posta *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ornek@email.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15
                                 text-white placeholder-slate-500 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Şifre *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="En az 6 karakter"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15
                                 text-white placeholder-slate-500 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-xs">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm
                           hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                           transition-colors shadow-lg shadow-blue-500/20"
              >
                {loading ? "Kayıt yapılıyor..." : "Acente Kaydı Oluştur"}
              </button>
            </form>
          )}

          {!done && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] text-slate-500">veya</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <p className="text-center text-xs text-slate-400">
                Zaten hesabın var mı?{" "}
                <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
                  Giriş Yap
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          © 2026 PoliçePilot · Yetkisiz erişim yasaktır.
        </p>
      </div>
    </div>
  );
}
