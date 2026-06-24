/**
 * src/app/quote-payment/[id].tsx — Poliçeleştirme ödeme ekranı (web uyarlaması)
 * id = quote_result_id. Akış: GET context → ödeme formu → "Öde" → POST issue → başarı.
 * Kart bilgisi (no/SKT/CVV) SUNUCUYA GÖNDERİLMEZ — POST yalnız amount+description.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { formatTRY } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { getIssueContext, issuePolicyFromResult, IssueContext } from '@/lib/quoteCenter';

const TAKSIT_OPTS = ['Peşin', '2 Taksit', '3 Taksit', '6 Taksit', '9 Taksit', '12 Taksit'];
const EMPTY_CARD = { holder: '', number: '', expiry: '', cvv: '' };

function digits(s: string) { return s.replace(/\D/g, ''); }
function formatCard(v: string) { return digits(v).slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }
function formatExpiry(v: string) { const d = digits(v).slice(0, 4); return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }
function cardValid(c: typeof EMPTY_CARD) {
  return digits(c.number).length === 16 && c.expiry.length === 5 && digits(c.cvv).length >= 3 && c.holder.trim().length >= 2;
}
function initials(name: string) { return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

type Phase = 'loading' | 'form' | 'processing' | 'success' | 'already' | 'error';

export default function QuotePaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [ctx, setCtx] = useState<IssueContext | null>(null);
  const [err, setErr] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [card, setCard] = useState({ ...EMPTY_CARD });
  const [installment, setInstallment] = useState('Peşin');
  const [secure3d, setSecure3d] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setPhase('loading');
    try {
      const data = await getIssueContext(id);
      setCtx(data);
      if (data.alreadyIssued?.issued) { setPolicyNo(data.alreadyIssued.policyNo ?? ''); setPhase('already'); }
      else setPhase('form');
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 401 ? 'Sunucuya bağlanılamadı.' : e instanceof Error ? e.message : 'Teklif bağlamı yüklenemedi.');
      setPhase('error');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function pay() {
    if (!ctx || !cardValid(card)) return;
    const r = ctx.context.result;
    setErr('');
    setPhase('processing');
    try {
      await new Promise((res) => setTimeout(res, 1100)); // ödeme simülasyonu (his)
      const { policyNo: no } = await issuePolicyFromResult(id, Number(r.price ?? 0), `${r.company_name} - ${ctx.context.run.product_type}`);
      setPolicyNo(no);
      setCard({ ...EMPTY_CARD }); // kart verisini temizle
      setPhase('success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        try { const d = await getIssueContext(id); setPolicyNo(d.alreadyIssued?.policyNo ?? ''); } catch { /* yoksay */ }
        setPhase('already');
      } else {
        setErr(e instanceof Error ? e.message : 'İşlem başarısız. Lütfen tekrar deneyin.');
        setPhase('form');
      }
    }
  }

  // ─── Üst başlık ───
  const Header = ({ title }: { title: string }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
      <Text style={styles.hTitle}>{title}</Text>
      <View style={styles.hBtn} />
    </View>
  );

  if (phase === 'loading') {
    return <SafeAreaView style={styles.safe} edges={['top']}><Header title="Poliçeleştirme" /><View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}><Header title="Poliçeleştirme" />
        <View style={styles.center}><Text style={styles.bigEmoji}>⚠️</Text><Text style={styles.muted}>{err}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}><Text style={styles.secondaryBtnText}>Geri dön</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (phase === 'processing') {
    return <SafeAreaView style={styles.safe} edges={['top']}><Header title="İşleniyor" /><View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /><Text style={[styles.muted, { marginTop: 14 }]}>Demo poliçe oluşturuluyor…</Text><Text style={styles.hintCenter}>Lütfen ekranı kapatmayın.</Text></View></SafeAreaView>;
  }

  const r = ctx?.context.result;
  const run = ctx?.context.run;
  const pd = run?.product_data ?? {};
  const isVehicle = pd.group === 'vehicle' || !!pd.plaka;
  const amount = Number(r?.price ?? 0);

  // ─── Başarı ───
  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}><Header title="Tamamlandı" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successHero}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Demo Poliçe Oluşturuldu</Text>
            <Text style={styles.successSub}>{r?.company_name} · {run?.product_type}</Text>
          </View>
          <View style={styles.card}>
            <Row label="Poliçe No" value={policyNo} strong mono />
            <Row label="Şirket" value={r?.company_name ?? '—'} />
            <Row label="Ürün" value={run?.product_type ?? '—'} />
            <Row label="Müşteri" value={run?.customer_name ?? '—'} />
            <Row label="Prim" value={formatTRY(amount)} strong />
            <Row label="Kaynak" value={ctx?.isDemo ? 'Demo' : 'Gerçek'} last />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/policies')}><Text style={styles.primaryBtnText}>Poliçelere Git →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}><Text style={styles.secondaryBtnText}>Teklif Çalışmasına Dön</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Zaten kesilmiş ───
  if (phase === 'already') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}><Header title="Poliçeleştirme" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successHero}>
            <Text style={styles.successEmoji}>ℹ️</Text>
            <Text style={styles.successTitle}>Zaten Poliçeleştirilmiş</Text>
            <Text style={styles.successSub}>Bu teklif daha önce poliçeye dönüştürülmüş.</Text>
          </View>
          {!!policyNo && <View style={styles.card}><Row label="Poliçe No" value={policyNo} strong mono last /></View>}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/policies')}><Text style={styles.primaryBtnText}>Poliçelere Git →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}><Text style={styles.secondaryBtnText}>Geri dön</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Ödeme formu ───
  const valid = cardValid(card);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Poliçeleştirme" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Seçilen teklif */}
        <View style={styles.heroCard}>
          <View style={styles.heroLogo}><Text style={styles.heroLogoText}>{initials(r?.company_name ?? '?')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroCompany}>{r?.company_name}</Text>
            <Text style={styles.heroMeta}>{run?.product_type} · {ctx?.isDemo ? 'Demo' : 'Gerçek'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroAmount}>{formatTRY(amount)}</Text>
            <Text style={styles.heroInst}>{r?.installment || 'Peşin'}</Text>
          </View>
        </View>

        {/* Kart önizleme */}
        <LinearGradient colors={['#3730A3', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ccard}>
          <View style={styles.ccTop}><Text style={styles.ccChip}>▭</Text><Text style={styles.ccBrand}>DEMO</Text></View>
          <Text style={styles.ccNumber}>{(formatCard(card.number) || '•••• •••• •••• ••••').padEnd(19, '•')}</Text>
          <View style={styles.ccBottom}>
            <View><Text style={styles.ccLabel}>KART SAHİBİ</Text><Text style={styles.ccValue}>{card.holder.toUpperCase() || 'AD SOYAD'}</Text></View>
            <View><Text style={styles.ccLabel}>SKT</Text><Text style={styles.ccValue}>{card.expiry || 'AA/YY'}</Text></View>
          </View>
        </LinearGradient>

        {/* Form */}
        <Text style={styles.fieldLabel}>Kart Üzerindeki İsim</Text>
        <TextInput style={styles.input} value={card.holder} onChangeText={(v) => setCard((s) => ({ ...s, holder: v }))} placeholder="AD SOYAD" placeholderTextColor={Colors.placeholder} autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>Kart Numarası</Text>
        <TextInput style={styles.input} value={formatCard(card.number)} onChangeText={(v) => setCard((s) => ({ ...s, number: digits(v) }))} placeholder="0000 0000 0000 0000" placeholderTextColor={Colors.placeholder} keyboardType="number-pad" maxLength={19} />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Son Kullanma</Text>
            <TextInput style={styles.input} value={card.expiry} onChangeText={(v) => setCard((s) => ({ ...s, expiry: formatExpiry(v) }))} placeholder="AA/YY" placeholderTextColor={Colors.placeholder} keyboardType="number-pad" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>CVV</Text>
            <TextInput style={styles.input} value={card.cvv} onChangeText={(v) => setCard((s) => ({ ...s, cvv: digits(v).slice(0, 4) }))} placeholder="•••" placeholderTextColor={Colors.placeholder} keyboardType="number-pad" maxLength={4} secureTextEntry />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Taksit</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 4 }}>
          {TAKSIT_OPTS.map((t) => (
            <TouchableOpacity key={t} style={[styles.taksitChip, installment === t && styles.taksitChipActive]} onPress={() => setInstallment(t)}>
              <Text style={[styles.taksitChipText, installment === t && styles.taksitChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.secureRow}>
          <View style={{ flex: 1 }}><Text style={styles.secureTitle}>3D Secure ile Öde</Text><Text style={styles.secureSub}>SMS onayıyla güvenli ödeme</Text></View>
          <Switch value={secure3d} onValueChange={setSecure3d} trackColor={{ true: Colors.primary }} />
        </View>

        <View style={styles.noticeBox}><Text style={styles.noticeText}>🔒 Demo mod — kart bilgileriniz sunucuya gönderilmez ve gerçek ödeme alınmaz.</Text></View>

        {!!err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {/* Özet */}
        <Text style={styles.sectionLabel}>ÖZET</Text>
        <View style={styles.card}>
          <Row label="Sigortalı" value={run?.customer_name ?? '—'} />
          {!!run?.customer_tc && <Row label="T.C./VKN" value={run.customer_tc} />}
          {!!run?.customer_phone && <Row label="Telefon" value={run.customer_phone} />}
          {isVehicle && !!pd.plaka && <Row label="Plaka" value={pd.plaka} />}
          {isVehicle && (!!pd.marka || !!pd.model) && <Row label="Araç" value={`${pd.marka ?? ''} ${pd.model ?? ''}`.trim()} />}
          <Row label="Sigorta Türü" value={run?.product_type ?? '—'} />
          <Row label="Ödenecek Tutar" value={formatTRY(amount)} strong last />
        </View>

        <TouchableOpacity style={[styles.payBtn, !valid && { opacity: 0.45 }]} onPress={pay} disabled={!valid} activeOpacity={0.85}>
          <Text style={styles.payBtnText}>Demo Poliçe Oluştur · {formatTRY(amount)}</Text>
        </TouchableOpacity>
        <Text style={styles.hintCenter}>Demo mod — gerçek ödeme alınmaz, kart verisi saklanmaz.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, strong, mono, last }: { label: string; value: string; strong?: boolean; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong, mono && styles.infoMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  muted: { ...Type.body, color: Colors.secondary, textAlign: 'center' },
  hintCenter: { ...Type.caption, color: Colors.placeholder, textAlign: 'center', marginTop: 8 },
  bigEmoji: { fontSize: 44, marginBottom: 12 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 1.5 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 64 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  heroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.md },
  heroLogo: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  heroLogoText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
  heroCompany: { ...Type.subhead, fontSize: 16 },
  heroMeta: { ...Type.caption, marginTop: 2 },
  heroAmount: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  heroInst: { ...Type.caption, marginTop: 2 },

  ccard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, minHeight: 170, justifyContent: 'space-between', ...Shadow.md },
  ccTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ccChip: { color: 'rgba(255,255,255,0.8)', fontSize: 24 },
  ccBrand: { color: '#fff', fontWeight: '800', letterSpacing: 2, fontSize: 14 },
  ccNumber: { color: '#fff', fontSize: 21, fontWeight: '700', letterSpacing: 2, marginVertical: 14 },
  ccBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  ccLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  ccValue: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },

  fieldLabel: { ...Type.caption, color: Colors.secondary, fontWeight: '700', marginBottom: 5, marginTop: 12 },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15, color: Colors.heading },
  row2: { flexDirection: 'row', gap: 12 },

  taksitChip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  taksitChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  taksitChipText: { ...Type.caption, color: Colors.text },
  taksitChipTextActive: { color: '#fff', fontWeight: '700' },

  secureRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginTop: 14, borderWidth: 1, borderColor: Colors.border },
  secureTitle: { ...Type.subhead, fontSize: 14 },
  secureSub: { ...Type.caption, marginTop: 1 },

  noticeBox: { backgroundColor: Colors.amberBg, borderRadius: Radius.md, padding: Spacing.md, marginTop: 12 },
  noticeText: { ...Type.caption, color: '#92400E', lineHeight: 17 },
  errBox: { backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: Spacing.md, marginTop: 12, borderWidth: 1, borderColor: '#FECACA' },
  errText: { ...Type.caption, color: Colors.danger },

  sectionLabel: { ...Type.label, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, ...Shadow.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { ...Type.caption, color: Colors.secondary },
  infoValue: { ...Type.subhead, fontSize: 14, flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  infoValueStrong: { color: Colors.primary, fontWeight: '800' },
  infoMono: { fontFamily: 'Courier', letterSpacing: 0.5 },

  payBtn: { backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.lg },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: Spacing.lg },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  successHero: { alignItems: 'center', paddingVertical: Spacing.lg },
  successEmoji: { fontSize: 52, marginBottom: 10 },
  successTitle: { ...Type.title, fontSize: 20, textAlign: 'center' },
  successSub: { ...Type.caption, marginTop: 4, textAlign: 'center' },
});
