/**
 * Uygulama kilidi — Face ID / Touch ID (expo-local-authentication).
 * Tercih AsyncStorage'da (sır değil, sadece açık/kapalı bayrağı).
 * Native modül eski build'de yoksa güvenli tarafta kalır: kilit devreye girmez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sigortaos.appLockEnabled';

function mod(): any | null {
  try {
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {}
}

/** Cihazda biyometri kurulu ve kullanılabilir mi? (Face ID/Touch ID/passcode) */
export async function biometricsAvailable(): Promise<boolean> {
  const la = mod();
  if (!la) return false;
  try {
    const hw = await la.hasHardwareAsync();
    const enrolled = await la.isEnrolledAsync();
    return !!hw && !!enrolled;
  } catch {
    return false;
  }
}

/** Kilidi açmayı dene. Modül yoksa true döner (kullanıcıyı kilitleme). */
export async function unlockWithBiometrics(): Promise<boolean> {
  const la = mod();
  if (!la) return true;
  try {
    const res = await la.authenticateAsync({
      promptMessage: 'SigortaOS kilidini aç',
      cancelLabel: 'Vazgeç',
      // Face ID yoksa cihaz şifresine düşsün — acente kilitli kalmasın
      disableDeviceFallback: false,
    });
    return !!res?.success;
  } catch {
    return true; // beklenmedik native hata → fail-open (kilitleme)
  }
}
