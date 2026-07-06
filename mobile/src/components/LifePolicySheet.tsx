/**
 * LifePolicySheet — Hayat Sigortası poliçe formu (ürün-özel ikinci form).
 * Yeni Müşteri akışında "Hayat" seçilince açılır; mevcut müşteriye de eklenebilir.
 * Operasyon ekranı: aktüeryal alan yok — acentenin günlük kullandığı alanlar.
 * Kayıt: policies (details jsonb) + policy_payments (otomatik prim takvimi).
 */

import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type } from '@/lib/theme';
import { successHaptic, errorHaptic, tapHaptic } from '@/lib/haptics';
import {
  LIFE_POLICY_TYPE, COVERAGE_PRESETS, PAYMENT_PERIODS, CURRENCIES, RELATIONS,
  LifeBeneficiary, LifeDetails, generateSchedule, insertSchedule, parseAmount,
} from '@/lib/lifePolicy';
import { checkLimit } from '@/lib/limits';

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTR(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[st.chip, on && st.chipOn]} onPress={() => { tapHaptic(); onPress(); }} activeOpacity={0.7}>
      <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={st.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={st.sectionTitle}>{children}</Text>;
}

function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [show, setShow] = useState(false);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={new Date(`${value}T12:00:00`)}
        mode="date"
        display="compact"
        locale="tr-TR"
        onChange={(_e, d) => { if (d) onChange(toISO(d)); }}
      />
    );
  }
  return (
    <>
      <TouchableOpacity style={st.input} onPress={() => setShow(true)}>
        <Text style={{ color: Colors.heading }}>{fmtTR(value)}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={new Date(`${value}T12:00:00`)}
          mode="date"
          onChange={(_e, d) => { setShow(false); if (d) onChange(toISO(d)); }}
        />
      )}
    </>
  );
}

