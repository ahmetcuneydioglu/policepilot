/**
 * src/app/quote-live.tsx — Canlı teklif alma ekranı (async simülasyon)
 * Sağlayıcıyı (getActiveProvider) başlatır, ~1.4 sn'de bir poll eder; şirketler
 * fiyatlarını zamanla döndürür (pending→running→success). Tümü yanıtlayınca sonuçlar
 * kaydedilir (startQuoteRun) ve teklif detayına geçilir. Dış istek YOK — yerel demo.
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { FEATURES } from '@/lib/features';
import { formatTRY } from '@/lib/format';
import { startQuoteRun, StartQuoteParams } from '@/lib/quoteCenter';
import { getActiveProvider, NormalizedQuote } from '@/lib/quoteProvider';

const POLL_MS = 1400;

function statusView(q: NormalizedQuote) {
  switch (q.status) {
    case 'success': return { right: formatTRY(q.price), color: Colors.success, dot: Colors.success };
    case 'running': return { right: 'spinner', color: Colors.primary, dot: Colors.primary };
    case 'pending': return { right: 'Sırada', color: Colors.placeholder, dot: Colors.border };
    case 'no_offer': return { right: 'Teklif Yok', color: Colors.secondary, dot: Colors.secondary };
    default: return { right: q.durumAdi, color: Colors.warning, dot: Colors.warning };
  }
}

export default function QuoteLiveScreen() {
  // App Store v1.0: teklif akışı kapalı (bkz. features.ts)
  if (!FEATURES.quoteCenter) return <Redirect href="/(tabs)" />;
  const router = useRouter();
  const { payload } = useLocalSearchParams<{ payload: string }>();
  const [quotes, setQuotes] = useState<NormalizedQuote[]>([]);
  const [answered, setAnswered] = useState(0);
  const [total, setTotal] = useState(12);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const provider = getActiveProvider();

    (async () => {
      let params: StartQuoteParams;
      try { params = JSON.parse(payload) as StartQuoteParams; }
      catch { setErr('Geçersiz istek.'); return; }

      const seed = (params.tc || params.productData?.plaka || params.plaka || params.name || 'seed').trim();
      try {
        const { jobId } = await provider.startQuote({ productType: params.productType, seed });
        const tick = async () => {
          if (!aliveRef.current) return;
          const res = await provider.pollResults(jobId);
          if (!aliveRef.current) return;
          setQuotes(res.quotes); setAnswered(res.answered); setTotal(res.total);
          if (res.done) {
            setDone(true);
            try {
              const runId = await startQuoteRun(params);
              if (aliveRef.current) setTimeout(() => router.replace(`/quote-run/${runId}`), 600);
            } catch (e) {
              if (aliveRef.current) setErr(e instanceof Error ? e.message : 'Sonuçlar kaydedilemedi.');
            }
            return;
          }
          timer = setTimeout(tick, POLL_MS);
        };
        await tick();
      } catch (e) {
        if (aliveRef.current) setErr(e instanceof Error ? e.message : 'Teklif başlatılamadı.');
      }
    })();

    return () => { aliveRef.current = false; clearTimeout(timer); };
  }, [payload]);

  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  if (err) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={styles.muted}>{err}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>Geri dön</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={[Colors.primary, '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>Teklifler Alınıyor</Text>
          {!done && <TouchableOpacity onPress={() => router.back()}><Text style={styles.heroCancel}>İptal</Text></TouchableOpacity>}
        </View>
        <Text style={styles.heroSub}>{done ? 'Tamamlandı — sonuçlar hazırlanıyor…' : `${answered} / ${total} şirket yanıtladı`}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {quotes.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /><Text style={[styles.muted, { marginTop: 12 }]}>Sorgu başlatılıyor…</Text></View>
        ) : (
          quotes.map((q) => {
            const s = statusView(q);
            return (
              <View key={q.teklifId} style={styles.row}>
                <View style={[styles.code, { borderColor: s.dot }]}><Text style={[styles.codeText, { color: s.dot }]}>{q.companyCode}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.company} numberOfLines={1}>{q.companyName}</Text>
                  <Text style={styles.durum}>{q.durumAdi}</Text>
                </View>
                {s.right === 'spinner'
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={[styles.right, { color: s.color }]} numberOfLines={1}>{s.right}</Text>}
              </View>
            );
          })
        )}
        {done && (
          <View style={styles.doneRow}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.doneText}>Sonuç ekranına geçiliyor…</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { paddingVertical: 70, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Type.body, color: Colors.secondary, textAlign: 'center' },

  hero: { paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroCancel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },

  list: { padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  code: { width: 40, height: 40, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  codeText: { fontSize: 13, fontWeight: '800' },
  company: { ...Type.subhead, fontSize: 14 },
  durum: { ...Type.caption, marginTop: 1 },
  right: { fontSize: 15, fontWeight: '800', maxWidth: 110, textAlign: 'right' },

  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
  doneText: { ...Type.caption, color: Colors.secondary },

  backBtn: { marginTop: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 22, paddingVertical: 11 },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
