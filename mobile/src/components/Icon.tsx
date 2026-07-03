/**
 * Icon — SF Symbols (iOS) + emoji fallback (Android/eski build).
 * HIG: tab bar ve aksiyonlarda emoji yerine gerçek sembol kullanılır.
 * expo-symbols native modülü yoksa (eski dev build) emoji'ye düşer — crash yok.
 */

import { Text } from 'react-native';

type Props = {
  /** SF Symbol adı (örn. "house.fill", "phone.fill") */
  symbol: string;
  /** Android / fallback emoji */
  emoji: string;
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

function symbolView(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-symbols').SymbolView;
  } catch {
    return null;
  }
}

const SymbolView = symbolView();

export default function Icon({ symbol, emoji, size = 20, color, weight = 'semibold' }: Props) {
  const fallback = <Text style={{ fontSize: size * 0.88 }}>{emoji}</Text>;
  if (!SymbolView) return fallback;
  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      fallback={fallback}
    />
  );
}
