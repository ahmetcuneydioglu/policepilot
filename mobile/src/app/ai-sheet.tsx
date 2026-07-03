/**
 * /ai-sheet — SigortaOS AI, yarım-ekran native sheet (formSheet + detents).
 * Her yerden ✦ ile açılır: "AI bir sayfa değil, katman." Tam ekran hâli: (tabs)/ai.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type } from '@/lib/theme';
import AiChat from '@/components/AiChat';
import Icon from '@/components/Icon';

export default function AiSheetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerBadge}><Text style={{ fontSize: 15 }}>✨</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>SigortaOS AI</Text>
          <Text style={styles.headerSub}>Verilerinle konuşan asistanın</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Icon symbol="xmark" emoji="✕" size={13} color={Colors.secondary} weight="bold" />
        </TouchableOpacity>
      </View>
      <AiChat bottomInset={Math.max(insets.bottom, Spacing.sm)} keyboardOffset={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerBadge: { width: 34, height: 34, borderRadius: Radius.full, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.subhead, fontSize: 15 },
  headerSub: { ...Type.caption, fontSize: 11 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
});
