/**
 * src/lib/notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Expo Push Notification helpers — native modül yoksa graceful degrade.
 *
 * ÖNEMLI: expo-notifications native kod gerektiriyor.
 * Çalışması için: npx expo run:ios --device  (dev client rebuild)
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Native modülün var olup olmadığını kontrol et ──────────────────────────
function isNotificationsAvailable(): boolean {
  try {
    // Bu import zaten module scope'ta; sadece erişim kontrolü
    require('expo-notifications');
    return true;
  } catch {
    return false;
  }
}

const AVAILABLE = isNotificationsAvailable();

function warn(msg: string) {
  if (!AVAILABLE) {
    console.warn(`[Notifications] Native modül yok — ${msg}\n` +
      '👉 Çözüm: npx expo run:ios --device  ile dev client rebuild et.');
  }
}

// ─── Notification handler kurulumu ──────────────────────────────────────────
export function configureNotificationHandler() {
  if (!AVAILABLE) { warn('handler kurulamıyor'); return; }
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[Notifications] Handler kurulum hatası:', err);
  }
}

// ─── Android kanal ───────────────────────────────────────────────────────────
export async function setupAndroidChannel(): Promise<void> {
  if (!AVAILABLE || Platform.OS !== 'android') return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SigortaOS Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
  } catch (err) {
    console.warn('[Notifications] Android kanal hatası:', err);
  }
}

// ─── İzin durumu ────────────────────────────────────────────────────────────
export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  if (!AVAILABLE) return 'unavailable';
  try {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'unavailable';
  }
}

// ─── İzin isteme ─────────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!AVAILABLE) { warn('izin istenemedi'); return false; }
  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');

    if (!Device.isDevice) {
      console.log('[Notifications] Simülatörde push token desteklenmiyor.');
      return false;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: false,
      },
    });
    return status === 'granted';
  } catch (err) {
    console.warn('[Notifications] İzin isteme hatası:', err);
    return false;
  }
}

// ─── Expo Push Token ─────────────────────────────────────────────────────────
export async function getExpoPushToken(): Promise<string | null> {
  if (!AVAILABLE) { warn('push token alınamadı'); return null; }
  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');
    const Constants = require('expo-constants').default;

    if (!Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenObj = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return tokenObj.data;
  } catch (err) {
    console.warn('[Notifications] Push token alınamadı:', err);
    return null;
  }
}

// ─── Native (APNs/FCM) device token — sunucu DOĞRUDAN APNs'e gönderir ────────
export async function getNativePushToken(): Promise<string | null> {
  if (!AVAILABLE) { warn('native push token alınamadı'); return null; }
  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');
    if (!Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const tokenObj = await Notifications.getDevicePushTokenAsync();
    // iOS: hex APNs token · Android: FCM token
    return typeof tokenObj?.data === 'string' ? tokenObj.data : null;
  } catch (err) {
    console.warn('[Notifications] Native push token alınamadı:', err);
    return null;
  }
}

// ─── Token → Supabase upsert ─────────────────────────────────────────────────
export async function registerPushToken(
  userId: string,
  agencyId: string | null,
  token: string
): Promise<void> {
  try {
    await (supabase.from('push_tokens') as any).upsert(
      {
        user_id: userId,
        agency_id: agencyId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );
  } catch (err) {
    console.warn('[Notifications] Token kaydedilemedi:', err);
  }
}

// ─── Token silme ─────────────────────────────────────────────────────────────
export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  try {
    await (supabase.from('push_tokens') as any)
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
  } catch (err) {
    console.warn('[Notifications] Token silinemedi:', err);
  }
}

// ─── Local notification gönder ───────────────────────────────────────────────
export async function sendLocalNotification(options: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}): Promise<string | null> {
  if (!AVAILABLE) { warn('local bildirim gönderilemedi'); return null; }
  try {
    const Notifications = require('expo-notifications');
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data ?? {},
        sound: 'default',
        badge: options.badge,
      },
      trigger: null,
    });
    return id;
  } catch (err) {
    console.warn('[Notifications] Local bildirim hatası:', err);
    return null;
  }
}

// ─── Badge temizle ───────────────────────────────────────────────────────────
export async function clearBadge(): Promise<void> {
  if (!AVAILABLE) return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.setBadgeCountAsync(0);
  } catch { /* sessizce geç */ }
}

// ─── Notification listener ekle ──────────────────────────────────────────────
export function addNotificationReceivedListener(
  handler: (notification: unknown) => void
): (() => void) {
  if (!AVAILABLE) return () => {};
  try {
    const Notifications = require('expo-notifications');
    const sub = Notifications.addNotificationReceivedListener(handler);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

// ─── Notification response listener ─────────────────────────────────────────
export function addNotificationResponseListener(
  handler: (response: unknown) => void
): (() => void) {
  if (!AVAILABLE) return () => {};
  try {
    const Notifications = require('expo-notifications');
    const sub = Notifications.addNotificationResponseReceivedListener(handler);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

// ─── Tam kurulum (login sonrası) ─────────────────────────────────────────────
export async function setupNotifications(
  userId: string,
  agencyId: string | null
): Promise<{ granted: boolean; token: string | null; available: boolean }> {
  if (!AVAILABLE) {
    warn('kurulum atlandı');
    return { granted: false, token: null, available: false };
  }

  await setupAndroidChannel();
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, token: null, available: true };

  // Doğrudan APNs mimarisi: native device token kaydedilir (Expo token değil).
  const token = await getNativePushToken();
  if (token) await registerPushToken(userId, agencyId, token);

  return { granted, token, available: true };
}
