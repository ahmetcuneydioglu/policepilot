/**
 * /ai-sheet — SigortaOS AI, yarım-ekran native sheet (formSheet + detents).
 * Her yerden ✦ ile açılır: "AI bir sayfa değil, katman." Tam ekran hâli: (tabs)/ai.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/lib/theme';
import AiChat from '@/components/AiChat';
import Icon from '@/components/Icon';

export default function AiSheetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.safe}>
      {/* Başlık AiChat'in İÇİNDE render edilir — formSheet kök kardeşi ezip
          içeriği üstüne bindiriyordu (input bar'ın doğru durması iç kolonun
          sağlam olduğunu kanıtlıyor). */}
      <AiChat
        bottomInset={Math.max(insets.bottom, Spacing.sm)}
        keyboardOffset={0}
        header={
          <View style={styles.header}>
            <View style={styles.headerBadge}><Text style={{ fontSize: 15 }}>✨</Text></View>
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle} numberOfLines={1}>SigortaOS AI</Text>
              <Text style={styles.headerSub} numberOfLines={1}>Verilerinle konuşan asistanın</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Icon symbol="xmark" emoji="✕" size={13} color={Colors.secondary} weight="bold" />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    // paddingTop: native sheet grabber çubuğunun altında kalmasın
    paddingHorizontal: Spacing.lg, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  headerBadge: { width: 34, height: 34, borderRadius: Radius.full, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  headerTexts: { flex: 1, justifyContent: 'center' },
  // Tema spread'i yok: lineHeight'lar açık — üst üste binme olmaz
  headerTitle: { fontSize: 15, lineHeight: 19, fontWeight: '700', color: Colors.heading },
  headerSub: { fontSize: 11, lineHeight: 14, marginTop: 2, fontWeight: '500', color: Colors.secondary },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
});
