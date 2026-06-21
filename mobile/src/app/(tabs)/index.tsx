import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow, Dark } from '@/lib/theme';
import { useNotificationStore } from '@/lib/NotificationContext';
import { useProfile } from '@/lib/useProfile';
import { fetchOperationMetrics, OperationMetrics } from '@/lib/dashboard';
import { fetchUpcomingRenewals, filterByWindow } from '@/lib/renewals';
import { fetchTasks } from '@/lib/tasks';
import { apiGet } from '@/lib/api';
import { formatShortTRY, greetingTR, formatLongDateTR } from '@/lib/format';

const EMPTY: OperationMetrics = {
  yenilemeSayisi: 0, bekleyenTeklif: 0, bugunKesilen: 0, potansiyelKomisyon: 0,
  tahminiPrim: 0, buAyPrim: 0, buAyKomisyon: 0, aktifPolice: 0, donusum: 0, yeniTalep: 0,
};

type Home = {
  m: OperationMetrics;
  cal: { w3: number; w7: number; w15: number; w30: number; tahminiPrim: number };
  taskCount: number;
  waPending: number;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { unreadCount } = useNotificationStore();
  const { profile, agencyId } = useProfile();

  const [data, setData] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    const [m, renewals, tasks] = await Promise.all([
      fetchOperationMetrics(agencyId),
      fetchUpcomingRenewals(agencyId),
      fetchTasks(agencyId).catch(() => []),
    ]);
    let waPending = 0;
    try {
      const q = await apiGet<{ items: { status: string }[] }>('/api/whatsapp/queue?status=pending&limit=200');
      waPending = (q.items ?? []).length;
    } catch { /* yetki yoksa 0 */ }

    const w30Items = filterByWindow(renewals, 30);
    setData({
      m,
      cal: {
        w3: filterByWindow(renewals, 3).length,
        w7: filterByWindow(renewals, 7).length,
        w15: filterByWindow(renewals, 15).length,
        w30: w30Items.length,
        tahminiPrim: w30Items.reduce((s, i) => s + Number(i.premium ?? 0), 0),
      },
      taskCount: tasks.length,
      waPending,
    });
    setLoading(false);
  }, [agencyId]);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''));
  }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  function signOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const name = profile?.full_name?.trim()?.split(' ')[0] || email.split('@')[0] || 'Ahmet';
  const m = data?.m ?? EMPTY;
  const cal = data?.cal ?? { w3: 0, w7: 0, w15: 0, w30: 0, tahminiPrim: 0 };

  const pills = [
    { dot: Dark.dotRed,   value: String(m.yenilemeSayisi), label: 'Yenileme' },
    { dot: Dark.dotAmber, value: String(m.bekleyenTeklif),  label: 'Bekleyen' },
    { dot: Dark.dotGreen, value: String(m.yeniTalep),       label: 'Yeni' },
    { dot: Dark.dotMoney, value: formatShortTRY(m.potansiyelKomisyon), label: 'Komisyon', money: true },
  ];

  const tasks: { emoji: string; bg: string; title: string; count: number; badge: string; href: Href }[] = [
    { emoji: '🔄', bg: '#FEE2E2', title: 'Yenileme Takibi',    count: m.yenilemeSayisi, badge: Dark.dotRed,   href: '/(tabs)/renewals' },
    { emoji: '📋', bg: '#FEF3C7', title: 'Bekleyen Teklifler',  count: m.bekleyenTeklif,  badge: Dark.dotAmber, href: '/(tabs)/requests' },
    { emoji: '💬', bg: '#DCFCE7', title: 'WhatsApp Gönderimleri', count: data?.waPending ?? 0, badge: Dark.dotGreen, href: '/whatsapp' },
    { emoji: '✅', bg: '#E0E7FF', title: 'Görevler',            count: data?.taskCount ?? 0, badge: Colors.primary, href: '/gorevler' },
  ];

  const calRows = [
    { label: '3 gün içinde',  count: cal.w3,  color: Dark.dotRed },
    { label: '7 gün içinde',  count: cal.w7,  color: Dark.dotAmber },
    { label: '15 gün içinde', count: cal.w15, color: Colors.primary },
    { label: '30 gün içinde', count: cal.w30, color: Dark.dotGreen },
  ];
  const calMax = Math.max(1, cal.w30);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Koyu Hero (gradient) ─── */}
        <LinearGradient
          colors={[Dark.hero, Dark.heroDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroDate}>{formatLongDateTR()}</Text>
              <Text style={styles.heroGreet}>{greetingTR()}, {name} 👋</Text>
              <Text style={styles.heroSub}>Bugün seni bekleyen işler</Text>
            </View>
            <TouchableOpacity style={styles.heroIcon} onPress={() => router.push('/notifications')}>
              <Text style={styles.heroIconEmoji}>🔔</Text>
              {unreadCount > 0 && <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroIcon, { marginLeft: 8 }]} onPress={signOut}>
              <Text style={styles.heroIconEmoji}>⏻</Text>
            </TouchableOpacity>
          </View>

          {/* 4 glass pill */}
          <View style={styles.pillRow}>
            {pills.map((p) => (
              <View key={p.label} style={styles.pill}>
                <View style={[styles.pillDot, { backgroundColor: p.dot }]} />
                <Text style={[styles.pillValue, p.money && { fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>{p.value}</Text>
                <Text style={styles.pillLabel}>{p.label}</Text>
              </View>
            ))}
          </View>

          {/* Prim bar */}
          <View style={styles.primBar}>
            <View style={styles.primIcon}><Text style={{ fontSize: 16 }}>📈</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primLabel}>BU AY PRİM</Text>
              <Text style={styles.primValue}>{formatShortTRY(m.buAyPrim)} · Komisyon: {formatShortTRY(m.buAyKomisyon)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.primLabel}>Aktif Poliçe</Text>
              <Text style={styles.primPolice}>{m.aktifPolice}</Text>
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <View style={styles.body}>
            {/* Görev Merkezi */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>GÖREV MERKEZİ</Text>
              <Text style={styles.sectionRight}>{tasks.filter((t) => t.count > 0).length} aktif</Text>
            </View>
            <View style={styles.card}>
              {tasks.map((t, i) => (
                <TouchableOpacity key={t.title} style={[styles.taskRow, i < tasks.length - 1 && styles.taskBorder]} onPress={() => router.push(t.href)} activeOpacity={0.6}>
                  <View style={[styles.taskIcon, { backgroundColor: t.bg }]}><Text style={{ fontSize: 18 }}>{t.emoji}</Text></View>
                  <Text style={styles.taskTitle}>{t.title}</Text>
                  <View style={[styles.taskCount, { backgroundColor: t.badge }]}><Text style={styles.taskCountText}>{t.count}</Text></View>
                  <View style={styles.taskAc}><Text style={styles.taskAcText}>Aç ›</Text></View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Yenileme Takvimi */}
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionLabel}>YENİLEME TAKVİMİ</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/renewals')}><Text style={styles.sectionLink}>Tümünü Gör</Text></TouchableOpacity>
            </View>
            <View style={styles.card}>
              <View style={styles.calHead}>
                <View style={styles.calIcon}><Text style={{ fontSize: 16 }}>📅</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calTitle}>Bu Ay Yenilemeler</Text>
                  <Text style={styles.calSub}>{cal.w30} poliçe yenilenecek</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.calSub}>Tahmini Prim</Text>
                  <Text style={styles.calPrim}>{formatShortTRY(cal.tahminiPrim)}</Text>
                </View>
              </View>
              <View style={styles.calDivider} />
              {calRows.map((r) => (
                <View key={r.label} style={styles.calRow}>
                  <Text style={styles.calRowLabel}>{r.label}</Text>
                  <View style={styles.calTrack}>
                    <View style={[styles.calFill, { width: `${Math.round((r.count / calMax) * 100)}%`, backgroundColor: r.color }]} />
                  </View>
                  <Text style={[styles.calRowCount, { color: r.color }]}>{r.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Hero
  hero: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroDate: { color: Dark.subOnDark, fontSize: 12, fontWeight: '600' },
  heroGreet: { color: Dark.textOnDark, fontSize: 24, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  heroSub: { color: Dark.subOnDark, fontSize: 13, marginTop: 3 },
  heroIcon: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Dark.glass, borderWidth: 1, borderColor: Dark.glassBorder, alignItems: 'center', justifyContent: 'center' },
  heroIconEmoji: { fontSize: 17 },
  heroBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Dark.dotRed, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Dark.hero },
  heroBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  pillRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.lg },
  pill: { flex: 1, backgroundColor: Dark.glass, borderWidth: 1, borderColor: Dark.glassBorder, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  pillValue: { color: Dark.textOnDark, fontSize: 20, fontWeight: '800' },
  pillLabel: { color: Dark.subOnDark, fontSize: 11, marginTop: 2 },

  primBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Dark.glassStrong, borderWidth: 1, borderColor: Dark.glassBorder, borderRadius: Radius.lg, padding: Spacing.md, marginTop: 10 },
  primIcon: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: 'rgba(52,211,153,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  primLabel: { color: Dark.subOnDark, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  primValue: { color: Dark.textOnDark, fontSize: 15, fontWeight: '800', marginTop: 2 },
  primPolice: { color: Dark.dotMoney, fontSize: 18, fontWeight: '800', marginTop: 2 },

  // Body
  body: { padding: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionLabel: { ...Type.label },
  sectionRight: { ...Type.caption, color: Colors.secondary },
  sectionLink: { ...Type.caption, color: Colors.primary, fontWeight: '700' },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.md, overflow: 'hidden' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: Spacing.md },
  taskBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  taskIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskTitle: { ...Type.subhead, fontSize: 14, flex: 1 },
  taskCount: { minWidth: 26, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, marginRight: 8 },
  taskCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  taskAc: { backgroundColor: Colors.heading, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  taskAcText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  calHead: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  calIcon: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  calTitle: { ...Type.subhead, fontSize: 14 },
  calSub: { ...Type.caption, marginTop: 1 },
  calPrim: { ...Type.subhead, fontSize: 15, color: Colors.primary, marginTop: 1 },
  calDivider: { height: 1, backgroundColor: Colors.border },
  calRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: Spacing.md },
  calRowLabel: { ...Type.caption, color: Colors.text, width: 92 },
  calTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: Colors.surface, overflow: 'hidden', marginHorizontal: 10 },
  calFill: { height: '100%', borderRadius: 4 },
  calRowCount: { fontSize: 13, fontWeight: '800', width: 24, textAlign: 'right' },
});
