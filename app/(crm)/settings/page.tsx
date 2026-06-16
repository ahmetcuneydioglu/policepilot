"use client";

/**
 * Ayarlar Merkezi — modern SaaS ayar deneyimi (HubSpot/Linear/Stripe dili).
 * Sol kategori-navigasyonu + sağ içerik. Aktif bölüm ?s= query ile (deep-link + geri).
 * Bilgi mimarisi components/settings/sections.ts'te; gerçek bölümler tam çalışır,
 * altyapısı olmayanlar şık "Yakında" gösterir.
 */

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import TeamManagement from "@/components/TeamManagement";
import SettingsNav from "@/components/settings/SettingsNav";
import ComingSoon from "@/components/settings/ComingSoon";
import GeneralOverview from "@/components/settings/GeneralOverview";
import CompanyProfile from "@/components/settings/CompanyProfile";
import RolesMatrix from "@/components/settings/RolesMatrix";
import WhatsAppSection from "@/components/settings/WhatsAppSection";
import SubscriptionSection from "@/components/settings/SubscriptionSection";
import InvoicesSection from "@/components/settings/InvoicesSection";
import LoginHistory from "@/components/settings/LoginHistory";
import { ALL_SECTIONS, DEFAULT_SECTION, type SectionKey } from "@/components/settings/sections";

const SOON_DESC: Partial<Record<SectionKey, string>> = {
  subeler:           "Birden fazla şube/ofis tanımlayıp kullanıcılarınızı şubelere göre organize edin.",
  "musteri-ayarlari": "Müşteri alanları, etiketler ve varsayılan tercihleri özelleştirin.",
  "lead-kaynaklari": "Lead'lerin nereden geldiğini takip edin ve kaynak bazlı raporlayın.",
  "teklif-ayarlari": "Teklif şablonları, varsayılan teminatlar ve onay akışlarını yapılandırın.",
  "police-ayarlari": "Poliçe numaralandırma, yenileme hatırlatma süreleri ve otomasyonlar.",
  email:             "E-posta ile müşteri bildirimleri ve pazarlama gönderimleri.",
  sms:               "SMS ile hatırlatma ve bilgilendirme gönderimleri.",
  "ai-asistanlar":   "Lead analizi, müşteri özeti, poliçe önerileri ve satış asistanı yapay zeka araçları.",
  otomasyonlar:      "Tetikleyici tabanlı otomatik iş akışları kurun.",
  "api-anahtarlari": "Kendi sistemlerinizi PolicePilot'a bağlamak için API anahtarları.",
  webhooklar:        "Olay tabanlı bildirimleri kendi sunucunuza iletin.",
};

function SettingsCenter() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useAuth();

  const requested = (params.get("s") as SectionKey) || DEFAULT_SECTION;
  const def = ALL_SECTIONS.find((s) => s.key === requested) ?? ALL_SECTIONS[0];
  // Yetki yoksa veya geçersiz bölümse Genel'e düş
  const active: SectionKey = def.perm && !can(def.perm) ? DEFAULT_SECTION : def.key;
  const activeDef = ALL_SECTIONS.find((s) => s.key === active)!;

  const go = (key: SectionKey) => router.push(`/settings?s=${key}`, { scroll: false });

  function renderContent() {
    if (activeDef.soon) {
      return <ComingSoon title={activeDef.label} Icon={activeDef.Icon} description={SOON_DESC[active] ?? "Bu bölüm yakında kullanıma açılacak."} />;
    }
    switch (active) {
      case "genel":              return <GeneralOverview onNavigate={go} can={can} />;
      case "sirket":             return <CompanyProfile />;
      case "kullanicilar":       return <TeamManagement embedded />;
      case "roller":             return <RolesMatrix />;
      case "whatsapp":           return <WhatsAppSection />;
      case "paketim":            return <SubscriptionSection focus="plan" />;
      case "kullanim-limitleri": return <SubscriptionSection focus="usage" />;
      case "faturalar":          return <InvoicesSection />;
      case "giris-gecmisi":      return <LoginHistory />;
      default:                   return <ComingSoon title={activeDef.label} Icon={activeDef.Icon} description="Bu bölüm yakında kullanıma açılacak." />;
    }
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-md">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ayarlar</h1>
          <p className="text-sm text-slate-400">Şirketinizi, ekibinizi ve tercihlerinizi yönetin</p>
        </div>
      </div>

      {/* İki-pane */}
      <div className="flex flex-col lg:flex-row gap-5">
        <SettingsNav active={active} onSelect={go} can={can} />
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <activeDef.Icon className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-bold text-slate-800">{activeDef.label}</h2>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />}>
      <SettingsCenter />
    </Suspense>
  );
}
