/**
 * src/app/quote-run/[id].tsx — Teklif çalışması sonuç ekranı (tamamliyo görünümü)
 * Şirket kartları: Yapay Zeka Skoru + 5 metrik bar + "Yapay Zeka Önerisi"/"En Uygun"
 * rozetleri + kazanç. İş aksiyonları korunur: Poliçeleştir (/api/policy-issue),
 * durum güncelleme (/api/quote-runs PATCH), WhatsApp ile müşteriye gönder.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { formatTRY } from '@/lib/format';
import {
  getQuoteRun, updateRunStatus, issuePolicyFromResult, runStatusMeta,
  isSuccessResult, resultStatusLabel, bestPrice, productMeta,
  QuoteRun, QuoteResult,
} from '@/lib/quoteCenter';
import { scoreFor, priceCtx, QuoteScore } from '@/lib/quoteScore';

function waNumber(phone: string) {
  const c = (phone ?? '').replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c.startsWith('90') ? c : c.length === 10 ? '90' + c : c;
}
function initials(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length >= 2 && w[0] && w[1]) return (w[0][0] + w[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return `${s} sn önce`;
  const mn = Math.round(s / 60); if (mn < 60) return `${mn} dk önce`;
  const hr = Math.round(mn / 60); if (hr < 24) return `${hr} saat önce`;
  return `${Math.round(hr / 24)} gün önce`;
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

  const { ordered, scoreMap, recommendedId, best, okCount } = useMemo(() => {
    const ok = results.filter(isSuccessResult);
    const ctx = priceCtx(ok.map((r) => Number(r.price)).filter((n) => n > 0));
    const map = new Map<string, QuoteScore>();
    ok.forEach((r) => map.set(r.id, scoreFor(r.company_name, r.price, ctx)));
    const okSorted = [...ok].sort((a, b) => (map.get(b.id)?.aiScore ?? 0) - (map.get(a.id)?.aiScore ?? 0));
    const rest = results.filter((r) => !isSuccessResult(r));
    return {
      ordered: [...okSorted, ...rest],
      scoreMap: map,
      recommendedId: okSorted[0]?.id ?? null,
      best: bestPrice(ok),
      okCount: ok.length,
    };
  }, [results]);

  const isWon = run?.status === 'Kazanıldı';

  async function changeStatus(status: string) {
    if (!run) return;
    setBusy('status');
    try { await updateRunStatus(run.id, status); await load(); }
    catch (e) { Alert.alert('Hata', e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setBusy(null); }
  }

  async function selectResult(r: QuoteResult) {
    if (!run) return;
    setBusy(`sel-${r.id}`);
    try { await updateRunStatus(run.id, 'Kazanıldı', r.id); await load(); }
    catch (e) { Alert.alert('Hata', e instanceof Error ? e.message : 'Güncellenemedi'); }
    finally { setBusy(null); }
  }

  async function resetRun() {
    if (!run) return;
    setBusy('status');
    try { await updateRunStatus(run.id, 'Yeni', null); await load(); }
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
        <Text style={styles.hTitle}>Teklif Sonuçları</Text>
        <TouchableOpacity onPress={() => router.push(`/quote-summary/${id}`)} style={[styles.hBtn, styles.hBtnRight]}>
          <Text style={styles.hSummary}>📄 Özet</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} showsVerticalScrollIndicator={false}>
        {/* Müşteri özeti */}
        <View style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sumName} numberOfLines={1}>{run.customer_name ?? 'Müşteri'}</Text>
            <Text style={styles.sumMeta}>{run.product_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: m.bg }]}><Text style={[styles.badgeText, { color: m.fg }]}>{run.status}</Text></View>
        </View>

        {/* Gradient AI banner */}
        <LinearGradient colors={['#2563EB', '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
          <View style={styles.bannerIcon}><Text style={{ fontSize: 18 }}>📊</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{run.product_type} · SigortaOS Analizi</Text>
            <Text style={styles.bannerSub}>{okCount} şirket karşılaştırıldı{best != null ? ` · En iyi ${formatTRY(best)}` : ''}</Text>
          </View>
        </LinearGradient>

        {/* Müşteri Bilgi Kartı */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>MÜŞTERİ</Text>
          {!!run.customer_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Telefon</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{run.customer_phone}</Text>
            </View>
          )}
          {!!run.customer_tc && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>TC</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{run.customer_tc}</Text>
            </View>
          )}
          {!!run.customer_email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>E-posta</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{run.customer_email}</Text>
            </View>
          )}
          {!!run.customer_id && (
            <TouchableOpacity style={styles.infoLink} onPress={() => router.push(`/customer/${run.customer_id}`)} activeOpacity={0.7}>
              <Text style={styles.infoLinkText}>Müşteriyi Aç →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ürün/Not Kartı */}
        {(() => {
          const pm = productMeta(run.product_type);
          const pdEntries = run.product_data ? Object.entries(run.product_data).filter(([, v]) => v != null && String(v).trim() !== '') : [];
          const hasNotes = !!run.notes && run.notes.trim() !== '';
          if (pdEntries.length === 0 && !hasNotes) return null;
          return (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>ÜRÜN BİLGİSİ</Text>
              <View style={styles.prodHead}>
                <View style={[styles.prodPill, { backgroundColor: pm.bg }]}>
                  <Text style={styles.prodPillEmoji}>{pm.emoji}</Text>
                  <Text style={[styles.prodPillText, { color: pm.fg }]}>{run.product_type}</Text>
                </View>
              </View>
              {pdEntries.map(([k, v]) => (
                <View key={k} style={styles.infoRow}>
                  <Text style={styles.infoLabel} numberOfLines={1}>{k}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{String(v)}</Text>
                </View>
              ))}
              {hasNotes && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Not</Text>
                  <Text style={styles.noteText}>{run.notes}</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Aksiyonlar */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actBtn, styles.actWA]} onPress={sendWhatsapp} activeOpacity={0.85}><Text style={styles.actWAText}>💬 Müşteriye Gönder</Text></TouchableOpacity>
        </View>
        {!isWon && (
          <View style={styles.statusRow}>
            {['Teklif Verildi', 'Müşteri Düşünüyor', 'Kaybedildi'].map((s) => (
              <TouchableOpacity key={s} style={[styles.statusChip, run.status === s && styles.statusChipActive]} onPress={() => changeStatus(s)} disabled={busy === 'status'}>
                <Text style={[styles.statusChipText, run.status === s && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {run.status !== 'Yeni' && (
          <TouchableOpacity style={styles.resetBtn} onPress={resetRun} disabled={busy === 'status'} activeOpacity={0.7}>
            <Text style={styles.resetBtnText}>↺ Sıfırla</Text>
          </TouchableOpacity>
        )}

        {/* Şirket kartları */}
        {ordered.map((r) => {
          const ok = isSuccessResult(r);
          const won = run.won_result_id === r.id;
          const isRec = ok && r.id === recommendedId;
          const score = scoreMap.get(r.id);

          if (!ok || !score) {
            const sl = resultStatusLabel(r);
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, styles.avatarErr]}><Text style={styles.avatarText}>{initials(r.company_name)}</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.company} numberOfLines={1}>{r.company_name}</Text>
                    <Text style={styles.errMsg} numberOfLines={2}>{r.error_message ?? 'Teklif alınamadı.'}</Text>
                  </View>
                  <View style={[styles.resBadge, { backgroundColor: sl.bg }]}><Text style={[styles.resBadgeText, { color: sl.fg }]}>{sl.label}</Text></View>
                </View>
                {!!r.action_hint && <Text style={styles.hint}>💡 {r.action_hint}</Text>}
              </View>
            );
          }

          return (
            <View key={r.id} style={[styles.card, isRec && styles.cardRec, won && styles.cardWon]}>
              {isRec && (
                <LinearGradient colors={['#1D4ED8', '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.recBadge}>
                  <Text style={styles.recBadgeText}>⭐ SigortaOS Önerisi</Text>
                </LinearGradient>
              )}
              <View style={styles.cardTop}>
                <LinearGradient colors={['#3B82F6', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(r.company_name)}</Text>
                </LinearGradient>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.company} numberOfLines={1}>{r.company_name}</Text>
                    {isRec && <View style={styles.enUygun}><Text style={styles.enUygunText}>En İyi Değer</Text></View>}
                    {won && <Text style={styles.wonTick}>✓</Text>}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatTRY(r.price)}</Text>
                    {score.kazanc > 0 && <Text style={styles.kazanc}>↗ {formatTRY(score.kazanc)} kazanç</Text>}
                  </View>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreVal}>{score.aiScore.toFixed(1)}</Text>
                  <Text style={styles.scoreCap}>SigortaOS{'\n'}SKORU</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                {score.metrics.map((mtr) => (
                  <View key={mtr.key} style={styles.metric}>
                    <Text style={styles.metricLabel} numberOfLines={1}>{mtr.label}</Text>
                    <View style={styles.metricTrack}>
                      <LinearGradient colors={['#1D4ED8', '#60A5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.metricFill, { width: `${mtr.value}%` }]} />
                    </View>
                    <Text style={styles.metricVal}>{mtr.value}</Text>
                  </View>
                ))}
              </View>

              {won ? (
                <Text style={styles.wonText}>✓ Bu tekliften poliçe kesildi</Text>
              ) : !isWon ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.selectBtn, busy === `sel-${r.id}` && { opacity: 0.6 }]} onPress={() => selectResult(r)} disabled={!!busy}>
                    {busy === `sel-${r.id}` ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.selectBtnText}>Seç</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.issueBtn, styles.issueBtnFlex, busy === r.id && { opacity: 0.6 }]} onPress={() => policelestir(r)} disabled={!!busy}>
                    {busy === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.issueBtnText}>⚡ Poliçeleştir</Text>}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Altbilgi */}
        <View style={styles.footer}>
          <View style={styles.footDot} />
          <Text style={styles.footText}>{results.length} sigorta şirketi karşılaştırıldı</Text>
          <Text style={styles.footTime}>SigortaOS · {relTime(run.created_at)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Type.body, color: Colors.secondary },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 64 },
  hBtnRight: { alignItems: 'flex-end' },
  hBack: { ...Type.subhead, color: Colors.primary },
  hSummary: { ...Type.subhead, color: Colors.primary, fontWeight: '700' },
  hTitle: { ...Type.heading, fontSize: 16 },

  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sumName: { ...Type.title, fontSize: 18 },
  sumMeta: { ...Type.caption, marginTop: 2 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Gradient AI banner
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, ...Shadow.md },
  bannerIcon: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Bilgi kartları (müşteri / ürün)
  infoCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  infoTitle: { fontSize: 11, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.6, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { ...Type.caption, color: Colors.secondary, flexShrink: 0, marginRight: 12, textTransform: 'capitalize' },
  infoValue: { ...Type.subhead, color: Colors.text, flexShrink: 1, textAlign: 'right' },
  infoLink: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLinkText: { ...Type.subhead, color: Colors.primary, fontWeight: '700' },

  prodHead: { flexDirection: 'row', marginBottom: 4 },
  prodPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 6 },
  prodPillEmoji: { fontSize: 14 },
  prodPillText: { fontSize: 13, fontWeight: '800' },
  noteBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  noteLabel: { fontSize: 11, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.4, marginBottom: 4 },
  noteText: { ...Type.body, color: Colors.text, lineHeight: 20 },

  actionRow: { flexDirection: 'row', marginTop: Spacing.md },
  actBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: 12 },
  actWA: { backgroundColor: '#22C55E' },
  actWAText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statusRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  statusChip: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 9 },
  statusChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusChipText: { ...Type.caption, color: Colors.text, fontSize: 11 },
  resetBtn: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  resetBtnText: { ...Type.caption, color: Colors.secondary, fontWeight: '700', fontSize: 12 },

  // Kart
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  cardRec: { borderColor: '#93C5FD', borderWidth: 1.5, marginTop: 22 },
  cardWon: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  recBadge: { position: 'absolute', top: -12, left: 14, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  recBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarErr: { backgroundColor: '#CBD5E1' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  company: { ...Type.subhead, fontSize: 16, flexShrink: 1 },
  enUygun: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  enUygunText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  wonTick: { color: Colors.success, fontSize: 14, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 3 },
  price: { fontSize: 17, fontWeight: '800', color: Colors.heading },
  kazanc: { fontSize: 13, fontWeight: '700', color: Colors.success },

  scoreCol: { alignItems: 'flex-end', marginLeft: 8 },
  scoreVal: { fontSize: 26, fontWeight: '900', color: '#1E40AF', letterSpacing: -0.5 },
  scoreCap: { fontSize: 8, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.4, textAlign: 'right', marginTop: -2 },

  metricsRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 8.5, fontWeight: '600', color: Colors.secondary, marginBottom: 5 },
  metricTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 3 },
  metricVal: { fontSize: 12, fontWeight: '800', color: Colors.heading, marginTop: 5 },

  issueBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  issueBtnFlex: { flex: 1, marginTop: 0 },
  issueBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 14 },
  selectBtn: { paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.card },
  selectBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  wonText: { ...Type.caption, color: Colors.success, fontWeight: '700', marginTop: 12, textAlign: 'center' },

  resBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  resBadgeText: { fontSize: 10, fontWeight: '700' },
  errMsg: { ...Type.caption, color: Colors.danger, marginTop: 3, lineHeight: 17 },
  hint: { ...Type.caption, color: Colors.secondary, marginTop: 10 },

  footer: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, paddingHorizontal: 4 },
  footDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8 },
  footText: { ...Type.caption, color: Colors.text, flex: 1 },
  footTime: { ...Type.caption, color: Colors.placeholder },
});