export default function LifePolicySheet({
  customerId, customerName, agencyId, onClose, onSaved,
}: {
  customerId: string;
  customerName: string;
  agencyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = toISO(new Date());
  const nextYear = toISO(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));

  // 1) Genel
  const [policyNo, setPolicyNo] = useState('');
  const [company, setCompany] = useState('');
  const [productName, setProductName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextYear);
  const [status, setStatus] = useState<'Aktif' | 'Pasif'>('Aktif');

  // 2) Sigortalı
  const [policyholder, setPolicyholder] = useState(customerName);
  const [insured, setInsured] = useState(customerName);
  const [relation, setRelation] = useState<string>('Kendisi');

  // 3) Prim
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [period, setPeriod] = useState('monthly');

  // 4) Teminatlar
  const [coverages, setCoverages] = useState<string[]>(['Vefat Teminatı']);
  const [customCoverage, setCustomCoverage] = useState('');

  // 5) Lehtarlar
  const [beneficiaries, setBeneficiaries] = useState<LifeBeneficiary[]>([]);

  const [saving, setSaving] = useState(false);

  const scheduleCount = useMemo(
    () => generateSchedule(startDate, endDate, period).length,
    [startDate, endDate, period]
  );
  const shareTotal = useMemo(
    () => beneficiaries.reduce((s, b) => s + (Number(b.share) || 0), 0),
    [beneficiaries]
  );

  function toggleCoverage(c: string) {
    setCoverages((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }
  function addCustomCoverage() {
    const v = customCoverage.trim();
    if (!v) return;
    if (!coverages.includes(v)) setCoverages((prev) => [...prev, v]);
    setCustomCoverage('');
  }
  function updateBeneficiary(i: number, patch: Partial<LifeBeneficiary>) {
    setBeneficiaries((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function save() {
    if (!company.trim()) { Alert.alert('Eksik bilgi', 'Sigorta şirketi zorunludur.'); return; }
    if (endDate <= startDate) { Alert.alert('Tarih hatası', 'Bitiş tarihi başlangıçtan sonra olmalı.'); return; }
    const amountNum = parseAmount(amount);

    setSaving(true);

    // Abonelik poliçe limiti (diğer poliçe akışlarıyla tutarlı)
    const limitResult = await checkLimit(agencyId, 'policies');
    if (!limitResult.ok) {
      setSaving(false);
      Alert.alert('Poliçe limiti', 'Plan limitinize ulaştınız — poliçe eklemek için planınızı yükseltin.');
      return;
    }
    const details: LifeDetails = {
      kind: 'life',
      product_name: productName.trim() || null,
      policyholder: policyholder.trim() || null,
      insured: insured.trim() || null,
      insured_relation: relation,
      currency,
      payment_period: period,
      coverages,
      beneficiaries: beneficiaries
        .filter((b) => b.name.trim())
        .map((b) => ({ ...b, name: b.name.trim(), share: b.share ? Number(b.share) : null, phone: b.phone?.trim() || null })),
    };

    const { data: pol, error } = await (supabase.from('policies') as any)
      .insert({
        agency_id: agencyId,
        customer_id: customerId,
        policy_type: LIFE_POLICY_TYPE,
        start_date: startDate,
        end_date: endDate,
        premium: amountNum,
        status,
        insurance_company: company.trim(),
        policy_no: policyNo.trim() || null,
        details,
      })
      .select('id')
      .single();

    if (error || !pol?.id) {
      setSaving(false);
      errorHaptic();
      Alert.alert('Kaydedilemedi', error?.message ?? 'Poliçe oluşturulamadı.');
      return;
    }

    // Prim takvimi (best-effort: takvim hatası poliçeyi geri almaz, kullanıcı bilgilendirilir)
    const dates = generateSchedule(startDate, endDate, period);
    const { error: schedErr } = await insertSchedule(agencyId, pol.id, dates, amountNum, currency);
    setSaving(false);
    if (schedErr) {
      Alert.alert('Poliçe kaydedildi', `Ancak prim takvimi oluşturulamadı: ${schedErr}`);
    }
    successHaptic();
    onSaved();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.header}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Poliçe kaydedilmedi', `${customerName} müşterisi kayıtlı kalacak; hayat poliçesini daha sonra Poliçeler'den ekleyebilirsin. Çıkılsın mı?`, [
                { text: 'Devam Et', style: 'cancel' },
                { text: 'Çık', style: 'destructive', onPress: onClose },
              ])
            }
            style={st.hBtn}
          ><Text style={st.hCancel}>Vazgeç</Text></TouchableOpacity>
          <Text style={st.hTitle}>❤️ Hayat Sigortası</Text>
          <View style={st.hBtn} />
        </View>
        <Text style={st.subHeader}>{customerName}</Text>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <SectionTitle>1 · GENEL BİLGİLER</SectionTitle>
            <Field label="SİGORTA ŞİRKETİ *">
              <TextInput style={st.input} value={company} onChangeText={setCompany}
                placeholder="Örn: Anadolu Hayat" placeholderTextColor={Colors.placeholder} />
            </Field>
            <Field label="ÜRÜN ADI">
              <TextInput style={st.input} value={productName} onChangeText={setProductName}
                placeholder="Örn: Birikimli Hayat Plus" placeholderTextColor={Colors.placeholder} />
            </Field>
            <Field label="POLİÇE NO">
              <TextInput style={st.input} value={policyNo} onChangeText={setPolicyNo}
                placeholder="Poliçe numarası" placeholderTextColor={Colors.placeholder} autoCapitalize="characters" />
            </Field>
            <View style={st.row2}>
              <View style={{ flex: 1 }}>
                <Field label="BAŞLANGIÇ"><DateField value={startDate} onChange={setStartDate} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="BİTİŞ"><DateField value={endDate} onChange={setEndDate} /></Field>
              </View>
            </View>
            <Field label="POLİÇE DURUMU">
              <View style={st.chipRow}>
                <Chip on={status === 'Aktif'} label="✓ Aktif" onPress={() => setStatus('Aktif')} />
                <Chip on={status === 'Pasif'} label="Pasif" onPress={() => setStatus('Pasif')} />
              </View>
            </Field>

            <SectionTitle>2 · SİGORTALI BİLGİLERİ</SectionTitle>
            <Field label="SİGORTA ETTİREN">
              <TextInput style={st.input} value={policyholder} onChangeText={setPolicyholder}
                placeholderTextColor={Colors.placeholder} />
            </Field>
            <Field label="SİGORTALI">
              <TextInput style={st.input} value={insured} onChangeText={setInsured}
                placeholderTextColor={Colors.placeholder} />
            </Field>
            <Field label="YAKINLIK">
              <View style={st.chipRow}>
                {RELATIONS.map((r) => <Chip key={r} on={relation === r} label={r} onPress={() => setRelation(r)} />)}
              </View>
            </Field>

            <SectionTitle>3 · PRİM BİLGİLERİ</SectionTitle>
            <View style={st.row2}>
              <View style={{ flex: 1 }}>
                <Field label="PRİM TUTARI">
                  <TextInput style={st.input} value={amount} onChangeText={setAmount}
                    placeholder="0" placeholderTextColor={Colors.placeholder} keyboardType="decimal-pad" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="PARA BİRİMİ">
                  <View style={st.chipRow}>
                    {CURRENCIES.map((c) => <Chip key={c.key} on={currency === c.key} label={c.label} onPress={() => setCurrency(c.key)} />)}
                  </View>
                </Field>
              </View>
            </View>
            <Field label="ÖDEME PERİYODU">
              <View style={st.chipRow}>
                {PAYMENT_PERIODS.map((p) => <Chip key={p.key} on={period === p.key} label={p.label} onPress={() => setPeriod(p.key)} />)}
              </View>
              <Text style={st.hint}>
                📅 {scheduleCount} taksitlik prim takvimi otomatik oluşturulacak — ödemeler poliçe detayından takip edilir.
              </Text>
            </Field>

            <SectionTitle>4 · TEMİNATLAR</SectionTitle>
            <View style={[st.chipRow, { marginTop: Spacing.sm }]}>
              {COVERAGE_PRESETS.map((c) => <Chip key={c} on={coverages.includes(c)} label={c} onPress={() => toggleCoverage(c)} />)}
              {coverages.filter((c) => !COVERAGE_PRESETS.includes(c as (typeof COVERAGE_PRESETS)[number])).map((c) => (
                <Chip key={c} on label={`${c} ✕`} onPress={() => toggleCoverage(c)} />
              ))}
            </View>
            <View style={st.addRow}>
              <TextInput style={[st.input, { flex: 1, marginTop: 0 }]} value={customCoverage} onChangeText={setCustomCoverage}
                placeholder="Diğer teminat ekle…" placeholderTextColor={Colors.placeholder}
                onSubmitEditing={addCustomCoverage} returnKeyType="done" />
              <TouchableOpacity style={st.addBtn} onPress={addCustomCoverage} activeOpacity={0.8}>
                <Text style={st.addBtnText}>+ Ekle</Text>
              </TouchableOpacity>
            </View>

            <SectionTitle>5 · LEHTARLAR</SectionTitle>
            {beneficiaries.map((b, i) => (
              <View key={i} style={st.benCard}>
                <View style={st.benHead}>
                  <Text style={st.benTitle}>Lehtar {i + 1}</Text>
                  <TouchableOpacity onPress={() => setBeneficiaries((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Text style={st.benRemove}>Kaldır</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={st.input} value={b.name} onChangeText={(v) => updateBeneficiary(i, { name: v })}
                  placeholder="Ad Soyad" placeholderTextColor={Colors.placeholder} />
                <View style={st.chipRow}>
                  {RELATIONS.map((r) => (
                    <Chip key={r} on={b.relation === r} label={r} onPress={() => updateBeneficiary(i, { relation: r })} />
                  ))}
                </View>
                <View style={st.row2}>
                  <TextInput style={[st.input, { flex: 1 }]} value={b.share != null ? String(b.share) : ''}
                    onChangeText={(v) => updateBeneficiary(i, { share: v ? Number(v.replace(',', '.')) : null })}
                    placeholder="Pay %" placeholderTextColor={Colors.placeholder} keyboardType="decimal-pad" />
                  <TextInput style={[st.input, { flex: 2 }]} value={b.phone ?? ''}
                    onChangeText={(v) => updateBeneficiary(i, { phone: v })}
                    placeholder="Telefon" placeholderTextColor={Colors.placeholder} keyboardType="phone-pad" />
                </View>
              </View>
            ))}
            {beneficiaries.length > 0 && (
              <Text style={[st.hint, shareTotal !== 100 && { color: Colors.warning }]}>
                Toplam pay: %{shareTotal}{shareTotal !== 100 ? ' (100 olması önerilir)' : ' ✓'}
              </Text>
            )}
            <TouchableOpacity
              style={st.addBenBtn}
              onPress={() => { tapHaptic(); setBeneficiaries((prev) => [...prev, { name: '', relation: 'Eş', share: prev.length === 0 ? 100 : null, phone: null }]); }}
              activeOpacity={0.8}
            >
              <Text style={st.addBenText}>+ Lehtar Ekle</Text>
            </TouchableOpacity>

            <Text style={st.footNote}>
              📎 Evraklar (poliçe PDF, sağlık beyanı, kimlik…) ve 🤝 ilişki akışı, kayıttan sonra poliçe
              detayından ve müşteri kartından yönetilir.
            </Text>

            <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Poliçeyi Kaydet</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 4,
    backgroundColor: Colors.card,
  },
  hBtn: { minWidth: 64 },
  hCancel: { ...Type.subhead, color: Colors.secondary },
  hTitle: { ...Type.heading, fontSize: 16 },
  subHeader: {
    ...Type.caption, textAlign: 'center', paddingBottom: 10,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },

  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  sectionTitle: { ...Type.label, color: Colors.primary, marginTop: Spacing.lg, letterSpacing: 1 },
  fieldLabel: { ...Type.label, marginBottom: 6 },
  input: {
    marginTop: 4, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.heading,
  },
  row2: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  chipTextOn: { color: '#fff' },
  hint: { ...Type.caption, color: Colors.secondary, marginTop: 8, lineHeight: 17 },

  addRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, alignItems: 'center' },
  addBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 11, borderRadius: Radius.md },
  addBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  benCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginTop: Spacing.sm,
  },
  benHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  benTitle: { ...Type.subhead, fontSize: 13 },
  benRemove: { ...Type.caption, color: Colors.danger, fontWeight: '700' },
  addBenBtn: {
    marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center',
  },
  addBenText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  footNote: { ...Type.caption, color: Colors.secondary, marginTop: Spacing.lg, lineHeight: 18 },
  saveBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
