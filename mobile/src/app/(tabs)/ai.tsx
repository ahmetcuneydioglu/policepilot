/**
 * (tabs)/ai — SigortaOS AI tam ekranı (Daha menüsünden).
 * Sohbet gövdesi paylaşılan: components/AiChat (aynısı /ai-sheet'te yarım ekran).
 */

import { View, Text, StyleSheet } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors, Radius } from '@/lib/theme';
import DarkHero, { heroGlass } from '@/components/DarkHero';
import AiChat from '@/components/AiChat';

export default function AiScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  return (
    <View style={styles.safe}>
      <DarkHero
        colors={['#5B3AAE', '#241845']}
        title="SigortaOS AI"
        subtitle="Verilerinle konuşan asistanın"
        right={<View style={styles.heroBadge}><Text style={styles.heroBadgeEmoji}>✨</Text></View>}
      />
      <AiChat bottomInset={tabBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  heroBadge: { ...heroGlass, width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  heroBadgeEmoji: { fontSize: 18 },
});
