import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow, Dark, renewalUrgency } from '@/lib/theme';
import DarkHero, { heroGlass } from '@/components/DarkHero';
import { useProfile } from '@/lib/useProfile';
import { formatTRY, formatShortTRY } from '@/lib/format';
import {
  fetchUpcomingRenewals, filterByWindow, buildCallUrl, buildRenewalWhatsappUrl,
  RenewalItem, RenewalWindow,
} from '@/lib/renewals';
import { startQuoteRun } from '@/lib/quoteCenter';

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
  const [quotingId, setQuotingId] = useState<string | null>(null);

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
  async function teklif(item: RenewalItem) {
    setQuotingId(item.id);
    try {
      const runId = await startQuoteRun({
        customerId: item.customer_id, createCustomer: false,
        name: item.customerName, phone: item.customerPhone,
        productType: item.policy_type, renewalPolicyId: item.id,
      });
      router.push(`/quote-run/${runId}`);
    } catch (e) {
      Alert.alert('Teklif başlatılamadı', e instanceof Error ? e.message : 'Sunucu hatası — köprü yayınlanmış olmalı.');
    } finally {
      setQuotingId(null);
    }
  }
  function policelestir(item: RenewalItem) {
    router.push({
      pathname: '/(tabs)/policies',
      params: { renewCustomerId: item.customer_id, renewPolicyType: item.policy_type, renewFromPolicyId: item.id },
    });
  }

  return (
    <View style={styles.safe}>
      <DarkHero
        title="Yenilemeler"
        subtitle="Para kazandıran ekran"
        right={
          <View style={[styles.primPill, heroGlass]}>
            <Text style={styles.primLabel}>TAHMİNİ PRİM</Text>
            <Text style={styles.primValue}>{formatShortTRY(tahminiPrim)}</Text>
          </View>
        }
      >
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
                    <ActionBtn emoji="📋" label="Teklif" loading={quotingId === item.id} onPress={() => teklif(item)} />
                    <ActionBtn emoji="⚡" label="Poliçe" tint={Colors.primary} onPress={() => policelestir(item)} />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ActionBtn({ emoji, label, onPress, tint, loading }: { emoji: string; label: string; onPress: () => void; tint?: string; loading?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7} disabled={loading}>
      {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.actionEmoji}>{emoji}</Text>}
      <Text style={[styles.actionLabel, tint ? { color: tint } : null]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  primPill: { alignItems: 'flex-end', borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  primLabel: { fontSize: 9, fontWeight: '700', color: Dark.subOnDark, letterSpacing: 0.6 },
  primValue: { fontSize: 18, fontWeight: '800', color: Dark.textOnDark },

  segScroll: { maxHeight: 48, flexGrow: 0, marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
  segRow: { paddingHorizontal: Spacing.lg, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 14, height: 34,
  },
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
