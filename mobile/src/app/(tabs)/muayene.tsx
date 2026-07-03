import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, Type, Shadow, Dark, renewalUrgency } from '@/lib/theme';
import DarkHero, { heroGlass } from '@/components/DarkHero';
import { useProfile } from '@/lib/useProfile';
import ActionBtn from '@/components/ActionBtn';
import SwipeRow from '@/components/SwipeRow';
import {
  fetchUpcomingInspections, filterByWindow, buildCallUrl, buildInspectionWhatsappUrl,
  InspectionItem, InspectionWindow,
} from '@/lib/inspections';

const SEGMENTS: { key: InspectionWindow; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 30, label: '30 Gün' },
  { key: 60, label: '60 Gün' },
  { key: 90, label: '90 Gün' },
  { key: 'overdue', label: 'Geçmiş' },
];

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MuayeneScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();

  const [items, setItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<InspectionWindow>('all');

  const load = useCallback(async () => {
    const data = await fetchUpcomingInspections(agencyId);
    setItems(data);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(() => filterByWindow(items, segment), [items, segment]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SEGMENTS) m[String(s.key)] = filterByWindow(items, s.key).length;
    return m;
  }, [items]);

  function call(item: InspectionItem) {
    if (!item.customerPhone) return Alert.alert('Telefon yok', 'Bu müşteride kayıtlı telefon yok.');
    Linking.openURL(buildCallUrl(item.customerPhone)).catch(() => {});
  }
  function whatsapp(item: InspectionItem) {
    if (!item.customerPhone) return Alert.alert('Telefon yok', 'WhatsApp için telefon gerekli.');
    Linking.openURL(buildInspectionWhatsappUrl(item)).catch(() =>
      Alert.alert('WhatsApp açılamadı', 'Cihazda WhatsApp yüklü olmayabilir.')
    );
  }
  function detay(item: InspectionItem) {
    router.push({ pathname: '/customer/[id]', params: { id: item.id } });
  }

  return (
    <View style={styles.safe}>
      <DarkHero
        title="Araç Muayeneleri"
        subtitle="Muayene takvimi & hatırlatma"
        right={
          <View style={[styles.primPill, heroGlass]}>
            <Text style={styles.primLabel}>TAKİPTE</Text>
            <Text style={styles.primValue}>{items.length}</Text>
          </View>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segScroll}
          contentContainerStyle={styles.segRow}
        >
          {SEGMENTS.map((s) => {
            const active = segment === s.key;
            return (
              <TouchableOpacity
                key={String(s.key)}
                style={[styles.chip, heroGlass, active && styles.chipActive]}
                onPress={() => setSegment(s.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                <View style={[styles.chipCount, active && styles.chipCountActive]}>
                  <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                    {counts[String(s.key)] ?? 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </DarkHero>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + Spacing.md }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🚗</Text>
              <Text style={styles.emptyTitle}>Bu aralıkta muayene yok</Text>
              <Text style={styles.emptySub}>Müşteri detayından muayene tarihi ekleyebilirsin.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const u = renewalUrgency(item.daysLeft);
            return (
              <SwipeRow onCall={() => call(item)} onWhatsapp={() => whatsapp(item)}>
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: u.bg }]}>
                    <Text style={[styles.avatarText, { color: u.text }]}>{initials(item.customerName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.customerName}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.vehiclePlate ? `${item.vehiclePlate} · ` : ''}Muayene: {fmtDate(item.muayene_bitis)}
                    </Text>
                    {item.muayeneTahmini && (
                      <Text style={styles.tahmini} numberOfLines={1}>~ tahmini · müşteriyle teyit edin</Text>
                    )}
                  </View>
                  <View style={[styles.badge, { backgroundColor: u.bg }]}>
                    <View style={[styles.badgeDot, { backgroundColor: u.dot }]} />
                    <Text style={[styles.badgeText, { color: u.text }]}>{u.label}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <ActionBtn symbol="phone.fill" emoji="📞" label="Ara" onPress={() => call(item)} />
                  <ActionBtn symbol="message.fill" emoji="💬" label="WhatsApp" tint="#25D366" onPress={() => whatsapp(item)} />
                  <ActionBtn symbol="person.fill" emoji="👤" label="Detay" tint={Colors.primary} onPress={() => detay(item)} />
                </View>
              </View>
              </SwipeRow>
            );
          }}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  primPill: { alignItems: 'flex-end', borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  primLabel: { fontSize: 9, fontWeight: '700', color: Dark.subOnDark, letterSpacing: 0.6 },
  primValue: { fontSize: 18, fontWeight: '800', color: Dark.textOnDark },

  segScroll: { maxHeight: 48, flexGrow: 0, marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
  segRow: { paddingHorizontal: Spacing.lg, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.full, paddingHorizontal: 14, height: 34 },
  chipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { ...Type.caption, color: Dark.subOnDark },
  chipTextActive: { color: Dark.hero },
  chipCount: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.full, minWidth: 20, paddingHorizontal: 5, height: 18, alignItems: 'center', justifyContent: 'center' },
  chipCountActive: { backgroundColor: 'rgba(15,23,42,0.12)' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: Dark.textOnDark },
  chipCountTextActive: { color: Dark.hero },

  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 12, ...Shadow.md },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  name: { ...Type.subhead },
  meta: { ...Type.caption, marginTop: 2 },
  tahmini: { fontSize: 10, color: '#B45309', fontWeight: '700', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', marginTop: Spacing.md, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 9 },
  actionEmoji: { fontSize: 14 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: Colors.text },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { ...Type.subhead },
  emptySub: { ...Type.caption, marginTop: 4, textAlign: 'center' },
});
