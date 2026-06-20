/**
 * src/app/raporlar.tsx — Raporlar (Üretim raporları, yönetim odaklı)
 * Direct-supabase agregasyon (lib/reports). Üretim özeti + aylık prim trendi +
 * branş dağılımı. CSV export yok (web'de de yok).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { formatShortTRY } from '@/lib/format';
import { fetchProductionReport, ProductionReport } from '@/lib/reports';

// Branş barları için renk paleti (web dashboard PROD_COLORS karşılığı, hex)
const PROD_COLORS = ['#2563EB', '#6366F1', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#06B6D4', '#EC4899'];

export default function RaporlarScreen() {
  const router = useRouter();
  const { agencyId, loading: profileLoading } = useProfile();

  const [report, setReport] = useState<ProductionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchProductionReport(agencyId);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    if (profileLoading) return;
    load();
  }, [profileLoading, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Trend için max (normalize bar yüksekliği)
  const trendMax = useMemo(() => {
    if (!report) return 0;
    return report.aylikTrend.reduce((m, t) => Math.max(m, t.prim), 0);
  }, [report]);

  const isEmpty = !!report
    && report.buYilPolice === 0
    && report.aktifPolice === 0
    && report.bransDagilimi.length === 0
    && report.aylikTrend.every((t) => t.prim === 0 && t.police === 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}>
          <Text style={styles.hBack}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.hTitle}>Raporlar</Text>
        <View style={styles.hBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {isEmpty || !report ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyTitle}>Henüz üretim verisi yok</Text>
              <Text style={styles.emptyText}>
                Poliçe ekledikçe üretim raporların burada oluşacak.
              </Text>
            </View>
          ) : (
            <>
              {/* ── ÜRETİM ÖZETİ ──────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>ÜRETİM ÖZETİ</Text>
              <View style={styles.grid}>
                <MetricCard label="Bu Ay Prim" value={formatShortTRY(report.buAyPrim)} tint={Colors.primary} />
                <MetricCard label="Bu Ay Komisyon" value={formatShortTRY(report.buAyKomisyon)} tint={Colors.success} />
                <MetricCard label="Bu Ay Poliçe" value={String(report.buAyPolice)} tint="#6366F1" />
                <MetricCard label="Bu Yıl Prim" value={formatShortTRY(report.buYilPrim)} tint="#8B5CF6" />
                <MetricCard label="Aktif Poliçe" value={String(report.aktifPolice)} tint={Colors.warning} />
                <MetricCard label="Dönüşüm" value={`%${report.donusum}`} tint="#F43F5E" />
              </View>

              {/* ── AYLIK PRİM TRENDİ ─────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>AYLIK PRİM TRENDİ</Text>
              <View style={styles.card}>
                {trendMax <= 0 ? (
                  <Text style={styles.subtleNote}>Son 6 ayda kayıtlı üretim yok.</Text>
                ) : (
                  <View style={styles.chart}>
                    {report.aylikTrend.map((t) => {
                      const h = trendMax > 0 ? Math.round((t.prim / trendMax) * 120) : 0;
                      return (
                        <View key={t.label} style={styles.barCol}>
                          <Text style={styles.barValue} numberOfLines={1}>
                            {t.prim > 0 ? formatShortTRY(t.prim) : '–'}
                          </Text>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: Math.max(h, t.prim > 0 ? 4 : 0) }]} />
                          </View>
                          <Text style={styles.barLabel}>{t.ay}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* ── BRANŞ DAĞILIMI ────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>BRANŞ DAĞILIMI</Text>
              <View style={styles.card}>
                {report.bransDagilimi.length === 0 ? (
                  <Text style={styles.subtleNote}>Aktif poliçe bulunmuyor.</Text>
                ) : (
                  report.bransDagilimi.map((b, i) => {
                    const color = PROD_COLORS[i % PROD_COLORS.length];
                    return (
                      <View key={b.type} style={styles.bransRow}>
                        <View style={styles.bransTop}>
                          <View style={styles.bransNameWrap}>
                            <View style={[styles.dot, { backgroundColor: color }]} />
                            <Text style={styles.bransName} numberOfLines={1}>{b.type}</Text>
                          </View>
                          <Text style={styles.bransMeta}>
                            {b.count} · %{b.pct}
                          </Text>
                        </View>
                        <View style={styles.bransTrack}>
                          <View style={[styles.bransFill, { width: `${Math.max(b.pct, 2)}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={{ height: Spacing.lg }} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MetricCard({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: tint }]} />
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 56 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },

  // Üretim özeti ızgarası (2 sütun)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: {
    width: '47.8%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, paddingTop: Spacing.md + 2, overflow: 'hidden', ...Shadow.sm,
  },
  metricAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  metricValue: { ...Type.title, fontSize: 22, color: Colors.heading },
  metricLabel: { ...Type.caption, color: Colors.secondary, marginTop: 4 },

  // Aylık prim trendi (dikey bar)
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 168, paddingTop: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  barTrack: { height: 124, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 22, borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm, backgroundColor: Colors.primary },
  barLabel: { ...Type.caption, color: Colors.text, marginTop: 6 },

  // Branş dağılımı (yatay bar)
  bransRow: { paddingVertical: 9 },
  bransTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  bransNameWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  dot: { width: 9, height: 9, borderRadius: 999, marginRight: 8 },
  bransName: { ...Type.subhead, fontSize: 14, flexShrink: 1 },
  bransMeta: { ...Type.caption, color: Colors.secondary },
  bransTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.surface, overflow: 'hidden' },
  bransFill: { height: 8, borderRadius: 999 },

  subtleNote: { ...Type.caption, color: Colors.secondary, paddingVertical: Spacing.sm },

  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { ...Type.heading, marginBottom: 6 },
  emptyText: { ...Type.caption, color: Colors.secondary, textAlign: 'center', lineHeight: 18 },
});
