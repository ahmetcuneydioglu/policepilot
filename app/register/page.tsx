"use client";

import { useState, useEffect } from "react";
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

// ─── Input style ──────────────────────────────────────────────────────────────
const INPUT =
  "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl text-slate-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "focus:border-blue-400 transition bg-white";

const LABEL = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

// ─── Left panel: mini dashboard mockup ────────────────────────────────────────
function DashboardMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      {/* Title bar */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex items-center gap-2.5 backdrop-blur-sm">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-white/10 rounded-md px-3 py-1 flex items-center gap-1.5">
          <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] text-white/40 font-medium">app.sigortaos.com</span>
        </div>
      </div>

      {/* App shell */}
      <div className="flex bg-slate-950/60 backdrop-blur-sm">
        {/* Mini sidebar */}
        <div className="w-10 flex-shrink-0 bg-slate-900/50 flex flex-col items-center py-3 gap-3 border-r border-white/5">
          <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          {[
            "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
            "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
            "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
          ].map((d, i) => (
            <div key={i} className={`w-6 h-6 rounded-lg ${i === 0 ? "bg-white/10" : ""} flex items-center justify-center`}>
              <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
              </svg>
            </div>
          ))}
        </div>

        {/* Dashboard content */}
        <div className="flex-1 p-3 space-y-2.5">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { n: "247", l: "Müşteri",  c: "text-blue-400" },
              { n: "12",  l: "Teklif",   c: "text-indigo-400" },
              { n: "8",   l: "Yenileme", c: "text-amber-400" },
              { n: "3",   l: "Bugün",    c: "text-emerald-400" },
            ].map((s) => (
              <div key={s.l} className="bg-slate-800/50 rounded-xl p-2 border border-white/5">
                <p className={`text-sm font-bold ${s.c}`}>{s.n}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Request list */}
          <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-2.5 py-1.5 border-b border-white/5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] text-slate-400 font-semibold">Teklif Talepleri</span>
            </div>
            {[
              { n: "Zeynep A.", t: "Kasko",  c: "text-blue-400",   bg: "bg-blue-900/30" },
              { n: "Ahmet Y.",  t: "Trafik", c: "text-indigo-400", bg: "bg-indigo-900/30" },
              { n: "Fatma K.",  t: "DASK",   c: "text-amber-400",  bg: "bg-amber-900/30" },
            ].map((r) => (
              <div key={r.n} className="px-2.5 py-1.5 flex items-center gap-2 border-b border-white/5 last:border-0">
                <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[7px] font-bold text-slate-300 flex-shrink-0">
                  {r.n[0]}
                </div>
                <span className="text-[9px] text-slate-300 flex-1 truncate">{r.n}</span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${r.c} ${r.bg}`}>{r.t}</span>
              </div>
            ))}
          </div>

          {/* AI strip */}
          <div className="bg-gradient-to-r from-violet-900/40 to-blue-900/40 rounded-xl border border-white/5 px-2.5 py-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-[9px] text-blue-300 leading-snug">AI Özeti · 12 açık teklif · 8 poliçe yenilenecek</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Background floating icons ────────────────────────────────────────────────
const BG_ICONS = [
  { d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", style: { top: "8%",  left: "6%",  width: 80, opacity: 0.05 } },
  { d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", style: { top: "22%", right: "8%", width: 64, opacity: 0.04 } },
  { d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", style: { bottom: "18%", left: "10%", width: 72, opacity: 0.04 } },
  { d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", style: { bottom: "8%",  right: "6%", width: 90, opacity: 0.05 } },
  { d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", style: { top: "55%", left: "4%",  width: 56, opacity: 0.04 } },
  { d: "M13 10V3L4 14h7v7l9-11h-7z", style: { top: "40%", right: "5%", width: 52, opacity: 0.04 } },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  // ── invite mode
  const [isInvite,      setIsInvite]      = useState(false);
  const [inviteAgency,  setInviteAgency]  = useState<{ name: string; slug: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // ── acente fields
  const [agencyName,  setAgencyName]  = useState("");
  const [agencySlug,  setAgencySlug]  = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [slugEdited,  setSlugEdited]  = useState(false);

  // ── personal fields
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  // ── ui
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);
  const [finalSlug,  setFinalSlug]  = useState("");
  const [autoSignedIn, setAutoSignedIn] = useState(false); // e-posta onayı kapalıysa true (mail gitmez)

  // Detect ?invite= param
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteSlug = params.get("invite");
    if (!inviteSlug) return;
    setIsInvite(true);
    setInviteLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("name, slug").eq("slug", inviteSlug).maybeSingle()
      .then(({ data }: { data: { name: string; slug: string } | null }) => {
        setInviteAgency(data);
        setInviteLoading(false);
      });
  }, []);

  function handleAgencyName(val: string) {
    setAgencyName(val);
    if (!slugEdited) setAgencySlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setAgencySlug(slugify(val) || val.toLowerCase());
  }

  /**
   * signUp sonucunu yorumla.
   *  - data.user.identities === []  → e-posta ZATEN kayıtlı (Supabase sahte başarı
   *    döner, mail GÖNDERMEZ). Kullanıcıya "zaten kayıtlı" hatası göster.
   *  - data.session var             → e-posta onayı kapalı, anında giriş (mail yok).
   *  - aksi (session yok, identity var) → doğrulama maili gönderildi.
   * Dönüş: { duplicate, autoSignedIn } | error fırlatmaz, çağıran karar verir.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function interpretSignUp(data: any): { duplicate: boolean; autoSignedIn: boolean } {
    const identities = data?.user?.identities;
    const duplicate = Array.isArray(identities) && identities.length === 0;
    return { duplicate, autoSignedIn: Boolean(data?.session) };
  }

  const DUPLICATE_MSG = "Bu e-posta zaten kayıtlı. Lütfen giriş yapın veya şifrenizi sıfırlayın.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Şifre en az 6 karakter olmalı."); return; }

    if (isInvite) {
      if (!inviteAgency) { setError("Geçersiz davet linki."); return; }
      setError(""); setLoading(true);
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: fullName.trim(), agency_invite_slug: inviteAgency.slug } },
      });
      if (authError) { setError(authError.message); setLoading(false); return; }
      const { duplicate, autoSignedIn } = interpretSignUp(data);
      if (duplicate) { setError(DUPLICATE_MSG); setLoading(false); return; }
      setAutoSignedIn(autoSignedIn);
      setFinalSlug(inviteAgency.slug);
      setDone(true); setLoading(false);
      return;
    }

    if (!agencyName.trim()) { setError("Acente adı zorunludur."); return; }
    if (!agencySlug.trim()) { setError("Acente bağlantısı zorunludur."); return; }
    // Telefon zorunlu — günlük operasyon özetleri bu numaraya gider (TR formatı)
    const phoneDigits = agencyPhone.replace(/\D/g, "");
    const trPhoneOk = /^(90)?0?5\d{9}$/.test(phoneDigits) || /^(90)?0?[2348]\d{9}$/.test(phoneDigits);
    if (!phoneDigits) { setError("Telefon numarası zorunludur."); return; }
    if (!trPhoneOk) { setError("Geçerli bir Türkiye telefon numarası girin (örn. 0532 123 45 67)."); return; }
    setError(""); setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from("agencies") as any)
      .select("id").eq("slug", agencySlug.trim()).maybeSingle();
    if (existing) {
      setError("Bu acente bağlantısı kullanımda. Lütfen farklı bir isim seçin.");
      setLoading(false); return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        data: {
          full_name: fullName.trim(),
          agency_name:  agencyName.trim(),
          agency_slug:  agencySlug.trim(),
          agency_phone: agencyPhone.trim() || null,
        },
      },
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const { duplicate, autoSignedIn } = interpretSignUp(data);
    if (duplicate) { setError(DUPLICATE_MSG); setLoading(false); return; }
    setAutoSignedIn(autoSignedIn);
    setFinalSlug(agencySlug.trim());
    setDone(true); setLoading(false);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sigortaos.com";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — dark gradient + mockup
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #060d1f 0%, #0d1f3c 40%, #0f1a40 70%, #0a0f2e 100%)" }}
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Glow orb */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }}
        />

        {/* Background floating icons */}
        {BG_ICONS.map((ic, i) => (
          <svg
            key={i}
            className="absolute text-white pointer-events-none"
            style={{ ...ic.style } as React.CSSProperties}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={ic.d} />
          </svg>
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12 justify-between">

          {/* Top: logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-white text-base tracking-tight">SigortaOS</span>
          </div>

          {/* Middle: tagline + mockup */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-500/20 text-blue-300 rounded-full px-3 py-1 text-xs font-semibold mb-5">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Destekli CRM
              </div>
              <h2 className="text-3xl xl:text-[2.15rem] font-extrabold text-white leading-[1.15] tracking-tight mb-3">
                Sigorta Acenteleri İçin<br />
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #60a5fa 0%, #818cf8 100%)" }}>
                  AI Destekli CRM
                </span>
              </h2>
              <p className="text-slate-400 text-[0.95rem] leading-relaxed max-w-xs">
                Teklif yönetimi, müşteri takibi, poliçe yenilemeleri ve WhatsApp entegrasyonu.
              </p>
            </div>

            {/* Dashboard mockup */}
            <div
              className="max-w-sm"
              style={{ filter: "drop-shadow(0 32px 48px rgba(0,0,0,0.6))" }}
            >
              <DashboardMockup />
            </div>
          </div>

          {/* Bottom: trust signals */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { icon: "⚡", label: "5 dk kurulum" },
              { icon: "🔒", label: "KVKK uyumlu" },
              { icon: "🤖", label: "AI destekli" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — form
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-2.5 px-6 pt-6 pb-0">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-base">SigortaOS</span>
        </div>

        {/* Form area — vertically centered */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">

            {/* ── Success state ──────────────────────────────────────── */}
            {done ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Hesabınız Oluşturuldu!</h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  {autoSignedIn
                    ? "Hesabınız hazır — hemen giriş yapabilirsiniz."
                    : <><strong>{email}</strong> adresine doğrulama linki gönderildi. Linke tıklayıp aktive ettikten sonra giriş yapabilirsiniz. (Gelmediyse spam/gereksiz klasörünü kontrol edin.)</>}
                </p>

                {finalSlug && (
                  <div className="bg-slate-50 border border-gray-200 rounded-2xl p-5 mb-6 text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Müşteri teklif linkiniz
                    </p>
                    <p className="text-sm font-mono text-blue-600 break-all leading-relaxed">
                      {origin}/a/{finalSlug}/teklif-al
                    </p>
                    <button
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                      onClick={() => navigator.clipboard.writeText(`${origin}/a/${finalSlug}/teklif-al`)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Linki Kopyala
                    </button>
                  </div>
                )}

                <Link href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                  Giriş Yap →
                </Link>
              </div>

            ) : (
              <>
                {/* Header */}
                <div className="mb-8">
                  <h1 className="text-[1.85rem] font-extrabold text-slate-900 tracking-tight leading-none mb-2">
                    {isInvite ? "Davetiye Kabul Et" : "Ücretsiz Başlayın"}
                  </h1>
                  <p className="text-slate-400 text-sm">
                    {isInvite
                      ? "Ekibinize katılmak için aşağıdaki formu doldurun."
                      : "Acentenizi oluşturun, dakikalar içinde başlayın."}
                  </p>
                </div>

                {/* Invite banner */}
                {isInvite && (
                  <div className="mb-5">
                    {inviteLoading ? (
                      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <span className="text-sm text-blue-600">Davet bilgileri yükleniyor...</span>
                      </div>
                    ) : inviteAgency ? (
                      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {inviteAgency.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Davet geldi</p>
                          <p className="text-sm font-bold text-slate-800">{inviteAgency.name}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                        <p className="text-sm text-red-600 font-medium">Geçersiz davet linki.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* ── Agency section (non-invite only) ─────────────── */}
                  {!isInvite && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acente Bilgileri</p>

                      <div>
                        <label className={LABEL}>Acente Adı *</label>
                        <input type="text" value={agencyName}
                          onChange={(e) => handleAgencyName(e.target.value)}
                          required placeholder="Örn: Atlas Sigorta"
                          className={INPUT} />
                      </div>

                      <div>
                        <label className={LABEL}>Acente Bağlantısı *</label>
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400 transition">
                          <span className="px-3.5 py-3 text-xs font-mono text-gray-400 bg-gray-50 border-r border-gray-200 select-none whitespace-nowrap">/a/</span>
                          <input type="text" value={agencySlug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            required placeholder="atlas-sigorta"
                            className="flex-1 px-3 py-3 text-sm text-slate-800 placeholder:text-gray-300 focus:outline-none bg-transparent" />
                        </div>
                        {agencySlug && (
                          <p className="mt-1.5 text-[11px] text-gray-400 truncate">
                            {origin}/a/<span className="text-blue-500 font-medium">{agencySlug}</span>/teklif-al
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={LABEL}>Telefon *</label>
                        <input type="tel" value={agencyPhone}
                          onChange={(e) => setAgencyPhone(e.target.value)}
                          required
                          placeholder="0532 123 45 67"
                          className={INPUT} />
                        <p className="mt-1.5 text-[11px] text-gray-400">
                          Operasyon bildirim numaranız — günlük WhatsApp özetleri bu numaraya gönderilir.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Personal section ─────────────────────────────── */}
                  <div className="space-y-3">
                    {!isInvite && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-1">Yetkili Bilgileri</p>
                    )}

                    <div>
                      <label className={LABEL}>Ad Soyad *</label>
                      <input type="text" value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required placeholder="Ahmet Yılmaz"
                        className={INPUT} />
                    </div>

                    <div>
                      <label className={LABEL}>E-posta *</label>
                      <input type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required placeholder="ornek@acente.com"
                        className={INPUT} />
                    </div>

                    <div>
                      <label className={LABEL}>Şifre *</label>
                      <div className="relative">
                        <input
                          type={showPwd ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required placeholder="En az 6 karakter"
                          className={INPUT}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showPwd ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm
                               hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                               transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200
                               hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
                        </svg>
                        Oluşturuluyor...
                      </span>
                    ) : isInvite ? "Ekibe Katıl" : "Acentemi Oluştur"}
                  </button>
                </form>

                {/* Footer links */}
                <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Hesabın var mı?{" "}
                    <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                      Giriş Yap
                    </Link>
                  </p>
                  <p className="text-[10px] text-gray-300">© 2026 SigortaOS</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
