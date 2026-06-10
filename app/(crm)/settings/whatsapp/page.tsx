"use client";

/**
 * PolicePilot — WhatsApp Bildirim Ayarları
 *
 * Acente bazlı: bildirimleri aç/kapat, numara, sağlayıcı, API anahtarı,
 * günlük özet ve test modu. Ayarlar /api/whatsapp/settings üzerinden
 * okunur/yazılır — API anahtarı client'a hiçbir zaman geri dönmez.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  MessageCircle, ChevronLeft, ShieldCheck, FlaskConical,
  CalendarClock, KeyRound, Phone, Server, CheckCircle2, AlertTriangle,
} from "lucide-react";

type Settings = {
  whatsapp_enabled:      boolean;
  whatsapp_phone:        string;
  whatsapp_provider:     string;
  daily_summary_enabled: boolean;
  test_mode:             boolean;
  has_api_key:           boolean;
};

const PROVIDERS = [
  { value: "mock",       label: "Mock (Test)",            hint: "Gerçek gönderim yapmaz — geliştirme için" },
  { value: "meta_cloud", label: "Meta WhatsApp Cloud API", hint: "Resmi Meta Cloud API" },
  { value: "twilio",     label: "Twilio",                  hint: "Yakında" },
  { value: "dialog360",  label: "360dialog",               hint: "Yakında" },
  { value: "wati",       label: "WATI",                    hint: "Yakında" },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-emerald-500" : "bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-5" : ""
      }`} />
    </button>
  );
}

export default function WhatsAppSettingsPage() {
  const { loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey,   setApiKey]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ayarlar yüklenemedi.");
      setSettings(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ayarlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, whatsapp_api_key: apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setSaved(true);
      setApiKey("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-3">
          <ChevronLeft className="w-3.5 h-3.5" /> Ayarlar
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">WhatsApp Bildirimleri</h1>
            <p className="text-sm text-slate-400">Günlük operasyon özeti ve otomasyon mesajları</p>
          </div>
        </div>
      </div>

      {/* Ana toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">WhatsApp Bildirimleri</p>
            <p className="text-xs text-slate-400 mt-0.5">Kapalıyken hiçbir mesaj gönderilmez</p>
          </div>
        </div>
        <Toggle checked={settings.whatsapp_enabled} onChange={v => set("whatsapp_enabled", v)} />
      </div>

      {/* Detay ayarlar */}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 transition-opacity ${settings.whatsapp_enabled ? "" : "opacity-50 pointer-events-none"}`}>

        {/* Telefon */}
        <div className="p-5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Phone className="w-3.5 h-3.5" /> Telefon Numarası
          </label>
          <input
            type="tel"
            value={settings.whatsapp_phone}
            onChange={e => set("whatsapp_phone", e.target.value)}
            placeholder="905XXXXXXXXX"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">Günlük özetin gönderileceği numara — ülke koduyla, başında + olmadan (örn. 905331112233)</p>
        </div>

        {/* Sağlayıcı */}
        <div className="p-5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Server className="w-3.5 h-3.5" /> Sağlayıcı
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => set("whatsapp_provider", p.value)}
                className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                  settings.whatsapp_provider === p.value
                    ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <span className="font-semibold text-slate-800 block">{p.label}</span>
                <span className="text-[11px] text-slate-400">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Anahtarı */}
        <div className="p-5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <KeyRound className="w-3.5 h-3.5" /> API Anahtarı
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setSaved(false); }}
            placeholder={settings.has_api_key ? "••••••••  (kayıtlı — değiştirmek için yeni anahtar girin)" : "Sağlayıcı API anahtarı"}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50 font-mono"
          />
          {settings.has_api_key && (
            <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Anahtar kayıtlı. Boş bırakırsanız mevcut anahtar korunur.
            </p>
          )}
        </div>

        {/* Günlük özet */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">Günlük Operasyon Özeti</p>
              <p className="text-xs text-slate-400 mt-0.5">Her sabah 09:00&apos;da (TR) günün yenileme listesi gönderilir</p>
            </div>
          </div>
          <Toggle checked={settings.daily_summary_enabled} onChange={v => set("daily_summary_enabled", v)} />
        </div>

        {/* Test modu */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">Test Modu</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Açıkken gerçek WhatsApp gönderimi yapılmaz; mesajlar yalnızca kuyrukta görünür. Maliyet oluşmaz.
              </p>
            </div>
          </div>
          <Toggle checked={settings.test_mode} onChange={v => set("test_mode", v)} />
        </div>
      </div>

      {/* Hata / Kaydet */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/whatsapp-queue"
          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          WhatsApp Kuyruğunu Görüntüle →
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-green-500 transition-all shadow-sm shadow-emerald-500/25 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : saved ? <><CheckCircle2 className="w-4 h-4" /> Kaydedildi</> : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
