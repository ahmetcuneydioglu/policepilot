/**
 * Ayarlar Merkezi — bölüm/kategori konfigürasyonu.
 * Hem SettingsNav (sol menü) hem settings/page.tsx (içerik router) bunu kullanır.
 * Tek doğruluk kaynağı: bölüm ekle/çıkar burada yapılır.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Building2, Network, Users, UserCog, Megaphone,
  FileText, ShieldCheck, MessageCircle, Mail, MessageSquare, Bot,
  Workflow, KeyRound, History, CreditCard, Gauge, Receipt, Webhook,
  TrendingUp,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type SectionKey =
  | "genel"
  | "sirket" | "subeler" | "kullanicilar" | "personel-performansi"
  | "musteri-ayarlari" | "lead-kaynaklari"
  | "teklif-ayarlari" | "police-ayarlari"
  | "whatsapp" | "email" | "sms"
  | "ai-asistanlar" | "otomasyonlar"
  | "roller" | "giris-gecmisi"
  | "paketim" | "kullanim-limitleri" | "faturalar"
  | "api-anahtarlari" | "webhooklar";

export interface SectionDef {
  key:    SectionKey;
  label:  string;
  Icon:   LucideIcon;
  /** Gerekli yetki — yoksa herkese görünür. */
  perm?:  PermissionKey;
  /** Altyapısı henüz yok → "Yakında" boş-durum. */
  soon?:  boolean;
}

export interface SectionGroup {
  group: string;
  items: SectionDef[];
}

export const SETTINGS_GROUPS: SectionGroup[] = [
  {
    group: "Genel",
    items: [{ key: "genel", label: "Genel Bakış", Icon: LayoutDashboard }],
  },
  {
    group: "Organizasyon",
    items: [
      { key: "sirket",       label: "Şirket Bilgileri", Icon: Building2 },
      { key: "subeler",      label: "Şubeler",          Icon: Network, soon: true },
      { key: "kullanicilar", label: "Kullanıcılar",     Icon: Users, perm: "users.manage" },
      { key: "personel-performansi", label: "Personel Performansı", Icon: TrendingUp, perm: "users.manage" },
    ],
  },
  {
    group: "Müşteri Yönetimi",
    items: [
      { key: "musteri-ayarlari", label: "Müşteri Ayarları", Icon: UserCog,   soon: true },
      { key: "lead-kaynaklari",  label: "Lead Kaynakları",  Icon: Megaphone, soon: true },
    ],
  },
  {
    group: "Teklif & Poliçe",
    items: [
      { key: "teklif-ayarlari", label: "Teklif Ayarları", Icon: FileText,    soon: true },
      { key: "police-ayarlari", label: "Poliçe Ayarları", Icon: ShieldCheck, soon: true },
    ],
  },
  {
    group: "İletişim",
    items: [
      { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle, perm: "settings.manage" },
      { key: "email",    label: "E-posta",  Icon: Mail,          soon: true },
      { key: "sms",      label: "SMS",      Icon: MessageSquare, soon: true },
    ],
  },
  {
    group: "Yapay Zeka",
    items: [
      { key: "ai-asistanlar", label: "AI Asistanlar", Icon: Bot,      soon: true },
      { key: "otomasyonlar",  label: "Otomasyonlar",  Icon: Workflow, soon: true },
    ],
  },
  {
    group: "Güvenlik",
    items: [
      { key: "roller",        label: "Roller & Yetkiler", Icon: KeyRound, perm: "users.manage" },
      { key: "giris-gecmisi", label: "Giriş Geçmişi",     Icon: History,  perm: "users.manage" },
    ],
  },
  {
    group: "Abonelik",
    items: [
      { key: "paketim",           label: "Paketim",          Icon: CreditCard },
      { key: "kullanim-limitleri", label: "Kullanım Limitleri", Icon: Gauge },
      { key: "faturalar",         label: "Faturalar",        Icon: Receipt },
    ],
  },
  {
    group: "Entegrasyonlar",
    items: [
      { key: "api-anahtarlari", label: "API Anahtarları", Icon: KeyRound, soon: true },
      { key: "webhooklar",      label: "Webhooklar",      Icon: Webhook,  soon: true },
    ],
  },
];

/** Düz liste (key → tanım araması için). */
export const ALL_SECTIONS: SectionDef[] = SETTINGS_GROUPS.flatMap((g) => g.items);
export const DEFAULT_SECTION: SectionKey = "genel";
