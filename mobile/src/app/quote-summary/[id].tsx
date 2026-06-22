/**
 * src/app/quote-summary/[id].tsx — Teklif Özeti (web "Teklif Özeti" mobil karşılığı)
 * Salt-okunur, temiz, "resmi özet" hissi: marka başlığı + sigortalı/ürün blokları +
 * başarılı teklif tablosu (fiyata göre artan, en ucuza 🏆) + disclaimer.
 * Sağ üstte "Paylaş" (RN Share API) — özet metnini paylaşır.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { formatTRY } from '@/lib/format';
import {
  getQuoteRun, runStatusMeta, isSuccessResult, bestPrice,
  resultStatusLabel, productMeta, QuoteRun, QuoteResult,
} from '@/lib/quoteCenter';

function longDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
    });
  } catch {
    return '—';
  }
}

export default function QuoteSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<QuoteRun | null>(null);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getQuoteRun(id);
      setRun(data.run);
      setResults(data.results ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Teklif özeti yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Başarılı sonuçlar, fiyata göre artan
  const { okSorted, best, totalCount } = useMemo(() => {
    const ok = results
      .filter(isSuccessResult)
      .filter((r) => r.price != null)
      .sort((a, b) => Number(a.price) - Number(b.price));
    return {
      okSorted: ok,
      best: bestPrice(ok),
      totalCount: results.length,
    };
  }, [results]);

  // Ürün verisi (kısa, okunabilir)
  const productExtras = useMemo(() => {
    const d = run?.product_data;
    if (!d) return [] as { k: string; v: string }[];
    return Object.entries(d)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => ({ k, v: String(v) }));
  }, [run]);

  const onShare = useCallback(async () => {
    if (!run) return;
    const lines = okSorted.slice(0, 5).map((r, i) =>
      `${i + 1}. ${r.company_name}: ${formatTRY(r.price)}${r.installment ? ` (${r.installment})` : ''}`,
    );
    const head = `SigortaOS — Teklif Özeti\n${longDate(run.created_at)}`;
    const who = `\n\nSigortalı: ${run.customer_name ?? '—'}\nÜrün: ${run.product_type}`;
    const body = lines.length
      ? `\n\nKarşılaştırılan teklifler:\n${lines.join('\n')}${best != null ? `\n\nEn iyi: ${formatTRY(best)}` : ''}`
      : '\n\nHenüz başarılı teklif bulunmuyor.';
    const foot = '\n\nBu özet bilgilendirme amaçlıdır; nihai fiyat/şartlar şirket onayına tabidir.';
    try {
      await Share.share({ message: `${head}${who}${body}${foot}` });
    } catch {
      /* kullanıcı paylaşımı iptal etti — sessiz geç */
    }
  }, [run, okSorted, best]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} onShare={onShare} canShare={false} />
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }
  if (err || !run) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} onShare={onShare} canShare={false} />
        <View style={styles.center}>
          <Text style={styles.muted}>{err ?? 'Teklif özeti bulunamadı.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sm = runStatusMeta(run.status);
  const pm = productMeta(run.product_type);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} onShare={onShare} canShare />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resmi özet kağıdı */}
        <View style={styles.sheet}>
          {/* Marka başlığı */}
          <View style={styles.brandRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>SigortaOS</Text>
              <Text style={styles.brandSub}>Teklif Özeti · {longDate(run.created_at)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
              <Text style={[styles.statusText, { color: sm.fg }]}>{run.status}</Text>
            </View>
          </View>

          <View style={styles.rule} />

          {/* Sigortalı bloğu */}
          <Text style={styles.sectionLabel}>SİGORTALI</Text>
          <View style={styles.block}>
            <Row k="Ad Soyad" v={run.customer_name ?? '—'} strong />
            <Row k="Telefon" v={run.customer_phone ?? '—'} />
            {!!run.customer_tc && <Row k="T.C. Kimlik" v={run.customer_tc} />}
            {!!run.customer_email && <Row k="E-posta" v={run.customer_email} />}
          </View>

          {/* Ürün bloğu */}
          <Text style={styles.sectionLabel}>ÜRÜN</Text>
          <View style={styles.block}>
            <View style={styles.productRow}>
              <View style={[styles.productPill, { backgroundColor: pm.bg }]}>
                <Text style={styles.productEmoji}>{pm.emoji}</Text>
                <Text style={[styles.productText, { color: pm.fg }]}>{run.product_type}</Text>
              </View>
            </View>
            {productExtras.map((e) => (
              <Row key={e.k} k={e.k} v={e.v} />
            ))}
          </View>

          {/* Sonuçlar tablosu */}
          <Text style={styles.sectionLabel}>TEKLİFLER</Text>
          {okSorted.length === 0 ? (
            <View style={styles.block}>
              <Text style={styles.emptyText}>Bu çalışmada başarılı teklif bulunmuyor.</Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tHead}>
                <Text style={[styles.thCompany, styles.thText]}>Şirket</Text>
                <Text style={[styles.thInst, styles.thText]}>Taksit</Text>
                <Text style={[styles.thPrice, styles.thText]}>Prim</Text>
              </View>
              {okSorted.map((r, i) => {
                const isBest = best != null && Number(r.price) === best;
                return (
                  <View key={r.id} style={[styles.tRow, i === okSorted.length - 1 && styles.tRowLast, isBest && styles.tRowBest]}>
                    <View style={styles.tCompanyCell}>
                      <Text style={styles.tCompany} numberOfLines={1}>{r.company_name}</Text>
                      {isBest && <Text style={styles.bestTag}>🏆 En ucuz</Text>}
                    </View>
                    <Text style={styles.tInst} numberOfLines={1}>{r.installment ?? '—'}</Text>
                    <Text style={[styles.tPrice, isBest && styles.tPriceBest]}>{formatTRY(r.price)}</Text>
                  </View>
                );
              })}
              {best != null && (
                <View style={styles.bestFoot}>
                  <Text style={styles.bestFootLabel}>En iyi</Text>
                  <Text style={styles.bestFootValue}>{formatTRY(best)}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.rule} />

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            Bu özet bilgilendirme amaçlıdır; nihai fiyat/şartlar şirket onayına tabidir.
            SigortaOS ile {totalCount} şirket karşılaştırıldı.
          </Text>
        </View>

        {/* Paylaş aksiyonu (alt sabit hissi) */}
        <TouchableOpacity style={styles.shareCta} onPress={onShare} activeOpacity={0.85}>
          <Text style={styles.shareCtaText}>↗ Özeti Paylaş</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Alt bileşenler ──────────────────────────────────────────────────────── */

function Header({ onBack, onShare, canShare }: { onBack: () => void; onShare: () => void; canShare: boolean }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
      <Text style={styles.hTitle}>Teklif Özeti</Text>
      <TouchableOpacity onPress={canShare ? onShare : undefined} style={[styles.hBtn, styles.hBtnRight]} disabled={!canShare}>
        <Text style={[styles.hShare, !canShare && { color: Colors.placeholder }]}>Paylaş</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, strong && styles.kvValStrong]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  muted: { ...Type.body, color: Colors.secondary, textAlign: 'center' },
  retryBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 64 },
  hBtnRight: { alignItems: 'flex-end' },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },
  hShare: { ...Type.subhead, color: Colors.primary },

  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  // Resmi özet kağıdı
  sheet: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.md },

  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: '900', color: Colors.primaryDark, letterSpacing: -0.5 },
  brandSub: { ...Type.caption, color: Colors.secondary, marginTop: 3 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 5, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },

  rule: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },

  sectionLabel: { ...Type.label, marginBottom: 8, marginTop: 2 },
  block: { marginBottom: Spacing.md },

  kvRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  kvKey: { ...Type.caption, color: Colors.secondary, width: 110 },
  kvVal: { ...Type.body, color: Colors.text, flex: 1 },
  kvValStrong: { fontWeight: '800', color: Colors.heading, fontSize: 15 },

  productRow: { flexDirection: 'row', marginBottom: 4 },
  productPill: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  productEmoji: { fontSize: 15, marginRight: 6 },
  productText: { fontSize: 13, fontWeight: '800' },

  // Tablo
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md },
  tHead: { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thText: { ...Type.label, fontSize: 10 },
  thCompany: { flex: 1 },
  thInst: { width: 64, textAlign: 'center' },
  thPrice: { width: 92, textAlign: 'right' },

  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tRowLast: { borderBottomWidth: 0 },
  tRowBest: { backgroundColor: Colors.successBg },
  tCompanyCell: { flex: 1, paddingRight: 8 },
  tCompany: { ...Type.subhead, fontSize: 14 },
  bestTag: { fontSize: 11, fontWeight: '800', color: Colors.success, marginTop: 2 },
  tInst: { width: 64, textAlign: 'center', ...Type.caption, color: Colors.secondary },
  tPrice: { width: 92, textAlign: 'right', fontSize: 14, fontWeight: '800', color: Colors.heading },
  tPriceBest: { color: Colors.success },

  bestFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 10 },
  bestFootLabel: { ...Type.caption, color: Colors.primaryDark, fontWeight: '800' },
  bestFootValue: { fontSize: 16, fontWeight: '900', color: Colors.primaryDark },

  emptyText: { ...Type.body, color: Colors.secondary },

  disclaimer: { ...Type.caption, color: Colors.placeholder, lineHeight: 17 },

  shareCta: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.sm },
  shareCtaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
