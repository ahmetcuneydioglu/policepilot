import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Linking,
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
import { fetchUpcomingRenewals, filterByWindow, buildRenewalWhatsappUrl, RenewalItem } from '@/lib/renewals';
import { fetchTasks, Task } from '@/lib/tasks';
import { apiGet } from '@/lib/api';
import { formatShortTRY, greetingTR, formatLongDateTR } from '@/lib/format';

const EMPTY: OperationMetrics = {
  yenilemeSayisi: 0, bekleyenTeklif: 0, bugunKesilen: 0, potansiyelKomisyon: 0,
  tahminiPrim: 0, buAyPrim: 0, buAyKomisyon: 0, gecenAyPrim: 0, gecenAyKomisyon: 0,
  aktifPolice: 0, donusum: 0, yeniTalep: 0,
};

type Home = {
  m: OperationMetrics;
  renewals: RenewalItem[];
  tasks: Task[];
  waPending: number;
  cal: { w3: number; w7: number; w15: number; w30: number; tahminiPrim: number };
};

type Priority = {
  emoji: string;
  tint: string;
  label: string;
  sub: string;
  onPress: () => void;
  action?: { label: string; onPress: () => void };
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
      fetchTasks(agencyId).catch(() => [] as Task[]),
    ]);
    let waPending = 0;
    try {
      const q = await apiGet<{ items: { status: string }[] }>('/api/whatsapp/queue?status=pending&limit=200');
      waPending = (q.items ?? []).length;
    } catch { /* yetki yoksa 0 */ }

    const w30Items = filterByWindow(renewals, 30);
    setData({
      m, renewals, tasks, waPending,
      cal: {
        w3: filterByWindow(renewals, 3).length,
        w7: filterByWindow(renewals, 7).length,
        w15: filterByWindow(renewals, 15).length,
        w30: w30Items.length,
        tahminiPrim: w30Items.reduce((s, i) => s + Number(i.premium ?? 0), 0),
      },
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
  const renewals = data?.renewals ?? [];
  const tasks = data?.tasks ?? [];

  // ── #1 Bugünün önceliği — en acil tek iş + tek aksiyon ──────────────────────
  const overdue = renewals.filter((r) => r.daysLeft < 0);
  const within7 = renewals.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7);
  const pendingTask = tasks.find((t) => t.kind === 'lead' || t.kind === 'followup') ?? null;
  const dayLabel = (d: number) => (d < 0 ? `${Math.abs(d)} gün gecikti` : d === 0 ? 'bugün' : `${d} gün`);

  function buildPriority(): Priority {
    if (overdue.length) {
      const r = overdue[0];
      return {
        emoji: '⏰', tint: Dark.dotRed,
        label: `${overdue.length} poliçe süresi geçmiş`,
        sub: `en acil: ${r.customerName} · ${dayLabel(r.daysLeft)}`,
        onPress: () => router.push('/(tabs)/renewals'),
        action: { label: 'Hatırlat', onPress: () => Linking.openURL(buildRenewalWhatsappUrl(r)) },
      };
    }
    if (within7.length) {
      const r = within7[0];
      return {
        emoji: '⏰', tint: Dark.dotRed,
        label: `${within7.length} poliçe 7 gün içinde bitiyor`,
        sub: `en yakın: ${r.customerName} · ${dayLabel(r.daysLeft)}`,
        onPress: () => router.push('/(tabs)/renewals'),
        action: { label: 'Hatırlat', onPress: () => Linking.openURL(buildRenewalWhatsappUrl(r)) },
      };
    }
    if (m.bekleyenTeklif > 0) {
      return {
        emoji: '📋', tint: Dark.dotAmber,
        label: `${m.bekleyenTeklif} bekleyen teklif`,
        sub: pendingTask ? `${pendingTask.title} · ${pendingTask.subtitle.split(' · ')[0]}` : 'Satış hattında takip bekliyor',
        onPress: () => router.push('/(tabs)/requests'),
        action: { label: 'Aç', onPress: () => router.push('/(tabs)/requests') },
      };
    }
    if (m.yeniTalep > 0) {
      return {
        emoji: '📥', tint: Dark.dotGreen,
        label: `${m.yeniTalep} yeni talep`,
        sub: 'İlk temas bekliyor',
        onPress: () => router.push('/(tabs)/requests'),
        action: { label: 'Aç', onPress: () => router.push('/(tabs)/requests') },
      };
    }
    return {
      emoji: '✅', tint: Dark.dotGreen,
      label: 'Bugün için acil iş yok',
      sub: 'Her şey kontrol altında',
      onPress: () => router.push('/(tabs)/renewals'),
    };
  }
  const priority = buildPriority();

  // ── #2 Para kartı — bu-aya-göre trend + geçen ay kıyas ──────────────────────
  const trendPct = m.gecenAyPrim > 0 ? Math.round(((m.buAyPrim - m.gecenAyPrim) / m.gecenAyPrim) * 100) : null;
  const trendUp = (trendPct ?? 0) >= 0;
  const lastMonthBar = m.gecenAyPrim > 0 ? Math.min(100, Math.round((m.buAyPrim / m.gecenAyPrim) * 100)) : null;

  // ── #4 Hızlı aksiyonlar ─────────────────────────────────────────────────────
  const quickActions: { emoji: string; bg: string; label: string; href: Href }[] = [
    { emoji: '⚡', bg: '#EFF6FF', label: 'Teklif Al', href: '/(tabs)/teklif' },
    { emoji: '👤', bg: '#F0FDF4', label: 'Müşteri',  href: '/(tabs)/customers' },
    { emoji: '📄', bg: '#FEF3C7', label: 'Poliçe',   href: '/(tabs)/policies' },
    { emoji: '💬', bg: '#DCFCE7', label: 'WhatsApp', href: '/whatsapp' },
  ];

  // ── #3 Görev Merkezi — tekrarsız + mini önizleme ────────────────────────────
  const topRenewal = renewals[0] ?? null;
  const taskRows: { emoji: string; bg: string; title: string; sub: string | null; count: number; badge: string; href: Href }[] = [
    { emoji: '🔄', bg: '#FEE2E2', title: 'Yenileme Takibi', count: m.yenilemeSayisi, badge: Dark.dotRed,   href: '/(tabs)/renewals',
      sub: topRenewal ? `${topRenewal.customerName} · ${dayLabel(topRenewal.daysLeft)}` : null },
    { emoji: '📋', bg: '#FEF3C7', title: 'Bekleyen Teklifler', count: m.bekleyenTeklif, badge: Dark.dotAmber, href: '/(tabs)/requests',
      sub: pendingTask ? `${pendingTask.title} · ${pendingTask.subtitle.split(' · ')[0]}` : null },
    { emoji: '💬', bg: '#DCFCE7', title: 'WhatsApp Gönderimleri', count: data?.waPending ?? 0, badge: Dark.dotGreen, href: '/whatsapp',
      sub: (data?.waPending ?? 0) > 0 ? `${data?.waPending} mesaj kuyrukta` : null },
    { emoji: '✅', bg: '#E0E7FF', title: 'Görevler', count: tasks.length, badge: Colors.primary, href: '/gorevler',
      sub: tasks[0] ? tasks[0].title : null },
  ];

  // ── #5 Yenileme hunisi — tıklanabilir ───────────────────────────────────────
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
          colors={[Dark.heroTop, Dark.heroDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroDate}>{formatLongDateTR()}</Text>
              <Text style={styles.heroGreet}>{greetingTR()}, {name} 👋</Text>
            </View>
            <TouchableOpacity style={styles.heroIcon} onPress={() => router.push('/notifications')}>
              <Text style={styles.heroIconEmoji}>🔔</Text>
              {unreadCount > 0 && <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroIcon, { marginLeft: 8 }]} onPress={signOut}>
              <Text style={styles.heroIconEmoji}>⏻</Text>
            </TouchableOpacity>
          </View>

          {/* #1 Bugünün önceliği */}
          <TouchableOpacity style={styles.priority} onPress={priority.onPress} activeOpacity={0.85}>
            <View style={[styles.priorityIcon, { backgroundColor: priority.tint + '26' }]}>
              <Text style={{ fontSize: 20 }}>{priority.emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.priorityKicker}>BUGÜNÜN ÖNCELİĞİ</Text>
              <Text style={styles.priorityLabel} numberOfLines={1}>{priority.label}</Text>
              <Text style={styles.prioritySub} numberOfLines={1}>{priority.sub}</Text>
            </View>
            {priority.action && (
              <TouchableOpacity style={styles.priorityAction} onPress={priority.action.onPress} activeOpacity={0.8}>
                <Text style={styles.priorityActionText}>{priority.action.label}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <View style={styles.body}>
            {/* #2 Para kartı */}
            <View style={styles.moneyCard}>
              <View style={styles.moneyHead}>
                <Text style={styles.moneyKicker}>BU AY</Text>
                {trendPct !== null && (
                  <View style={[styles.trendChip, { backgroundColor: trendUp ? Colors.successBg : Colors.dangerBg }]}>
                    <Text style={[styles.trendText, { color: trendUp ? Colors.success : Colors.danger }]}>
                      {trendUp ? '↑' : '↓'} %{Math.abs(trendPct)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.moneyRow}>
                <Text style={styles.moneyValue}>{formatShortTRY(m.buAyPrim)}</Text>
                <Text style={styles.moneyUnit}>prim</Text>
              </View>
              {lastMonthBar !== null && (
                <View style={styles.moneyTrack}>
                  <View style={[styles.moneyFill, { width: `${lastMonthBar}%` }]} />
                </View>
              )}
              <View style={styles.moneyMeta}>
                <Text style={styles.moneyMetaText}>Komisyon {formatShortTRY(m.buAyKomisyon)} · Dönüşüm %{m.donusum}</Text>
                {m.gecenAyPrim > 0 && <Text style={styles.moneyMetaText}>Geçen ay {formatShortTRY(m.gecenAyPrim)}</Text>}
              </View>
              {m.potansiyelKomisyon > 0 && (
                <TouchableOpacity style={styles.potRow} onPress={() => router.push('/(tabs)/renewals')} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14 }}>💰</Text>
                  <Text style={styles.potText}>Yenilemelerden potansiyel komisyon: <Text style={styles.potValue}>{formatShortTRY(m.potansiyelKomisyon)}</Text></Text>
                </TouchableOpacity>
              )}
            </View>

            {/* #4 Hızlı aksiyonlar */}
            <View style={styles.quickRow}>
              {quickActions.map((a) => (
                <TouchableOpacity key={a.label} style={styles.quickItem} onPress={() => router.push(a.href)} activeOpacity={0.7}>
                  <View style={[styles.quickIcon, { backgroundColor: a.bg }]}><Text style={{ fontSize: 22 }}>{a.emoji}</Text></View>
                  <Text style={styles.quickLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* #3 Görev Merkezi */}
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionLabel}>GÖREV MERKEZİ</Text>
              <Text style={styles.sectionRight}>{taskRows.filter((t) => t.count > 0).length} aktif</Text>
            </View>
            <View style={styles.card}>
              {taskRows.map((t, i) => (
                <TouchableOpacity key={t.title} style={[styles.taskRow, i < taskRows.length - 1 && styles.taskBorder]} onPress={() => router.push(t.href)} activeOpacity={0.6}>
                  <View style={[styles.taskIcon, { backgroundColor: t.bg }]}><Text style={{ fontSize: 18 }}>{t.emoji}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.taskTitle}>{t.title}</Text>
                    {t.sub && <Text style={styles.taskSub} numberOfLines={1}>{t.sub}</Text>}
                  </View>
                  <View style={[styles.taskCount, { backgroundColor: t.badge }]}><Text style={styles.taskCountText}>{t.count}</Text></View>
                  <Text style={styles.taskChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* #5 Yenileme hunisi */}
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionLabel}>YENİLEME HUNİSİ</Text>
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
                <TouchableOpacity key={r.label} style={styles.calRow} onPress={() => router.push('/(tabs)/renewals')} activeOpacity={0.6}>
                  <Text style={styles.calRowLabel}>{r.label}</Text>
                  <View style={styles.calTrack}>
                    <View style={[styles.calFill, { width: `${Math.round((r.count / calMax) * 100)}%`, backgroundColor: r.color }]} />
                  </View>
                  <Text style={[styles.calRowCount, { color: r.color }]}>{r.count}</Text>
                </TouchableOpacity>
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
  heroIcon: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Dark.glass, borderWidth: 1, borderColor: Dark.glassBorder, alignItems: 'center', justifyContent: 'center' },
  heroIconEmoji: { fontSize: 17 },
  heroBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Dark.dotRed, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Dark.hero },
  heroBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // #1 Priority
  priority: { flexDirection: 'row', alignItems: 'center', backgroundColor: Dark.glassStrong, borderWidth: 1, borderColor: Dark.glassBorder, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg },
  priorityIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  priorityKicker: { color: Dark.subOnDark, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  priorityLabel: { color: Dark.textOnDark, fontSize: 15, fontWeight: '800', marginTop: 2 },
  prioritySub: { color: Dark.subOnDark, fontSize: 12, marginTop: 2 },
  priorityAction: { backgroundColor: '#fff', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8 },
  priorityActionText: { color: Dark.hero, fontSize: 13, fontWeight: '800' },

  // Body
  body: { padding: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionLabel: { ...Type.label },
  sectionRight: { ...Type.caption, color: Colors.secondary },
  sectionLink: { ...Type.caption, color: Colors.primary, fontWeight: '700' },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.md, overflow: 'hidden' },

  // #2 Money
  moneyCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.md, padding: Spacing.md },
  moneyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moneyKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: Colors.secondary },
  trendChip: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  trendText: { fontSize: 11, fontWeight: '800' },
  moneyRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  moneyValue: { fontSize: 26, fontWeight: '800', color: Colors.heading, letterSpacing: -0.5 },
  moneyUnit: { fontSize: 13, color: Colors.secondary, marginLeft: 6 },
  moneyTrack: { height: 6, borderRadius: 4, backgroundColor: Colors.surface, overflow: 'hidden', marginTop: 10 },
  moneyFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
  moneyMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  moneyMetaText: { fontSize: 12, color: Colors.secondary, fontWeight: '500' },
  potRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  potText: { fontSize: 12, color: Colors.text, flex: 1 },
  potValue: { fontWeight: '800', color: Colors.success },

  // #4 Quick actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  quickItem: { alignItems: 'center', flex: 1 },
  quickIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 11, color: Colors.text, fontWeight: '600' },

  // #3 Task rows
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.md },
  taskBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  taskIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskTitle: { ...Type.subhead, fontSize: 14 },
  taskSub: { fontSize: 11, color: Colors.secondary, marginTop: 1 },
  taskCount: { minWidth: 26, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, marginRight: 6 },
  taskCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  taskChevron: { color: Colors.placeholder, fontSize: 20, fontWeight: '700', width: 14, textAlign: 'center' },

  // #5 Renewal funnel
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
