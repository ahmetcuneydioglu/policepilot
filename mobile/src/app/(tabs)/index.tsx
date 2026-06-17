import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { useNotificationStore } from '@/lib/NotificationContext';

const CARD_WIDTH = (Dimensions.get('window').width - 48 - 12) / 2;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';

type Stats = {
  totalCustomers: number;
  newRequests: number;
  expiringPolicies: number;
  activePolicies: number;
};

export default function DashboardScreen() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    newRequests: 0,
    expiringPolicies: 0,
    activePolicies: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const router = useRouter();
  const { unreadCount } = useNotificationStore();

  async function fetchStats() {
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const [customersRes, requestsRes, policiesRes, expiringRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'Yeni'),
      supabase.from('policies').select('id', { count: 'exact', head: true }).eq('status', 'Aktif'),
      supabase
        .from('policies')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Aktif')
        .gte('end_date', today.toISOString().split('T')[0])
        .lte('end_date', in30Days.toISOString().split('T')[0]),
    ]);

    setStats({
      totalCustomers: customersRes.count ?? 0,
      newRequests: requestsRes.count ?? 0,
      activePolicies: policiesRes.count ?? 0,
      expiringPolicies: expiringRes.count ?? 0,
    });
  }

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserName(user.email.split('@')[0]);
    }
  }

  useEffect(() => {
    fetchStats();
    fetchUser();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }

  async function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  const statCards = [
    { label: 'Müşteriler', value: stats.totalCustomers, color: Colors.primary, bg: Colors.primaryLight, emoji: '👥' },
    { label: 'Yeni Talepler', value: stats.newRequests, color: Colors.warning, bg: '#FFFBEB', emoji: '📋' },
    { label: 'Aktif Poliçe', value: stats.activePolicies, color: Colors.success, bg: '#F0FDF4', emoji: '✅' },
    { label: '30 Günde Bitiyor', value: stats.expiringPolicies, color: Colors.danger, bg: '#FEF2F2', emoji: '⚠️' },
  ];

  const quickActions = [
    { label: 'Müşteri Ekle', emoji: '➕', color: Colors.primary, onPress: () => router.push('/(tabs)/customers') },
    { label: 'Teklif Talebi', emoji: '📋', color: Colors.warning, onPress: () => router.push('/new-request') },
    { label: 'Poliçe Ekle', emoji: '📄', color: Colors.success, onPress: () => router.push('/(tabs)/policies') },
    { label: 'WhatsApp', emoji: '💬', color: '#25D366', onPress: () => Linking.openURL('whatsapp://') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Merhaba, {userName || 'Kullanıcı'} 👋</Text>
            <Text style={styles.appTitle}>SigortaOS</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.signOutBtn, { marginRight: 8 }]}
              onPress={() => router.push('/notifications')}
            >
              <View>
                <Text style={styles.signOutText}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Çıkış</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.date}>
          {new Date().toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {statCards.map((card, i) => (
            <View
              key={card.label}
              style={[styles.statCard, { backgroundColor: card.bg }, i % 2 === 0 ? { marginRight: 12 } : {}]}
            >
              <Text style={styles.statEmoji}>{card.emoji}</Text>
              <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionCard, i % 2 === 0 ? { marginRight: 12 } : {}]}
                onPress={action.onPress}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                  <Text style={styles.actionEmoji}>{action.emoji}</Text>
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Expiring alert */}
        {stats.expiringPolicies > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(tabs)/policies')}
            activeOpacity={0.8}
          >
            <Text style={styles.alertEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {stats.expiringPolicies} poliçe 30 gün içinde bitiyor
              </Text>
              <Text style={styles.alertSub}>Poliçeler ekranına git →</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  greeting: { fontSize: 14, color: Colors.secondary },
  appTitle: { fontSize: 26, fontWeight: '800', color: Colors.heading, letterSpacing: -0.5 },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  bellBadge: {
    position: 'absolute', top: -6, right: -8,
    backgroundColor: Colors.danger,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  date: { fontSize: 13, color: Colors.secondary, marginBottom: Spacing.lg, textTransform: 'capitalize' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.lg },
  statCard: { width: CARD_WIDTH, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'flex-start', marginBottom: 12 },
  statEmoji: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  statLabel: { fontSize: 12, color: Colors.secondary, marginTop: 2, fontWeight: '500' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.heading, marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  actionCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading, textAlign: 'center' },
  alertBanner: {
    backgroundColor: '#FEF9C3',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  alertEmoji: { fontSize: 28, marginRight: 12 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  alertSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
});
