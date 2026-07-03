/**
 * ActionBtn — kart altı hızlı aksiyon butonu (Ara / WhatsApp / Detay / Poliçe).
 * Tek kaynak: renewals + muayene + gorevler'deki kopyaların birleşimi.
 * SF Symbols (iOS) + emoji fallback; basışta hafif haptic.
 */

import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/lib/theme';
import { tapHaptic } from '@/lib/haptics';
import Icon from '@/components/Icon';

type Props = {
  symbol: string;
  emoji: string;
  label: string;
  onPress: () => void;
  /** İkon + etiket vurgu rengi (örn. WhatsApp yeşili) */
  tint?: string;
  loading?: boolean;
};

export default function ActionBtn({ symbol, emoji, label, onPress, tint, loading }: Props) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => { tapHaptic(); onPress(); }}
      activeOpacity={0.7}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Icon symbol={symbol} emoji={emoji} size={14} color={tint ?? Colors.text} />
      )}
      <Text style={[styles.label, tint ? { color: tint } : null]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 9,
  },
  label: { fontSize: 11, fontWeight: '700', color: Colors.text },
});
