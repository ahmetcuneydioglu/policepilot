/**
 * SwipeRow — liste kartına hızlı kaydırma aksiyonları.
 * Sağa kaydır → 📞 Ara · Sola kaydır → 💬 WhatsApp (iOS Mail deseni).
 * Eşik aşılınca aksiyon TETİKLENİR ve satır kapanır (açık bırakmaz) + haptic.
 */

import { useRef, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Colors, Radius } from '@/lib/theme';
import { pressHaptic } from '@/lib/haptics';
import Icon from '@/components/Icon';

type Props = {
  children: ReactNode;
  onCall?: () => void;
  onWhatsapp?: () => void;
};

export default function SwipeRow({ children, onCall, onWhatsapp }: Props) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={onCall ? () => (
        <View style={[styles.action, styles.call]}>
          <Icon symbol="phone.fill" emoji="📞" size={20} color="#fff" />
          <Text style={styles.actionText}>Ara</Text>
        </View>
      ) : undefined}
      renderRightActions={onWhatsapp ? () => (
        <View style={[styles.action, styles.wa]}>
          <Icon symbol="message.fill" emoji="💬" size={20} color="#fff" />
          <Text style={styles.actionText}>WhatsApp</Text>
        </View>
      ) : undefined}
      onSwipeableWillOpen={(direction) => {
        pressHaptic();
        ref.current?.close();
        if (direction === 'left') onCall?.();
        else onWhatsapp?.();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  call: { backgroundColor: Colors.primary, marginRight: 8 },
  wa: { backgroundColor: '#25D366', marginLeft: 8 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
