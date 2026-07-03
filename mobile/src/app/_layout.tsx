import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { subscribePhoneVerified } from '@/lib/securityState';
import { FEATURES } from '@/lib/features';
import { View, Text, TouchableOpacity, ActivityIndicator, AppState, Appearance, StyleSheet, Image } from 'react-native';
import { reloadAppAsync } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryProvider } from '@/lib/query';
import { Colors, isDarkMode } from '@/lib/theme';
import { isAppLockEnabled, unlockWithBiometrics } from '@/lib/appLock';
import { useQuickActionsSetup } from '@/lib/quickActions';
import {
  configureNotificationHandler,
  setupNotifications,
  sendLocalNotification,
  clearBadge,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '@/lib/notifications';
import { useRealtimeRequests } from '@/lib/realtime';
import {
  NotificationProvider,
  useNotificationStore,
} from '@/lib/NotificationContext';

// Handler modül yüklenince kur (defensive — crash yapmaz)
configureNotificationHandler();

// ─── Canlı tema geçişi ─────────────────────────────────────────────────────────
// Palet, modül yüklenirken seçilir (theme.ts) — sistem teması app açıkken
// değişirse JS'i yeniden başlatarak (~1sn) yeni paleti uygularız.
// iOS arka plan snapshot'ları sahte tetikleme yapar → yalnız uygulama AKTİFKEN
// ve 400ms sonra hâlâ farklıysa reload edilir.
function scheduleThemeReloadCheck() {
  setTimeout(() => {
    const nowDark = Appearance.getColorScheme() === 'dark';
    if (nowDark !== isDarkMode && AppState.currentState === 'active') {
      reloadAppAsync().catch(() => {});
    }
  }, 400);
}
Appearance.addChangeListener(scheduleThemeReloadCheck);
AppState.addEventListener('change', (s) => { if (s === 'active') scheduleThemeReloadCheck(); });

// ─── Realtime + push kurulumunu yöneten iç component ──────────────────────────
// NotificationProvider içinde olduğu için context'e yazabilir.
function NotificationSetup({
  session,
  role,
  agencyId,
}: {
  session: Session | null;
  role: 'super_admin' | 'agency_user' | null;
  agencyId: string | null;
}) {
  const router = useRouter();
  const { addNotification } = useNotificationStore();
  const [badgeCount, setBadgeCount] = useState(0);

  // Push token kurulumu (login sonrası 1 kez)
  useEffect(() => {
    if (!session?.user) return;
    setupNotifications(session.user.id, agencyId).catch(console.warn);
  }, [session?.user?.id, agencyId]);

  // Notification listeners
  useEffect(() => {
    const removeReceived = addNotificationReceivedListener(() => {
      setBadgeCount((c) => c + 1);
    });

    const removeResponse = addNotificationResponseListener((_response: any) => {
      clearBadge();
      setBadgeCount(0);
      router.push('/(tabs)/requests');
    });

    return () => { removeReceived(); removeResponse(); };
  }, [router]);

  // Realtime: yeni talep → context + local bildirim
  useRealtimeRequests({
    role,
    agencyId,
    enabled: !!session,
    onNewRequest: async (req, customerName, customerPhone) => {
      // Context'e ekle (tab badge + geçmiş için)
      addNotification({
        id: req.id,
        requestType: req.request_type,
        customerName,
        customerPhone,
        agencyId: req.agency_id,
        createdAt: req.created_at,
      });

      // Local push notification
      const newBadge = badgeCount + 1;
      setBadgeCount(newBadge);
      await sendLocalNotification({
        title: '📋 Yeni Teklif Talebi',
        body: `${customerName} — ${req.request_type}`,
        badge: newBadge,
        data: {
          requestId: req.id,
          customerId: req.customer_id,
          requestType: req.request_type,
          customerName,
          customerPhone,
        },
      });
    },
    onRequestUpdated: (req) => {
      if (req.status !== 'Yeni Lead') {
        setBadgeCount((c) => Math.max(0, c - 1));
      }
    },
  });

  return null;
}

// ─── Profile hook ──────────────────────────────────────────────────────────────
function useSessionProfile(session: Session | null) {
  const [role, setRole]                   = useState<'super_admin' | 'agency_user' | null>(null);
  const [agencyId, setAgencyId]           = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) { setRole(null); setAgencyId(null); setVerifiedPhone(null); return; }
    (supabase.from('profiles') as any)
      .select('role, agency_id, verified_phone')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }: { data: { role: 'super_admin' | 'agency_user'; agency_id: string | null; verified_phone: boolean | null } | null; error: unknown }) => {
        // migration öncesi / sorgu hatası → fail-open (kimseyi kilitleme)
        if (error || !data) { setVerifiedPhone(true); return; }
        setRole(data.role);
        setAgencyId(data.agency_id);
        setVerifiedPhone(data.verified_phone ?? true);
      });
  }, [session?.user?.id]);

  // Telefon doğrulanınca anında aç (DB'yi yeniden çekmeden gate'i geçir)
  useEffect(() => subscribePhoneVerified(() => setVerifiedPhone(true)), []);

  return { role, agencyId, verifiedPhone };
}

