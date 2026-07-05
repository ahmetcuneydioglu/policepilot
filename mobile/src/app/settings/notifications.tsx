/**
 * src/app/settings/notifications.tsx
 * Bildirim Ayarları ekranı
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/lib/theme';
import {
  getPermissionStatus,
  requestNotificationPermission,
  getExpoPushToken,
  sendLocalNotification,
  clearBadge,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import * as Device from 'expo-device';

type PermStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'loading';

function StatusBadge({ status }: { status: PermStatus }) {
  const configs: Record<PermStatus, { bg: string; text: string; dot: string; label: string }> = {
    granted:      { bg: Colors.successBg, text: Colors.success,  dot: Colors.success,  label: '✓ İzin Verildi' },
    denied:       { bg: Colors.dangerBg, text: Colors.danger,   dot: Colors.danger,   label: '✕ İzin Reddedildi' },
    undetermined: { bg: Colors.amberBg, text: Colors.warning,       dot: '#EAB308',       label: 'İzin Bekleniyor' },
    unavailable:  { bg: '#F3F4F6', text: Colors.secondary, dot: '#9CA3AF',      label: 'Native Modül Yok' },
    loading:      { bg: Colors.background, text: Colors.secondary, dot: Colors.secondary, label: 'Kontrol ediliyor...' },
  };
  const cfg = configs[status] ?? configs.loading;
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [permStatus, setPermStatus]     = useState<PermStatus>('loading');
  const [pushToken, setPushToken]       = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [testSending, setTestSending]   = useState(false);
  const [savedCount, setSavedCount]     = useState<number | null>(null);
  const isDevice = Device.isDevice;

  const refresh = useCallback(async () => {
    const status = await getPermissionStatus();
    setPermStatus(status as PermStatus);
  }, []);

  const loadToken = useCallback(async () => {
    setTokenLoading(true);
    const token = await getExpoPushToken();
    setPushToken(token);
    setTokenLoading(false);
  }, []);

  const checkSavedTokens = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await (supabase.from('push_tokens') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setSavedCount(count ?? 0);
  }, []);

  useEffect(() => {
    refresh();
    loadToken();
    checkSavedTokens();
  }, [refresh, loadToken, checkSavedTokens]);

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission();
    setPermStatus(granted ? 'granted' : 'denied');
    if (granted) {
      await loadToken();
    } else {
      Alert.alert(
        'İzin Reddedildi',
        'Bildirim almak için Ayarlar > SigortaOS > Bildirimler yolundan izin verin.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async function handleTestNotification() {
    if (permStatus !== 'granted') {
      Alert.alert('İzin Gerekli', 'Önce bildirim iznini açmanız gerekiyor.');
      return;
    }
    setTestSending(true);
    await clearBadge();
    const id = await sendLocalNotification({
      title: '📋 Test Bildirimi',
      body: 'SigortaOS çalışıyor! Ahmet Yılmaz — Kasko',
      badge: 1,
      data: { test: true },
    });
    setTestSending(false);
    if (id) {
      Alert.alert('✅ Gönderildi', 'Test bildirimi az sonra görünecek.');
    } else {
      Alert.alert('❌ Gönderilemedi', 'Native modül henüz build edilmedi. Aşağıdaki komutu çalıştırın:\n\nnpx expo run:ios --device');
    }
  }

  const nativeAvailable = permStatus !== 'unavailable';
  const tokenShort = pushToken ? `${pushToken.slice(0, 34)}...` : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Native modül uyarısı */}
        {!nativeAvailable && (
          <View style={styles.buildWarning}>
            <Text style={styles.buildWarningTitle}>🔨 Dev Client Rebuild Gerekli</Text>
            <Text style={styles.buildWarningBody}>
              expo-notifications native modülü henüz derlenmemiş. Terminal'de şu komutu çalıştırın:
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>npx expo run:ios --device</Text>
            </View>
            <Text style={styles.buildWarningNote}>
              Realtime bildirimler (uygulama açıkken) şu an için devre dışı. Rebuild sonrası aktif olacak.
            </Text>
          </View>
        )}

        {/* İzin durumu */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bildirim İzni</Text>
          <View style={styles.permRow}>
            <StatusBadge status={permStatus} />
            {nativeAvailable && permStatus !== 'granted' && (
              <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission}>
                <Text style={styles.permBtnText}>İzin Ver</Text>
              </TouchableOpacity>
            )}
            {permStatus === 'denied' && (
              <TouchableOpacity
                style={[styles.permBtn, styles.permBtnDanger]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={[styles.permBtnText, { color: Colors.danger }]}>Ayarları Aç</Text>
              </TouchableOpacity>
            )}
          </View>
          {permStatus === 'granted' && (
            <Text style={styles.note}>Yeni teklif talebi geldiğinde anında bildirim alırsınız.</Text>
          )}
        </View>

        {/* Cihaz bilgisi */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cihaz</Text>
          <InfoRow label="Platform"       value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
          <InfoRow label="Gerçek Cihaz"   value={isDevice ? 'Evet ✓' : 'Simülatör'} />
          <InfoRow label="Native Modül"   value={nativeAvailable ? 'Yüklü ✓' : 'Build Gerekli ⚠'} />
          {!isDevice && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>Simülatörde push token alınamaz. Gerçek cihaz gerekli.</Text>
            </View>
          )}
        </View>

        {/* Push token */}
        {nativeAvailable && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.sectionTitle}>Expo Push Token</Text>
              {tokenLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>
            {tokenShort ? (
              <>
                <Text style={styles.tokenText}>{tokenShort}</Text>
                {savedCount !== null && (
                  <Text style={styles.note}>Supabase'de {savedCount} token kayıtlı</Text>
                )}
              </>
            ) : (
              <Text style={styles.note}>
                {isDevice
                  ? permStatus === 'granted'
                    ? 'Token alınamadı — EAS build gerekebilir.'
                    : 'Bildirim izni verilmeden token alınamaz.'
                  : 'Simülatörde token desteklenmiyor.'}
              </Text>
            )}
          </View>
        )}

        {/* Test */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Test</Text>
          <TouchableOpacity
            style={[styles.testBtn, (!nativeAvailable || testSending) && { opacity: 0.5 }]}
            onPress={handleTestNotification}
            disabled={testSending}
          >
            {testSending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.testBtnText}>🔔 Test Bildirimi Gönder</Text>
            }
          </TouchableOpacity>
          {!nativeAvailable && (
            <Text style={[styles.note, { marginTop: 8, textAlign: 'center' }]}>
              Test için önce rebuild gerekli
            </Text>
          )}
        </View>

        {/* Nasıl çalışır */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nasıl Çalışır?</Text>
          {[
            { icon: '📱', title: 'Uygulama Açıkken', desc: 'Supabase Realtime ile yeni talep anında algılanır ve local bildirim gösterilir.' },
            { icon: '🔒', title: 'Uygulama Kapalıyken', desc: 'Expo push token altyapısı hazır. Backend (Supabase Edge Function) push gönderebilir.' },
            { icon: '🎯', title: 'Agency Filtresi', desc: 'Yalnızca kendi acentenizin talepleri için bildirim alırsınız.' },
            { icon: '↗️', title: 'Bildirime Basınca', desc: 'Talepler ekranına yönlendirilirsiniz.' },
          ].map((item, i) => (
            <View key={i} style={[styles.howRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <Text style={styles.howIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.howTitle}>{item.title}</Text>
                <Text style={styles.howDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4, minWidth: 60 },
  backBtnText: { fontSize: 17, color: Colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.heading, flex: 1, textAlign: 'center' },
  content: { padding: Spacing.md, paddingBottom: 60 },

  buildWarning: {
    backgroundColor: Colors.amberBg,
    borderWidth: 1.5, borderColor: '#FDE047',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 14,
  },
  buildWarningTitle: { fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: 6 },
  buildWarningBody:  { fontSize: 13, color: '#78350F', lineHeight: 19, marginBottom: 10 },
  buildWarningNote:  { fontSize: 12, color: '#A16207', marginTop: 10, lineHeight: 17 },
  codeBox: { backgroundColor: '#1C1917', borderRadius: Radius.sm, padding: 12 },
  codeText: { color: '#86EFAC', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  note: { fontSize: 13, color: Colors.secondary, lineHeight: 18, marginTop: 8 },

  permRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 10, marginBottom: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  permBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, marginRight: 8, marginBottom: 6 },
  permBtnDanger: { backgroundColor: Colors.dangerBg },
  permBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, color: Colors.secondary },
  infoValue: { fontSize: 13, color: Colors.heading, fontWeight: '600' },
  warnBox: { backgroundColor: Colors.amberBg, borderRadius: Radius.sm, padding: 10, marginTop: 10 },
  warnText: { fontSize: 12, color: '#92400E', lineHeight: 17 },

  tokenText: { fontSize: 12, color: Colors.secondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8 },

  testBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  howRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  howIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  howTitle: { fontSize: 13, fontWeight: '700', color: Colors.heading, marginBottom: 3 },
  howDesc: { fontSize: 12, color: Colors.secondary, lineHeight: 17 },
});
