/**
 * src/app/quote-run/[id].tsx — Teklif çalışması detayı
 * Şirket karşılaştırması (en iyi vurgulu) + Poliçeleştir (/api/policy-issue) +
 * durum güncelleme (/api/quote-runs PATCH) + WhatsApp ile müşteriye gönder.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { formatTRY, formatShortTRY } from '@/lib/format';
import {
  getQuoteRun, updateRunStatus, issuePolicyFromResult, runStatusMeta,
  isSuccessResult, isErrorResult, resultStatusLabel, bestPrice,
  QuoteRun, QuoteResult,
} from '@/lib/quoteCenter';

function waNumber(phone: string) {
  const c = (phone ?? '').replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c.startsWith('90') ? c : c.length === 10 ? '90' + c : c;
}

export default function QuoteRunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<QuoteRun | null>(null);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getQuoteRun(id);
      setRun(data.run);
      setResults(data.results ?? []);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Yüklenemedi');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const sorted = useMemo(() => {
    const ok = results.filter(isSuccessResult).sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12));
    const rest = results.filter((r) => !isSuccessResult(r));
    return [...ok, ...rest];
  }, [results]);
  const best = useMemo(() => bestPrice(results.filter(isSuccessResult)), [results]);
  const summary = useMemo(() => {
    const ok = results.filter(isSuccessResult);
    const prices = ok.map((r) => Number(r.price)).filter((n) => n > 0);
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    return { okCount: ok.length, errCount: results.filter(isErrorResult).length, avg, max };
  }, [results]);
  const isWon = run?.status === 'Kazanıldı';

  async function changeStatus(status: string) {
    if (!run) return;
    setBusy('status');
    try { await updateRunStatus(run.id, status); await load(); }
    catch (e) { Alert.alert('Hata', e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setBusy(null); }
  }

  function policelestir(r: QuoteResult) {
    if (!r.price) return;
    Alert.alert('Poliçeleştir', `${r.company_name} — ${formatTRY(r.price)} (${run?.product_type}) poliçesi kesilsin mi? (demo ödeme)`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Poliçeleştir',
        onPress: async () => {
          setBusy(r.id);
          try {
            const { policyNo } = await issuePolicyFromResult(r.id, r.price as number, `${r.company_name} - ${run?.product_type ?? ''}`);
            Alert.alert('✅ Poliçe Kesildi', `Poliçe No: ${policyNo}`);
            await load();
          } catch (e) {
            Alert.alert('Kesilemedi', e instanceof Error ? e.message : 'Hata');
          } finally { setBusy(null); }
        },
      },
    ]);
  }

  function sendWhatsapp() {
    if (!run?.customer_phone) return Alert.alert('Telefon yok', 'Müşteri telefonu yok.');
    const top = results.filter(isSuccessResult).sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12)).slice(0, 5);
    if (!top.length) return Alert.alert('Teklif yok', 'Gönderilecek başarılı teklif yok.');
    const lines = top.map((r, i) => `${i + 1}. ${r.company_name}: ${formatTRY(r.price)}${r.installment ? ` (${r.installment})` : ''}`);
    const msg = `Merhaba ${run.customer_name ?? ''}, ${run.product_type} için teklifleriniz:\n\n${lines.join('\n')}\n\nDilediğinizi poliçeleştirebiliriz. 🙂`;
    Linking.openURL(`https://wa.me/${waNumber(run.customer_phone)}?text=${encodeURIComponent(msg)}`).catch(() => Alert.alert('Açılamadı', 'WhatsApp açılamadı.'));
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }
  if (!run) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.center}><Text style={styles.muted}>Teklif çalışması bulunamadı.</Text></View></SafeAreaView>;
  }

  const m = runStatusMeta(run.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>Teklif Detayı</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} showsVerticalScrollIndicator={false}>
        {/* Çalışma özeti */}
        <View style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sumName}>{run.customer_name ?? 'Müşteri'}</Text>
            <Text style={styles.sumMeta}>{run.product_type} · {run.success_count} teklif · {run.error_count} hata</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: m.bg }]}><Text style={[styles.badgeText, { color: m.fg }]}>{run.status}</Text></View>
        </View>

        {best != null && (
          <View style={styles.bestBox}><Text style={styles.bestLabel}>EN İYİ TEKLİF</Text><Text style={styles.bestValue}>{formatTRY(best)}</Text></View>
        )}

        <View style={styles.sumRow}>
          <SumStat label="TEKLİF" value={String(summary.okCount)} />
          <SumStat label="HATA" value={String(summary.errCount)} accent={summary.errCount > 0 ? Colors.danger : Colors.heading} />
          <SumStat label="ORTALAMA" value={summary.avg ? formatShortTRY(summary.avg) : '—'} />
          <SumStat label="EN YÜKSEK" value={summary.max ? formatShortTRY(summary.max) : '—'} />
        </View>

        {/* Aksiyonlar */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actBtn, styles.actWA]} onPress={sendWhatsapp} activeOpacity={0.8}><Text style={styles.actWAText}>💬 Müşteriye Gönder</Text></TouchableOpacity>
        </View>

        {/* Durum güncelleme */}
        {!isWon && (
          <View style={styles.statusRow}>
            {['Teklif Verildi', 'Müşteri Düşünüyor', 'Kaybedildi'].map((s) => (
              <TouchableOpacity key={s} style={[styles.statusChip, run.status === s && styles.statusChipActive]} onPress={() => changeStatus(s)} disabled={busy === 'status'}>
                <Text style={[styles.statusChipText, run.status === s && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>ŞİRKET KARŞILAŞTIRMASI</Text>
        {sorted.map((r) => {
          const ok = isSuccessResult(r);
          const isBest = ok && r.price != null && r.price === best;
          const won = run.won_result_id === r.id;
          const sl = resultStatusLabel(r);
          return (
            <View key={r.id} style={[styles.resCard, isBest && styles.resBest, won && styles.resWon]}>
              <View style={styles.resTop}>
                <Text style={styles.resCompany} numberOfLines={1}>{r.company_name}{isBest ? '  🏆' : ''}{won ? '  ✓' : ''}</Text>
                <View style={[styles.resBadge, { backgroundColor: sl.bg }]}><Text style={[styles.resBadgeText, { color: sl.fg }]}>{sl.label}</Text></View>
              </View>
              {ok ? (
                <>
                  <View style={styles.resPriceRow}>
                    <Text style={styles.resPrice}>{formatTRY(r.price)}</Text>
                    {!!r.installment && <Text style={styles.resInst}>{r.installment}</Text>}
                  </View>
                  {!isWon && (
                    <TouchableOpacity style={[styles.issueBtn, busy === r.id && { opacity: 0.6 }]} onPress={() => policelestir(r)} disabled={!!busy}>
                      {busy === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.issueBtnText}>⚡ Poliçeleştir</Text>}
                    </TouchableOpacity>
                  )}
                  {won && <Text style={styles.wonText}>✓ Bu tekliften poliçe kesildi</Text>}
                </>
              ) : (
                <Text style={styles.resErr} numberOfLines={3}>{r.error_message ?? 'Teklif alınamadı.'}{r.action_hint ? `\n💡 ${r.action_hint}` : ''}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function SumStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.sumStat}>
      <Text style={[styles.sumValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Type.body, color: Colors.secondary },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 64 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sumName: { ...Type.title, fontSize: 18 },
  sumMeta: { ...Type.caption, marginTop: 2 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  bestBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.successBg, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  bestLabel: { fontSize: 11, fontWeight: '800', color: Colors.success, letterSpacing: 0.6 },
  bestValue: { fontSize: 22, fontWeight: '800', color: Colors.success },
  sumRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  sumStat: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center', ...Shadow.sm },
  sumValue: { fontSize: 17, fontWeight: '800', color: Colors.heading },
  sumLabel: { fontSize: 9, fontWeight: '700', color: Colors.secondary, letterSpacing: 0.4, marginTop: 2 },

  actionRow: { flexDirection: 'row', marginTop: Spacing.md },
  actBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: 12 },
  actWA: { backgroundColor: '#22C55E' },
  actWAText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statusRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  statusChip: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 9 },
  statusChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusChipText: { ...Type.caption, color: Colors.text, fontSize: 11 },

  sectionLabel: { ...Type.label, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  resCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  resBest: { borderColor: Colors.success, borderWidth: 1.5 },
  resWon: { backgroundColor: Colors.successBg },
  resTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resCompany: { ...Type.subhead, fontSize: 14, flex: 1, marginRight: 8 },
  resBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  resBadgeText: { fontSize: 10, fontWeight: '700' },
  resPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  resPrice: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  resInst: { ...Type.caption, color: Colors.secondary },
  issueBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  issueBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  wonText: { ...Type.caption, color: Colors.success, fontWeight: '700', marginTop: 8 },
  resErr: { ...Type.caption, color: Colors.danger, marginTop: 8, lineHeight: 18 },
});