// ─── Uygulama kilidi (Face ID / Touch ID) ──────────────────────────────────────
// Oturum varken: soğuk açılışta + arka plandan dönüşte kilit ister.
function AppLockOverlay({ hasSession }: { hasSession: boolean }) {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const wentBackground = useRef(false);

  async function tryUnlock() {
    if (busy) return;
    setBusy(true);
    const ok = await unlockWithBiometrics();
    setBusy(false);
    if (ok) setLocked(false);
  }

  // Soğuk açılış: kilit açıksa kilitle + hemen Face ID iste
  useEffect(() => {
    if (!hasSession) { setLocked(false); return; }
    let alive = true;
    isAppLockEnabled().then((on) => {
      if (alive && on) { setLocked(true); setTimeout(tryUnlock, 350); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  // Arka plana gidiş → dönüşte yeniden kilitle
  useEffect(() => {
    if (!hasSession) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') { wentBackground.current = true; return; }
      if (state === 'active' && wentBackground.current) {
        wentBackground.current = false;
        if (await isAppLockEnabled()) { setLocked(true); setTimeout(tryUnlock, 350); }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  if (!locked) return null;
  return (
    <View style={lockStyles.wrap}>
      <Image source={require('../../assets/images/logo.png')} style={lockStyles.logo} resizeMode="contain" />
      <Text style={lockStyles.title}>SigortaOS Kilitli</Text>
      <Text style={lockStyles.sub}>Devam etmek için kimliğini doğrula.</Text>
      <TouchableOpacity style={lockStyles.btn} onPress={tryUnlock} activeOpacity={0.85} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={lockStyles.btnText}>🔓 Kilidi Aç</Text>}
      </TouchableOpacity>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E1836',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 999,
  },
  logo: { width: 76, height: 76, borderRadius: 20, marginBottom: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9FB4DE', fontSize: 14, marginTop: 6, marginBottom: 24 },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ─── Root Layout içeriği (Provider altında) ────────────────────────────────────
function RootLayoutInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const segments = useSegments();
  const { role, agencyId, verifiedPhone } = useSessionProfile(session);
  useQuickActionsSetup(); // app icon basılı-tut kısayolları (Tara/Ara/Yenilemeler/AI)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    if (!session) { if (seg0 !== 'login' && seg0 !== 'register') router.replace('/login'); return; }
    if (FEATURES.phoneOtpGate) {                              // v1.0'da kapalı — bkz. features.ts
      if (verifiedPhone === null) return;                     // profil yüklenene kadar bekle
      if (verifiedPhone === false) {                          // telefon doğrulanmamış → kapı
        if (seg0 !== 'verify-phone') router.replace('/verify-phone');
        return;
      }
    }
    if (seg0 === 'login' || seg0 === 'verify-phone') router.replace('/(tabs)');
  }, [session, loading, segments, verifiedPhone]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NotificationSetup session={session} role={role} agencyId={agencyId} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-phone" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-request"             options={{ presentation: 'modal' }} />
        <Stack.Screen name="search"                  options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="ai-sheet"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.72, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="settings/notifications"  options={{ presentation: 'card' }} />
        <Stack.Screen name="notifications"           options={{ presentation: 'modal' }} />
        <Stack.Screen name="customer/[id]"           options={{ presentation: 'card' }} />
        <Stack.Screen name="whatsapp"                options={{ presentation: 'card' }} />
        <Stack.Screen name="evraklar"                options={{ presentation: 'card' }} />
        <Stack.Screen name="gorevler"                options={{ presentation: 'card' }} />
        <Stack.Screen name="performans"              options={{ presentation: 'card' }} />
        <Stack.Screen name="raporlar"                options={{ presentation: 'card' }} />
        <Stack.Screen name="quote-center"            options={{ presentation: 'card' }} />
        <Stack.Screen name="quote-run/[id]"          options={{ presentation: 'card' }} />
      </Stack>
      <AppLockOverlay hasSession={!!session} />
    </>
  );
}

// ─── Root Layout (Provider wrapper) ───────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <NotificationProvider>
          <RootLayoutInner />
        </NotificationProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
