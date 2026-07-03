/**
 * Dokunsal geri bildirim — expo-haptics güvenli sarmalayıcı.
 * Native modül eski build'de yoksa sessizce no-op (notifications.ts kalıbı).
 * Kullanım: tap (hafif dokunuş), press (belirgin aksiyon), success/warning/error (sonuç).
 */

import { Platform } from 'react-native';

function mod(): any | null {
  try {
    return require('expo-haptics');
  } catch {
    return null;
  }
}

function safe(fn: (h: any) => Promise<void>) {
  if (Platform.OS === 'web') return;
  const h = mod();
  if (!h) return;
  fn(h).catch(() => {});
}

/** Hafif dokunuş — satır/kart seçimi, sekme, toggle. */
export function tapHaptic() {
  safe((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));
}

/** Belirgin aksiyon — FAB, birincil buton, çek-yenile tetiklenince. */
export function pressHaptic() {
  safe((h) => h.impactAsync(h.ImpactFeedbackStyle.Medium));
}

/** İşlem başarılı — kaydet, OCR tamam, gönderildi. */
export function successHaptic() {
  safe((h) => h.notificationAsync(h.NotificationFeedbackType.Success));
}

/** Dikkat — geri alınabilir/yıkıcı onay açılırken. */
export function warningHaptic() {
  safe((h) => h.notificationAsync(h.NotificationFeedbackType.Warning));
}

/** Hata — başarısız işlem. */
export function errorHaptic() {
  safe((h) => h.notificationAsync(h.NotificationFeedbackType.Error));
}
