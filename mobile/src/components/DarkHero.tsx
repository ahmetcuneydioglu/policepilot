/**
 * src/components/DarkHero.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Figma redesign'ın ortak koyu glass hero başlığı. Her ekranın en üstüne konur;
 * kendi güvenli-alan üst boşluğunu yönetir (root'ta SafeAreaView top edge GEREKMEZ).
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
import { Spacing, Radius, Dark } from '@/lib/theme';

export default function DarkHero({
  title, subtitle, onBack, right, children, bg = Dark.hero,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  bg?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { backgroundColor: bg, paddingTop: insets.top + 12 }]}>
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
    </View>
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
