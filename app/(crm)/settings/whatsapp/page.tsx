"use client";

/**
 * PolicePilot — WhatsApp Ayarları (role bazlı iki görünüm)
 *
 * agency_user  → yalnız ALICI tercihleri: bildirim aç/kapat, günlük özet,
 *                telefon numarası + Test Gönder. Meta kimlik bilgileri,
 *                sağlayıcı ve test modu görünmez.
 * super_admin  → Platform Meta yapılandırması: Access Token (maskeli),
 *                Phone Number ID, WABA ID, sağlayıcı, platform test modu,
 *                token ömrü uyarıları + Test Gönder.
 *
 * WhatsApp hattının sahibi PLATFORMDUR — token yalnız super_admin yönetir
 * ve client'a asla geri dönmez.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  MessageCircle, ChevronLeft, ShieldCheck, FlaskConical,
  CalendarClock, KeyRound, Phone, Server, CheckCircle2, AlertTriangle,
} from "lucide-react";

// ─── Tipler ───────────────────────────────────────────────────────────────────

type AgencySettings = {
  whatsapp_enabled:      boolean;
  whatsapp_phone:        string;
  daily_summary_enabled: boolean;
};

type PlatformSettings = {
  whatsapp_provider:    string;
  meta_phone_number_id: string;
  meta_waba_id:         string;
  test_mode:            boolean;
  has_token:            boolean;
  env_fallback_configured: boolean;
  effective_source:     string;
};

type TokenStatus = {
  valid: boolean;
  expires_at: number | null;
  hours_left: number | null;
  expiring_soon: boolean;
  error: string | null;
};

const INPUT = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50";

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

// ─── Test Gönder (her iki görünümde ortak) ────────────────────────────────────

function TestSendButton({ disabled }: { disabled?: boolean }) {
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res  = await fetch("/api/whatsapp/test-send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Test gönderimi başarısız.");
      setResult({
        ok: true,
        msg: json.provider === "mock"
          ? "Mock test başarılı (gerçek mesaj gitmedi — platform sağlayıcısı Mock)."
          : `Test mesajı gönderildi! 🎉 (${json.phone} — ${json.provider})`,
      });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Test gönderimi başarısız." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      {result && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          result.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {result.msg}
        </div>
      )}
      <button
        onClick={send}
        disabled={sending || disabled}
        title="Platform hattından kayıtlı numaranıza anında test mesajı gönderir"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition-all disabled:opacity-50"
      >
        {sending ? "Gönderiliyor…" : "📲 Test Gönder"}
      </button>
    </div>
  );
}

// ─── Acente görünümü ──────────────────────────────────────────────────────────

function AgencyView() {
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) {
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
        {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Bildirimler */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">WhatsApp Bildirimleri</p>
              <p className="text-xs text-slate-400 mt-0.5">Kapalıyken size hiçbir mesaj gönderilmez</p>
            </div>
          </div>
          <Toggle checked={settings.whatsapp_enabled} onChange={v => set("whatsapp_enabled", v)} />
        </div>

        {/* Günlük özet */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">Günlük Operasyon Özeti</p>
              <p className="text-xs text-slate-400 mt-0.5">Her sabah 09:00&apos;da (TR) günün özeti gönderilir</p>
            </div>
          </div>
          <Toggle checked={settings.daily_summary_enabled} onChange={v => set("daily_summary_enabled", v)} disabled={!settings.whatsapp_enabled} />
        </div>

        {/* Telefon */}
        <div className="p-5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Phone className="w-3.5 h-3.5" /> Bildirim Numaranız
          </label>
          <input
            type="tel"
            value={settings.whatsapp_phone}
            onChange={e => set("whatsapp_phone", e.target.value)}
            placeholder="905XXXXXXXXX"
            className={INPUT}
          />
          <p className="text-[11px] text-slate-400 mt-1.5">Özetlerin gönderileceği numara — ülke koduyla, başında + olmadan</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/whatsapp-queue" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
          WhatsApp Kuyruğunu Görüntüle →
        </Link>
        <div className="flex items-center gap-2">
          <TestSendButton disabled={!settings.whatsapp_enabled} />
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-green-500 transition-all shadow-sm shadow-emerald-500/25 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : saved ? <><CheckCircle2 className="w-4 h-4" /> Kaydedildi</> : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Super admin görünümü ─────────────────────────────────────────────────────

function PlatformView() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [token,    setToken]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const [exchanging, setExchanging] = useState(false);
  const [exchangeMsg, setExchangeMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // Kısa token'ı Meta'nın fb_exchange_token akışıyla 60 günlük token'a çevir
  async function extendToken() {
    setExchanging(true);
    setExchangeMsg(null);
    try {
      const res  = await fetch("/api/whatsapp/token-exchange", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        // Alana yeni token yazıldıysa onu uzat; boşsa kayıtlı token uzatılır
        body: JSON.stringify(token.trim() ? { token: token.trim() } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Token uzatılamadı.");
      setExchangeMsg({
        ok: true,
        msg: `Token 60 güne uzatıldı ve kaydedildi 🎉${json.days_left != null ? ` — kalan süre ~${json.days_left} gün` : ""}`,
      });
      setToken("");
      load();
    } catch (e) {
      setExchangeMsg({ ok: false, msg: e instanceof Error ? e.message : "Token uzatılamadı." });
    } finally {
      setExchanging(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/whatsapp/platform-settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Platform ayarları yüklenemedi.");
      setSettings(json.settings);
      setTokenStatus(json.token_status ?? null);
      setMigrationRequired(Boolean(json.migration_required));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Platform ayarları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, meta_access_token: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setSaved(true);
      setToken("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
        {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {migrationRequired && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-700">platform_settings tablosu bulunamadı</p>
            <p className="text-amber-600 text-xs mt-1">
              <code>supabase/platform_settings_migration.sql</code> dosyasını Supabase SQL Editor&apos;da çalıştırın.
              O zamana kadar sistem Vercel env değişkenleriyle (yedek) çalışır.
            </p>
          </div>
        </div>
      )}

      {/* Token ömrü durumu */}
      {tokenStatus && (!tokenStatus.valid || tokenStatus.expiring_soon) && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-red-50 border-2 border-red-300">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            {!tokenStatus.valid ? (
              <>
                <p className="font-bold text-red-700">Meta token geçersiz veya süresi dolmuş!</p>
                <p className="text-red-600 text-xs mt-1">
                  {tokenStatus.error ?? "Token doğrulanamadı."} — Meta panelinden yeni token alıp aşağıya girin.
                  Yenilenene kadar gönderimler beklemede kalır.
                  <b> İpucu:</b> kısa token&apos;ı yapıştırıp &ldquo;🔁 60 Güne Uzat&rdquo;ı kullanın — 2 ay boyunca yenileme gerekmez.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-red-700">
                  Meta token&apos;ın süresi {tokenStatus.hours_left != null ? `~${Math.round(tokenStatus.hours_left)} saat içinde` : "yakında"} doluyor!
                </p>
                <p className="text-red-600 text-xs mt-1">Süresi dolmadan yeni token alıp aşağıya girin.</p>
              </>
            )}
          </div>
        </div>
      )}
      {tokenStatus && tokenStatus.valid && !tokenStatus.expiring_soon && (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          Meta token geçerli{tokenStatus.hours_left != null ? ` — kalan süre ~${Math.round(tokenStatus.hours_left)} saat` : " (süresiz)"}.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Sağlayıcı */}
        <div className="p-5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Server className="w-3.5 h-3.5" /> Platform Sağlayıcısı
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "meta_cloud", label: "Meta WhatsApp Cloud API", hint: "Üretim — gerçek gönderim" },
              { value: "mock",       label: "Mock (Test)",             hint: "Gerçek gönderim yapmaz" },
            ].map(p => (
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

        {/* Meta yapılandırması */}
        <div className="p-5 space-y-4 bg-blue-50/30">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5" /> Meta Cloud API Yapılandırması
          </p>

          {settings.env_fallback_configured && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ✓ Vercel env yedeği mevcut (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID) — aşağıdaki alanlar boşsa o kullanılır.
              Buradan girilen değerler önceliklidir ve redeploy gerektirmez.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Access Token</label>
            <input
              type="password"
              value={token}
              onChange={e => { setToken(e.target.value); setSaved(false); }}
              placeholder={settings.has_token ? "••••••••  (kayıtlı — değiştirmek için yeni token girin)" : "EAA… ile başlayan token"}
              className={`${INPUT} font-mono bg-white`}
            />
            {settings.has_token && (
              <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Token kayıtlı. Boş bırakırsanız mevcut korunur.
              </p>
            )}

            {/* 60 günlük token'a çevirme — Business Verification gerektirmez */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={extendToken}
                disabled={exchanging}
                title="Kısa süreli (24 saat) token'ı Meta'nın resmi akışıyla 60 günlük token'a çevirir ve kaydeder"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-all shadow-sm disabled:opacity-50"
              >
                {exchanging ? "Uzatılıyor…" : "🔁 60 Güne Uzat"}
              </button>
              <span className="text-[10px] text-slate-400">
                Alana taze kısa token yapıştırıp uzatın — günlük yenileme derdi biter (gereksinim: Vercel&apos;de META_APP_ID + META_APP_SECRET)
              </span>
            </div>
            {exchangeMsg && (
              <p className={`text-[11px] mt-2 rounded-lg px-3 py-2 border ${
                exchangeMsg.ok
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-rose-700 bg-rose-50 border-rose-200"
              }`}>
                {exchangeMsg.ok ? "✅ " : "⚠️ "}{exchangeMsg.msg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Phone Number ID</label>
              <input
                value={settings.meta_phone_number_id}
                onChange={e => set("meta_phone_number_id", e.target.value)}
                placeholder="1161655077028973"
                className={`${INPUT} font-mono bg-white`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">WhatsApp Business Account ID</label>
              <input
                value={settings.meta_waba_id}
                onChange={e => set("meta_waba_id", e.target.value)}
                placeholder="27105844389100055"
                className={`${INPUT} font-mono bg-white`}
              />
            </div>
          </div>
        </div>

        {/* Platform test modu */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">Platform Test Modu</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Açıkken HİÇBİR acenteye gerçek mesaj gitmez; tüm kuyruk &ldquo;Test&rdquo; işaretlenir. Maliyet oluşmaz.
              </p>
            </div>
          </div>
          <Toggle checked={settings.test_mode} onChange={v => set("test_mode", v)} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/whatsapp-queue" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
          WhatsApp Kuyruğunu Görüntüle →
        </Link>
        <div className="flex items-center gap-2">
          <TestSendButton />
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-green-500 transition-all shadow-sm shadow-emerald-500/25 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : saved ? <><CheckCircle2 className="w-4 h-4" /> Kaydedildi</> : "Kaydet"}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 text-right">
        Test Gönder, <b>kayıtlı</b> yapılandırmayı kullanır — önce Kaydet&apos;e basın.
      </p>
    </div>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function WhatsAppSettingsPage() {
  const { role, loading: authLoading } = useAuth();
  const isSuperAdmin = role === "super_admin";

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
            <h1 className="text-xl font-bold text-slate-900">
              {isSuperAdmin ? "WhatsApp Platform Yönetimi" : "WhatsApp Bildirimleri"}
            </h1>
            <p className="text-sm text-slate-400">
              {isSuperAdmin
                ? "Meta Cloud API yapılandırması — yalnız platform yöneticisi görür"
                : "Günlük operasyon özetleri için bildirim tercihleri"}
            </p>
          </div>
        </div>
      </div>

      {authLoading ? (
        <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
      ) : isSuperAdmin ? (
        <PlatformView />
      ) : (
        <AgencyView />
      )}
    </div>
  );
}
