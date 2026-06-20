import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useNotificationStore } from '@/lib/NotificationContext';
import { useProfile } from '@/lib/useProfile';
import { fetchOperationMetrics, OperationMetrics } from '@/lib/dashboard';
import { formatShortTRY, greetingTR, formatLongDateTR } from '@/lib/format';

const CARD_WIDTH = (Dimensions.get('window').width - Spacing.lg * 2 - 12) / 2;

const EMPTY: OperationMetrics = {
  yenilemeSayisi: 0, bekleyenTeklif: 0, bugunKesilen: 0, potansiyelKomisyon: 0,
  tahminiPrim: 0, buAyPrim: 0, buAyKomisyon: 0, aktifPolice: 0, donusum: 0, yeniTalep: 0,
};

export default function DashboardScreen() {
  const router = useRouter();
  const { unreadCount } = useNotificationStore();
  const { profile, agencyId } = useProfile();

  const [metrics, setMetrics] = useState<OperationMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    const m = await fetchOperationMetrics(agencyId);
    setMetrics(m);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const name = profile?.full_name?.trim() || email.split('@')[0] || 'Ahmet';

  // Bugün yapılacaklar (aksiyona yönlendiren hero satırları)
  const todos = [
    { dot: '🔴', value: String(metrics.yenilemeSayisi), label: 'Yenileme Takibi',     onPress: () => router.push('/(tabs)/renewals') },
    { dot: '🟡', value: String(metrics.bekleyenTeklif),  label: 'Bekleyen Teklif',      onPress: () => router.push('/(tabs)/requests') },
    { dot: '🟢', value: String(metrics.bugunKesilen),    label: 'Bugün Kesilen Poliçe', onPress: () => router.push('/(tabs)/policies') },
    { dot: '💰', value: formatShortTRY(metrics.potansiyelKomisyon), label: 'Potansiyel Komisyon', onPress: () => router.push('/(tabs)/renewals') },
  ];

  // Canlı kartlar
  const cards = [
    { label: 'BU AY PRİM',    value: formatShortTRY(metrics.buAyPrim),     accent: Colors.primary },
    { label: 'BU AY KOMİSYON', value: formatShortTRY(metrics.buAyKomisyon), accent: Colors.success },
    { label: 'AKTİF POLİÇE',  value: String(metrics.aktifPolice),          accent: Colors.heading },
    { label: 'BEKLEYEN TEKLİF', value: String(metrics.bekleyenTeklif),     accent: Colors.warning },
    { label: 'DÖNÜŞÜM ORANI', value: `%${metrics.donusum}`,                accent: Colors.primary },
    { label: 'YENİ TALEP',    value: String(metrics.yeniTalep),            accent: Colors.danger },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingTR()} {name} 👋</Text>
            <Text style={styles.date}>{formatLongDateTR()}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Text style={styles.iconEmoji}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={handleSignOut}>
            <Text style={styles.iconEmoji}>⏻</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* Bugün Yapılacaklar */}
            <Text style={styles.sectionLabel}>BUGÜN YAPILACAKLAR</Text>
            <View style={styles.todoCard}>
              {todos.map((t, i) => (
                <TouchableOpacity
                  key={t.label}
                  style={[styles.todoRow, i < todos.length - 1 && styles.todoRowBorder]}
                  onPress={t.onPress}
                  activeOpacity={0.6}
                >
                  <Text style={styles.todoDot}>{t.dot}</Text>
                  <Text style={styles.todoValue}>{t.value}</Text>
                  <Text style={styles.todoLabel}>{t.label}</Text>
                  <Text style={styles.todoChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Canlı Kartlar */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>CANLI DURUM</Text>
            <View style={styles.grid}>
              {cards.map((c, i) => (
                <View key={c.label} style={[styles.statCard, i % 2 === 0 ? { marginRight: 12 } : {}]}>
                  <Text style={styles.statLabel}>{c.label}</Text>
                  <Text style={[styles.statValue, { color: c.accent }]} numberOfLines={1} adjustsFontSizeToFit>
                    {c.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { ...Type.title },
  date: { ...Type.caption, marginTop: 2, textTransform: 'capitalize' },
  iconBtn: {
    width: 42, height: 42, borderRadius: Radius.md,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 18 },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.danger, borderRadius: 9, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: Colors.background,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },

  // Bugün Yapılacaklar
  todoCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.md, overflow: 'hidden' },
  todoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: Spacing.md },
  todoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  todoDot: { fontSize: 18, width: 28 },
  todoValue: { ...Type.title, fontSize: 20, minWidth: 64 },
  todoLabel: { ...Type.body, flex: 1, color: Colors.text },
  todoChevron: { fontSize: 24, color: Colors.placeholder, fontWeight: '300' },

  // Canlı kartlar
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCard: {
    width: CARD_WIDTH, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 12, ...Shadow.sm,
  },
  statLabel: { ...Type.label, fontSize: 10, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
});
