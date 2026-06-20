import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/lib/theme';
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
  const [role, setRole]         = useState<'super_admin' | 'agency_user' | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) { setRole(null); setAgencyId(null); return; }
    (supabase.from('profiles') as any)
      .select('role, agency_id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }: { data: { role: 'super_admin' | 'agency_user'; agency_id: string | null } | null }) => {
        if (data) { setRole(data.role); setAgencyId(data.agency_id); }
      });
  }, [session?.user?.id]);

  return { role, agencyId };
}

// ─── Root Layout içeriği (Provider altında) ────────────────────────────────────
function RootLayoutInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const segments = useSegments();
  const { role, agencyId } = useSessionProfile(session);

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
    const inAuth = segments[0] === 'login';
    if (!session && !inAuth) router.replace('/login');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading, segments]);

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
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-request"             options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/notifications"  options={{ presentation: 'card' }} />
        <Stack.Screen name="notifications"           options={{ presentation: 'modal' }} />
        <Stack.Screen name="customer/[id]"           options={{ presentation: 'card' }} />
        <Stack.Screen name="whatsapp"                options={{ presentation: 'card' }} />
        <Stack.Screen name="evraklar"                options={{ presentation: 'card' }} />
        <Stack.Screen name="gorevler"                options={{ presentation: 'card' }} />
        <Stack.Screen name="performans"              options={{ presentation: 'card' }} />
        <Stack.Screen name="raporlar"                options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

// ─── Root Layout (Provider wrapper) ───────────────────────────────────────────
export default function RootLayout() {
  return (
    <NotificationProvider>
      <RootLayoutInner />
    </NotificationProvider>
  );
}
