import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow, renewalUrgency } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { formatTRY, formatShortTRY } from '@/lib/format';
import {
  fetchUpcomingRenewals, filterByWindow, buildCallUrl, buildRenewalWhatsappUrl,
  RenewalItem, RenewalWindow,
} from '@/lib/renewals';

const SEGMENTS: { key: RenewalWindow; label: string }[] = [
  { key: 3, label: '3 Gün' },
  { key: 7, label: '7 Gün' },
  { key: 15, label: '15 Gün' },
  { key: 30, label: '30 Gün' },
  { key: 'overdue', label: 'Geçmiş' },
];

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function RenewalsScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();

  const [items, setItems] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<RenewalWindow>(30);

  const load = useCallback(async () => {
    const data = await fetchUpcomingRenewals(agencyId);
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
  const tahminiPrim = useMemo(
    () => filterByWindow(items, 30).reduce((s, i) => s + Number(i.premium ?? 0), 0),
    [items]
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SEGMENTS) m[String(s.key)] = filterByWindow(items, s.key).length;
    return m;
  }, [items]);

  function call(item: RenewalItem) {
    if (!item.customerPhone) return Alert.alert('Telefon yok', 'Bu müşteride kayıtlı telefon yok.');
    Linking.openURL(buildCallUrl(item.customerPhone)).catch(() => {});
  }
  function whatsapp(item: RenewalItem) {
    if (!item.customerPhone) return Alert.alert('Telefon yok', 'WhatsApp için telefon gerekli.');
    Linking.openURL(buildRenewalWhatsappUrl(item)).catch(() =>
      Alert.alert('WhatsApp açılamadı', 'Cihazda WhatsApp yüklü olmayabilir.')
    );
  }
  function teklif(item: RenewalItem) {
    router.push({
      pathname: '/new-request',
      params: { customerId: item.customer_id, productType: item.policy_type, renewalPolicyId: item.id },
    });
  }
  function policelestir(item: RenewalItem) {
    router.push({
      pathname: '/(tabs)/policies',
      params: { renewCustomerId: item.customer_id, renewPolicyType: item.policy_type, renewFromPolicyId: item.id },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Yenilemeler</Text>
          <Text style={styles.subtitle}>Para kazandıran ekran</Text>
        </View>
        <View style={styles.primPill}>
          <Text style={styles.primLabel}>TAHMİNİ PRİM</Text>
          <Text style={styles.primValue}>{formatShortTRY(tahminiPrim)}</Text>
        </View>
      </View>

      {/* Segment filtre */}
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
              style={[styles.chip, active && styles.chipActive]}
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

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>Bu aralıkta yenileme yok</Text>
              <Text style={styles.emptySub}>Başka bir gün penceresi seçebilirsin.</Text>
            </View>
          ) : (
            visible.map((item) => {
              const u = renewalUrgency(item.daysLeft);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, { backgroundColor: u.bg }]}>
                      <Text style={[styles.avatarText, { color: u.text }]}>{initials(item.customerName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{item.customerName}</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.policy_type}
                        {item.insurance_company ? ` · ${item.insurance_company}` : ''}
                        {item.premium ? ` · ${formatTRY(item.premium)}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: u.bg }]}>
                      <View style={[styles.badgeDot, { backgroundColor: u.dot }]} />
                      <Text style={[styles.badgeText, { color: u.text }]}>{u.label}</Text>
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <ActionBtn emoji="📞" label="Ara" onPress={() => call(item)} />
                    <ActionBtn emoji="💬" label="WhatsApp" tint="#25D366" onPress={() => whatsapp(item)} />
                    <ActionBtn emoji="📋" label="Teklif" onPress={() => teklif(item)} />
                    <ActionBtn emoji="⚡" label="Poliçe" tint={Colors.primary} onPress={() => policelestir(item)} />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionBtn({ emoji, label, onPress, tint }: { emoji: string; label: string; onPress: () => void; tint?: string }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={[styles.actionLabel, tint ? { color: tint } : null]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
  },
  title: { ...Type.title },
  subtitle: { ...Type.caption, marginTop: 2 },
  primPill: { alignItems: 'flex-end', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  primLabel: { fontSize: 9, fontWeight: '700', color: Colors.primary, letterSpacing: 0.6 },
  primValue: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },

  segScroll: { maxHeight: 48, flexGrow: 0 },
  segRow: { paddingHorizontal: Spacing.lg, gap: 8, paddingBottom: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.full, paddingHorizontal: 14, height: 34,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Type.caption, color: Colors.text },
  chipTextActive: { color: '#fff' },
  chipCount: { backgroundColor: Colors.surface, borderRadius: Radius.full, minWidth: 20, paddingHorizontal: 5, height: 18, alignItems: 'center', justifyContent: 'center' },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: Colors.secondary },
  chipCountTextActive: { color: '#fff' },

  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 12, ...Shadow.md },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  name: { ...Type.subhead },
  meta: { ...Type.caption, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', marginTop: Spacing.md, gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 9,
  },
  actionEmoji: { fontSize: 14 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: Colors.text },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { ...Type.subhead },
  emptySub: { ...Type.caption, marginTop: 4 },
});
