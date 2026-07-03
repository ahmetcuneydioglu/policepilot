import { Appearance } from 'react-native';

/**
 * Tema: çift palet, AÇILIŞTA sistem temasına göre seçilir.
 * Tüm StyleSheet'ler modül yüklenirken Colors'ı yakaladığından, seçim burada
 * (ilk import anında) yapılınca bütün uygulama otomatik doğru paleti alır.
 * Canlı geçiş yok (v1): sistem teması değişirse yeni tema uygulama yeniden
 * açılınca uygulanır. app.json userInterfaceStyle: 'automatic' olmalı.
 */
export const isDarkMode = Appearance.getColorScheme() === 'dark';

const LightColors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  background: '#F5F7FB',
  card: '#FFFFFF',
  surface: '#F9FAFB',
  heading: '#111827',
  text: '#374151',
  secondary: '#6B7280',
  placeholder: '#9CA3AF',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  border: '#E5E7EB',
  primaryLight: '#EFF6FF',
  // Yumuşak tint arka planlar (rozet/satır vurguları)
  dangerBg: '#FEF2F2',
  warningBg: '#FFFBEB',
  amberBg: '#FEF9C3',
  successBg: '#F0FDF4',
  infoBg: '#EFF6FF',
};

// Marka lacivertiyle uyumlu koyu palet (slate-navy)
const DarkColors: typeof LightColors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  background: '#0B1322',
  card: '#141F33',
  surface: '#1C2942',
  heading: '#F1F5F9',
  text: '#C7D2E4',
  secondary: '#8CA0BF',
  placeholder: '#5D6F8C',
  success: '#34D17A',
  warning: '#F5B441',
  danger: '#F2555A',
  border: '#243553',
  primaryLight: '#1B2E55',
  dangerBg: '#3A1D22',
  warningBg: '#3A2E17',
  amberBg: '#39301A',
  successBg: '#16301F',
  infoBg: '#1B2E55',
};

export const Colors = isDarkMode ? DarkColors : LightColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// ─── Koyu glass hero paleti (Figma redesign — koyu hero + açık gövde) ─────────
export const Dark = {
  hero: '#13253F',          // koyu navy (beyaz çip/buton üstü METİN rengi olarak da kullanılır)
  heroTop: '#244B86',       // gradient ÜST tonu (belirgin mavi-navy)
  heroDeep: '#0A1626',      // gradient ALT tonu (derin navy)
  glass: 'rgba(255,255,255,0.07)',     // hero üstü cam kartlar
  glassStrong: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.14)',
  textOnDark: '#FFFFFF',
  subOnDark: 'rgba(255,255,255,0.62)',
  // aksan noktaları (özet pill'leri)
  dotRed: '#F2555A',
  dotAmber: '#F5B441',
  dotGreen: '#34D17A',
  dotMoney: '#34D399',
};

// ─── Tipografi ölçeği (premium, tutarlı) ─────────────────────────────────────
export const Type = {
  display: { fontSize: 28, fontWeight: '800', lineHeight: 34, color: Colors.heading },
  title:   { fontSize: 22, fontWeight: '800', lineHeight: 28, color: Colors.heading },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 22, color: Colors.heading },
  subhead: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: Colors.heading },
  body:    { fontSize: 14, fontWeight: '500', lineHeight: 20, color: Colors.text },
  caption: { fontSize: 12, fontWeight: '600', lineHeight: 16, color: Colors.secondary },
  // Bölüm başlığı etiketi (UPPERCASE, harf aralıklı)
  label:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: Colors.secondary },
} as const;

// ─── Yumuşak gölge / elevation presetleri ────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

// ─── Yenileme aciliyet rengi (dashboard + yenilemeler + poliçeler ortak) ──────
export type UrgencyLevel = 'overdue' | 'critical' | 'soon' | 'upcoming' | 'safe';

export function renewalUrgency(daysLeft: number): {
  level: UrgencyLevel;
  bg: string;
  text: string;
  dot: string;
  label: string;
} {
  if (daysLeft < 0) {
    return { level: 'overdue',  bg: Colors.dangerBg,  text: Colors.danger,  dot: Colors.danger,  label: `${Math.abs(daysLeft)} gün geçti` };
  }
  if (daysLeft <= 3) {
    return { level: 'critical', bg: Colors.dangerBg,  text: Colors.danger,  dot: Colors.danger,  label: daysLeft === 0 ? 'Bugün bitiyor' : `${daysLeft} gün kaldı` };
  }
  if (daysLeft <= 7) {
    return { level: 'soon',     bg: Colors.warningBg, text: isDarkMode ? '#F5B441' : '#D97706', dot: '#F59E0B', label: `${daysLeft} gün kaldı` };
  }
  if (daysLeft <= 15) {
    return { level: 'upcoming', bg: Colors.amberBg,   text: isDarkMode ? '#EAB308' : '#CA8A04', dot: '#EAB308', label: `${daysLeft} gün kaldı` };
  }
  if (daysLeft <= 30) {
    return { level: 'upcoming', bg: Colors.amberBg,   text: isDarkMode ? '#EAB308' : '#CA8A04', dot: '#EAB308', label: `${daysLeft} gün kaldı` };
  }
  return { level: 'safe', bg: Colors.successBg, text: Colors.success, dot: Colors.success, label: `${daysLeft} gün kaldı` };
}
