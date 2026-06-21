export const Colors = {
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
  hero: '#13253F',          // hero ana koyu navy (gradient'in native modülle gelir)
  heroDeep: '#0E1B2E',      // gradient alt tonu (fake/solid için)
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
    return { level: 'soon',     bg: Colors.warningBg, text: '#D97706',      dot: '#F59E0B',      label: `${daysLeft} gün kaldı` };
  }
  if (daysLeft <= 15) {
    return { level: 'upcoming', bg: Colors.amberBg,   text: '#CA8A04',      dot: '#EAB308',      label: `${daysLeft} gün kaldı` };
  }
  if (daysLeft <= 30) {
    return { level: 'upcoming', bg: Colors.amberBg,   text: '#CA8A04',      dot: '#EAB308',      label: `${daysLeft} gün kaldı` };
  }
  return { level: 'safe', bg: Colors.successBg, text: Colors.success, dot: Colors.success, label: `${daysLeft} gün kaldı` };
}
