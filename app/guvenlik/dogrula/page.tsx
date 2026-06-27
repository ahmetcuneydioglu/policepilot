"use client";

/**
 * Security Center — Web telefon doğrulama (Faz 2).
 * Mobil verify-phone ekranının web karşılığı. ORTAK backend: aynı /api/security/otp/*
 * uçlarını cookie auth ile çağırır (kod tekrarı yok). (crm) DIŞINDA → gate döngüsü olmaz.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const OTP_LEN = 6;
const RESEND_SECONDS = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try { data = await res.json(); } catch { /* boş */ }
  return { ok: res.ok, status: res.status, data };
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [masked, setMasked] = useState("");
  const [devCode, setDevCode] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "call" | "">("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(async () => {
    setError(""); setSending(true);
    const r = await postJson("/api/security/otp/send", {});
    setSending(false);
    if (!r.ok) { setError(r.data?.error ?? "Kod gönderilemedi."); return; }
    if (r.data?.meta?.phoneMasked) setMasked(r.data.meta.phoneMasked);
    setChannel(r.data?.meta?.channel ?? "");
    setDevCode(r.data?.meta?.devCode ?? "");
    setCountdown(RESEND_SECONDS);
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Oturum kontrolü + ilk gönderim
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getUser().then((res: any) => {
      if (!res?.data?.user) { router.replace("/login"); return; }
      setReady(true);
      send();
    });
  }, [router, send]);

  // Geri sayım
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const verify = useCallback(async (value: string) => {
    setVerifying(true); setError("");
    const r = await postJson("/api/security/otp/verify", { code: value });
    setVerifying(false);
    if (r.ok && r.data?.verified) { router.replace("/dashboard"); return; }
    setError(r.data?.error ?? "Kod doğrulanamadı.");
    setCode("");
  }, [router]);

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, OTP_LEN);
    setCode(digits);
    if (error) setError("");
    if (digits.length === OTP_LEN) verify(digits);
  }

  async function signOut() { await supabase.auth.signOut(); router.replace("/login"); }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5 text-3xl">🔐</div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Telefon Doğrulama</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {masked ? `${masked} numaranıza` : "Telefonunuza"}{" "}
          {channel === "whatsapp" ? "WhatsApp ile " : channel === "sms" ? "SMS ile " : ""}
          gönderdiğimiz 6 haneli kodu girin.
        </p>

        {devCode && (
          <button
            onClick={() => onChange(devCode)}
            className="mt-4 w-full bg-amber-50 border border-amber-300 rounded-xl py-2.5 px-4 text-amber-800 hover:bg-amber-100 transition"
          >
            <span className="text-sm font-semibold">
              🧪 Test modu (Mock) — kod:{" "}
              <span className="font-mono font-black tracking-widest">{devCode}</span>
            </span>
            <span className="block text-[11px] text-amber-600 mt-0.5">Otomatik doldurmak için tıkla</span>
          </button>
        )}

        <div className="mt-6 flex gap-2 justify-center cursor-text" onClick={() => inputRef.current?.focus()}>
          {Array.from({ length: OTP_LEN }).map((_, i) => {
            const ch = code[i] ?? "";
            const active = i === code.length;
            return (
              <div
                key={i}
                className={`w-11 h-14 rounded-xl border-[1.5px] flex items-center justify-center text-2xl font-extrabold text-slate-900 bg-white ${
                  error ? "border-red-400" : ch || active ? "border-blue-500" : "border-gray-200"
                }`}
              >
                {ch}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LEN}
          disabled={verifying}
          autoFocus
          className="sr-only"
          aria-label="Doğrulama kodu"
        />

        <p className="text-red-600 text-sm mt-4 min-h-[20px]">{error}</p>

        {verifying ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mt-1">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Doğrulanıyor…
          </div>
        ) : (
          <button
            onClick={send}
            disabled={countdown > 0 || sending}
            className="mt-1 text-blue-600 font-semibold text-sm hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {sending ? "Gönderiliyor…" : countdown > 0 ? `Tekrar gönder (${countdown}s)` : "Kodu tekrar gönder"}
          </button>
        )}

        <button onClick={signOut} className="block mx-auto mt-8 text-slate-400 text-xs hover:text-slate-600 transition">
          Farklı hesap · Çıkış yap
        </button>
      </div>
    </div>
  );
}
