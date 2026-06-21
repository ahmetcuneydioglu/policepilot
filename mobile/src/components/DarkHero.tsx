/**
 * src/components/DarkHero.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Figma redesign'ın ortak koyu glass hero başlığı. Her ekranın en üstüne konur;
 * kendi güvenli-alan üst boşluğunu yönetir (root'ta SafeAreaView top edge GEREKMEZ).
 * Gerçek gradient → expo-linear-gradient; koyu hero üstünde light status bar.
 *
 * Kullanım:
 *   <View style={{ flex: 1, backgroundColor: Colors.background }}>
 *     <DarkHero title="Yenilemeler" subtitle="..." right={<...>}>
 *       {... hero içi glass pill/search/filter ...}
 *     </DarkHero>
 *     ... liste/içerik (açık gövde) ...
 *   </View>
 */

import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Spacing, Radius, Dark } from '@/lib/theme';

export default function DarkHero({
  title, subtitle, onBack, right, children, colors, bg,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  /** Hero gradient renkleri (en az 2). Verilmezse bg'den ya da koyu navy'den türetilir. */
  colors?: readonly [string, string, ...string[]];
  /** Tek renkli hero için kısayol (gradient verilmezse bg→[bg,bg]). */
  bg?: string;
}) {
  const insets = useSafeAreaInsets();
  const gradient: readonly [string, string, ...string[]] =
    colors ?? (bg ? [bg, bg] : [Dark.hero, Dark.heroDeep]);
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 12 }]}
    >
      <StatusBar style="light" />
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

/** Hero üzerindeki cam yüzeyler (pill/search/filter) için ortak stiller. */
export const heroGlass = {
  backgroundColor: Dark.glass,
  borderWidth: 1,
  borderColor: Dark.glassBorder,
};
export const heroGlassStrong = {
  backgroundColor: Dark.glassStrong,
  borderWidth: 1,
  borderColor: Dark.glassBorder,
};

const styles = StyleSheet.create({
  hero: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Dark.glass, borderWidth: 1, borderColor: Dark.glassBorder, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -3 },
  title: { color: Dark.textOnDark, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: Dark.subOnDark, fontSize: 13, marginTop: 2 },
});
