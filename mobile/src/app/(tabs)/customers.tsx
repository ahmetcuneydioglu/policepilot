import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Linking, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { Customer } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';
import DocumentSection from '@/components/DocumentSection';
import LimitModal from '@/components/LimitModal';
import { checkLimit, limitErrorMessage } from '@/lib/limits';
import type { LimitResult } from '@/lib/limits';

const W = Dimensions.get('window').width;

// ── Insurance types (web ile birebir) ─────────────────────────────────────────
const INSURANCE_TYPES = [
  { value: 'Trafik',       label: '🚗 Trafik Sigortası',   group: 'vehicle'   },
  { value: 'Kasko',        label: '🛡️ Kasko',              group: 'vehicle'   },
  { value: 'İMM',          label: '📋 İMM',                group: 'vehicle'   },
  { value: 'Yeşil Kart',   label: '🌍 Yeşil Kart',         group: 'vehicle'   },
  { value: 'Sağlık',       label: '❤️ Sağlık Sigortası',   group: 'health'    },
  { value: 'Tamamlayıcı',  label: '🏥 Tamamlayıcı Sağlık', group: 'health'    },
  { value: 'DASK',         label: '🏠 DASK',               group: 'property'  },
  { value: 'Konut',        label: '🏡 Konut Sigortası',    group: 'property'  },
  { value: 'Seyahat',      label: '✈️ Seyahat Sağlık',    group: 'other'     },
  { value: 'Ferdi Kaza',   label: '⚡ Ferdi Kaza',         group: 'other'     },
  { value: 'Cep Telefonu', label: '📱 Cep Telefonu',       group: 'other'     },
  { value: 'Evcil Hayvan', label: '🐾 Evcil Hayvan',       group: 'other'     },
  { value: 'Diğer',        label: '📁 Diğer',              group: 'other'     },
];

function groupOf(type: string) {
  return INSURANCE_TYPES.find((t) => t.value === type)?.group ?? 'other';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function waNumber(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('0') ? '90' + cleaned.slice(1) : cleaned;
}

// ─── Customer Card ────────────────────────────────────────────────────────────
function CustomerCard({
  customer,
  onPress,
  onWA,
}: {
  customer: Customer;
  onPress: () => void;
  onWA: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(customer.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
          <Text style={styles.insuranceType}>{customer.insurance_type}</Text>
          {customer.phone ? (
            <Text style={styles.phone}>{customer.phone}</Text>
          ) : null}
          {customer.vehicle_plate ? (
            <View style={styles.plateChip}>
              <Text style={styles.plateText}>🚗 {customer.vehicle_plate}</Text>
            </View>
          ) : null}
          {customer.note ? (
            <Text style={styles.note} numberOfLines={1}>{customer.note}</Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          {customer.phone ? (
            <TouchableOpacity style={styles.waBtn} onPress={onWA} activeOpacity={0.7}>
              <Text style={styles.waBtnText}>💬</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Silme onay modal'ı ───────────────────────────────────────────────────────
function DeleteConfirmModal({
  visible,
  customerName,
  deleting,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  customerName: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={dcm.overlay}>
        <TouchableOpacity style={dcm.backdrop} activeOpacity={1} onPress={onCancel} />
        <View style={dcm.card}>
          <View style={dcm.iconWrap}>
            <Text style={dcm.icon}>🗑️</Text>
          </View>
          <Text style={dcm.title}>Müşteriyi Sil</Text>
          <Text style={dcm.desc}>
            <Text style={dcm.name}>{customerName}</Text>
            {' '}silinecek.\n\nBu müşteriye ait tüm talepler, poliçeler ve evraklar da kalıcı olarak silinir. Bu işlem geri alınamaz.
          </Text>
          <TouchableOpacity
            style={[dcm.deleteBtn, deleting && dcm.deleteBtnDisabled]}
            onPress={onConfirm}
            disabled={deleting}
            activeOpacity={0.8}
          >
            {deleting
              ? <ActivityIndicator color="#fff" />
              : <Text style={dcm.deleteBtnText}>Evet, Sil</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={dcm.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={dcm.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dcm = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: { fontSize: 30 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.heading,
    marginBottom: 10,
  },
  desc: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  name: {
    fontWeight: '700',
    color: Colors.heading,
  },
  deleteBtn: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function CustomerDetailModal({
  customer,
  onClose,
  onUpdated,
  onDeleted,
  userId,
}: {
  customer: Customer;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  userId: string | null;
}) {
  const [tab, setTab] = useState<'info' | 'notes'>('info');
  const [note, setNote] = useState(customer.note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveNote() {
    setSaving(true);
    await (supabase.from('customers') as any).update({ note }).eq('id', customer.id);
    setSaving(false);
    setSaved(true);
    onUpdated();
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await (supabase.from('customers') as any)
      .delete()
      .eq('id', customer.id);
    setDeleting(false);
    if (error) {
      setShowDeleteConfirm(false);
      Alert.alert('Silinemedi', error.message);
      return;
    }
    setShowDeleteConfirm(false);
    onDeleted();
  }

  const group = groupOf(customer.insurance_type);

  const infoRows: { label: string; value: string | null | undefined }[] = [
    { label: 'Telefon', value: customer.phone },
    { label: 'E-posta', value: customer.email },
    { label: 'TC / VKN', value: customer.identity_no },
    { label: 'Sigorta Türü', value: customer.insurance_type },
    { label: 'Kayıt', value: new Date(customer.created_at).toLocaleDateString('tr-TR') },
    { label: 'Poliçe Bitiş', value: customer.policy_end_date
        ? new Date(customer.policy_end_date).toLocaleDateString('tr-TR')
        : null },
  ];

  // extra_data rows
  const extraRows: { label: string; value: string }[] = [];
  if (customer.extra_data) {
    const labelMap: Record<string, string> = {
      vehicle_plate: 'Plaka', license_serial: 'Ruhsat Seri No',
      brand_model: 'Araç Marka/Model', vehicle_year: 'Araç Yılı',
      birth_date: 'Doğum Tarihi', gender: 'Cinsiyet', city: 'İl',
      district: 'İlçe', address: 'Adres', building_age: 'Bina Yaşı',
      area_m2: 'Alan (m²)', health_note: 'Sağlık Notu', description: 'Açıklama',
    };
    Object.entries(customer.extra_data).forEach(([k, v]) => {
      if (v) extraRows.push({ label: labelMap[k] ?? k, value: v });
    });
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.detailSafe} edges={['top']}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <View style={styles.detailAvatar}>
            <Text style={styles.detailAvatarText}>{initials(customer.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{customer.name}</Text>
            <View style={styles.typeChipSmall}>
              <Text style={styles.typeChipSmallText}>{customer.insurance_type}</Text>
            </View>
          </View>
          {/* Silme butonu */}
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            style={styles.deleteIconBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteIconBtnText}>🗑️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Silme onay modalı */}
        <DeleteConfirmModal
          visible={showDeleteConfirm}
          customerName={customer.name}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        {/* Call / WhatsApp */}
        {customer.phone ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL(`tel:${customer.phone}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnEmoji}>📞</Text>
              <Text style={styles.actionBtnLabel}>Ara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGreen]}
              onPress={() => Linking.openURL(`whatsapp://send?phone=${waNumber(customer.phone)}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnEmoji}>💬</Text>
              <Text style={[styles.actionBtnLabel, { color: '#fff' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['info', 'notes'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'info' ? 'Bilgiler' : 'Not'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.detailBody}>
          {tab === 'info' && (
            <>
              {infoRows.filter((r) => r.value).map((row) => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
              {extraRows.length > 0 && (
                <>
                  <Text style={styles.extraTitle}>Ek Bilgiler</Text>
                  {extraRows.map((row) => (
                    <View key={row.label} style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={styles.infoValue}>{row.value}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {tab === 'notes' && (
            <View>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Müşteri hakkında not ekleyin..."
                placeholderTextColor={Colors.secondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveNote}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {saved ? '✓ Kaydedildi' : 'Notu Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Evraklar */}
          <DocumentSection
            entity="customers"
            entityId={customer.id}
            agencyId={customer.agency_id ?? null}
            uploadedBy={userId}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────
function AddCustomerModal({
  agencyId,
  onClose,
  onSaved,
}: {
  agencyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [identityNo, setIdentityNo]   = useState('');
  const [note, setNote]               = useState('');
  const [insuranceType, setInsurance] = useState('');
  // vehicle
  const [plate, setPlate]             = useState('');
  const [licenseSerial, setLicense]   = useState('');
  const [brandModel, setBrand]        = useState('');
  const [vehicleYear, setYear]        = useState('');
  // health
  const [birthDate, setBirth]         = useState('');
  const [gender, setGender]           = useState('');
  const [city, setCity]               = useState('');
  const [healthNote, setHealthNote]   = useState('');
  // property
  const [propCity, setPropCity]       = useState('');
  const [propDistrict, setDistrict]   = useState('');
  const [address, setAddress]         = useState('');
  const [buildingAge, setBuildAge]    = useState('');
  const [areaM2, setArea]             = useState('');
  // other
  const [description, setDesc]        = useState('');
  // shared
  const [policyEndDate, setEndDate]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);
  // Limit modal state
  const [limitModal, setLimitModal]   = useState<{ entity: 'customers' | 'policies'; result: LimitResult } | null>(null);

  const group = groupOf(insuranceType);

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !insuranceType) {
      setError('Ad, telefon ve sigorta türü zorunludur.');
      return;
    }
    setSaving(true);
    setError('');

    // ── Müşteri limiti kontrolü ──────────────────────────────────────────────
    const limitResult = await checkLimit(agencyId, 'customers');
    if (!limitResult.ok) {
      setLimitModal({ entity: 'customers', result: limitResult });
      setSaving(false);
      return;
    }

    const extra: Record<string, string> = {};
    if (group === 'vehicle') {
      if (plate)         extra.vehicle_plate   = plate.toUpperCase();
      if (licenseSerial) extra.license_serial  = licenseSerial;
      if (brandModel)    extra.brand_model     = brandModel;
      if (vehicleYear)   extra.vehicle_year    = vehicleYear;
    } else if (group === 'health') {
      if (birthDate)  extra.birth_date  = birthDate;
      if (gender)     extra.gender      = gender;
      if (city)       extra.city        = city;
      if (healthNote) extra.health_note = healthNote;
    } else if (group === 'property') {
      if (propCity)     extra.city         = propCity;
      if (propDistrict) extra.district     = propDistrict;
      if (address)      extra.address      = address;
      if (buildingAge)  extra.building_age = buildingAge;
      if (areaM2)       extra.area_m2      = areaM2;
    } else {
      if (description) extra.description = description;
    }

    const payload: any = {
      name:            name.trim(),
      phone:           phone.trim(),
      email:           email.trim() || null,
      insurance_type:  insuranceType,
      note:            note.trim() || null,
      identity_no:     identityNo.trim() || null,
      vehicle_plate:   group === 'vehicle' ? plate.trim().toUpperCase() || null : null,
      policy_end_date: policyEndDate || null,
      extra_data:      Object.keys(extra).length ? extra : null,
    };
    if (agencyId) payload.agency_id = agencyId;

    const { error: err } = await (supabase.from('customers') as any).insert(payload);

    if (err) {
      setError('Kaydedilemedi: ' + err.message);
      setSaving(false);
      return;
    }

    // Poliçe bitiş tarihi varsa otomatik poliçe oluştur
    if (policyEndDate) {
      // Poliçe limiti de kontrol et
      const polLimitResult = await checkLimit(agencyId, 'policies');
      if (!polLimitResult.ok) {
        // Müşteri eklendi ama poliçe eklenemez — şık modal ile bilgilendir
        setSaving(false);
        setDone(true);
        onSaved();
        setLimitModal({ entity: 'policies', result: polLimitResult });
        return;
      }

      const { data: cust } = await (supabase.from('customers') as any)
        .select('id')
        .eq('name', name.trim())
        .eq('phone', phone.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cust?.id) {
        const polPayload: any = {
          customer_id: cust.id,
          policy_type: insuranceType,
          start_date:  new Date().toISOString().split('T')[0],
          end_date:    policyEndDate,
          status:      'Aktif',
        };
        if (agencyId) polPayload.agency_id = agencyId;
        await (supabase.from('policies') as any).insert(polPayload);
      }
    }

    setSaving(false);
    setDone(true);
    onSaved();
  }

  if (done) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
            <Text style={styles.doneTitle}>Müşteri Eklendi</Text>
            <Text style={styles.doneSub}>
              {name} başarıyla sisteme kaydedildi.
              {policyEndDate ? '\nPoliçe kaydı da oluşturuldu.' : ''}
            </Text>
            <TouchableOpacity style={[styles.saveBtn, { marginTop: Spacing.lg, width: '100%' }]} onPress={onClose}>
              <Text style={styles.saveBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Müşteri</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
            ) : null}

            {/* Limit modal */}
            {limitModal && (
              <LimitModal
                visible
                entity={limitModal.entity}
                current={limitModal.result.current}
                max={limitModal.result.max}
                reason={limitModal.result.reason}
                onClose={() => setLimitModal(null)}
              />
            )}

            {/* Temel Bilgiler */}
            <SectionTitle title="Temel Bilgiler" />
            <Field label="Ad Soyad *">
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ahmet Yılmaz" placeholderTextColor={Colors.secondary} />
            </Field>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Telefon *">
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="0532 123 45 67" placeholderTextColor={Colors.secondary} keyboardType="phone-pad" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="TC / VKN">
                  <TextInput style={styles.input} value={identityNo} onChangeText={setIdentityNo} placeholder="12345678901" placeholderTextColor={Colors.secondary} keyboardType="numeric" />
                </Field>
              </View>
            </View>
            <Field label="E-posta">
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="ornek@email.com" placeholderTextColor={Colors.secondary} keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <Field label="Not">
              <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} placeholder="Kısa not..." placeholderTextColor={Colors.secondary} multiline />
            </Field>

            {/* Sigorta Türü */}
            <SectionTitle title="Sigorta Türü" />
            <View style={styles.typeGrid}>
              {INSURANCE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, insuranceType === t.value && styles.typeChipActive]}
                  onPress={() => setInsurance(t.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, insuranceType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dynamic fields */}
            {insuranceType ? (
              <>
                <SectionTitle title={
                  group === 'vehicle' ? 'Araç Bilgileri' :
                  group === 'health'  ? 'Sağlık Bilgileri' :
                  group === 'property'? 'Konut Bilgileri' : 'Ek Bilgiler'
                } />

                {group === 'vehicle' && (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Field label="Plaka">
                          <TextInput style={styles.input} value={plate} onChangeText={(v) => setPlate(v.toUpperCase())} placeholder="34ABC123" placeholderTextColor={Colors.secondary} autoCapitalize="characters" />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Ruhsat Seri No">
                          <TextInput style={styles.input} value={licenseSerial} onChangeText={setLicense} placeholder="AA 00000" placeholderTextColor={Colors.secondary} />
                        </Field>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Field label="Marka / Model">
                          <TextInput style={styles.input} value={brandModel} onChangeText={setBrand} placeholder="Toyota Corolla" placeholderTextColor={Colors.secondary} />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Araç Yılı">
                          <TextInput style={styles.input} value={vehicleYear} onChangeText={setYear} placeholder="2020" placeholderTextColor={Colors.secondary} keyboardType="numeric" />
                        </Field>
                      </View>
                    </View>
                  </>
                )}

                {group === 'health' && (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Field label="Doğum Tarihi">
                          <TextInput style={styles.input} value={birthDate} onChangeText={setBirth} placeholder="1990-01-15" placeholderTextColor={Colors.secondary} />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Cinsiyet">
                          <View style={styles.genderRow}>
                            {['Erkek', 'Kadın'].map((g) => (
                              <TouchableOpacity
                                key={g}
                                style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                                onPress={() => setGender(g)}
                              >
                                <Text style={[styles.genderText, gender === g && { color: '#fff' }]}>{g}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </Field>
                      </View>
                    </View>
                    <Field label="İl">
                      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="İstanbul" placeholderTextColor={Colors.secondary} />
                    </Field>
                    <Field label="Mevcut hastalık / not">
                      <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={healthNote} onChangeText={setHealthNote} placeholder="Diyabet, tansiyon..." placeholderTextColor={Colors.secondary} multiline />
                    </Field>
                  </>
                )}

                {group === 'property' && (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Field label="İl">
                          <TextInput style={styles.input} value={propCity} onChangeText={setPropCity} placeholder="İstanbul" placeholderTextColor={Colors.secondary} />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="İlçe">
                          <TextInput style={styles.input} value={propDistrict} onChangeText={setDistrict} placeholder="Kadıköy" placeholderTextColor={Colors.secondary} />
                        </Field>
                      </View>
                    </View>
                    <Field label="Adres">
                      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Tam adres" placeholderTextColor={Colors.secondary} />
                    </Field>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Field label="Bina Yaşı">
                          <TextInput style={styles.input} value={buildingAge} onChangeText={setBuildAge} placeholder="15" placeholderTextColor={Colors.secondary} keyboardType="numeric" />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label="Alan (m²)">
                          <TextInput style={styles.input} value={areaM2} onChangeText={setArea} placeholder="120" placeholderTextColor={Colors.secondary} keyboardType="numeric" />
                        </Field>
                      </View>
                    </View>
                  </>
                )}

                {group === 'other' && (
                  <Field label="Açıklama">
                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDesc} placeholder="Sigorta detayları..." placeholderTextColor={Colors.secondary} multiline />
                  </Field>
                )}

                {/* Policy end date */}
                <Field label="Poliçe Bitiş Tarihi">
                  <TextInput style={styles.input} value={policyEndDate} onChangeText={setEndDate} placeholder="2026-01-01" placeholderTextColor={Colors.secondary} />
                </Field>
                {policyEndDate ? (
                  <View style={styles.infoHint}>
                    <Text style={styles.infoHintText}>✓ Poliçe kaydı da otomatik oluşturulacak.</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Müşteri Ekle</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CustomersScreen() {
  const router = useRouter();
  const { agencyId, role, userId } = useProfile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered]   = useState<Customer[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected]   = useState<Customer | null>(null);

  async function fetchCustomers() {
    let query = (supabase.from('customers') as any)
      .select('*')
      .order('created_at', { ascending: false });

    // agency_user ise agency_id filtresi uygula (web ile aynı mantık)
    if (role === 'agency_user' && agencyId) {
      query = query.eq('agency_id', agencyId);
    } else if (role === 'agency_user' && !agencyId) {
      // agency yok → boş döndür
      setCustomers([]);
      setFiltered([]);
      setLoading(false);
      return;
    }

    const { data } = await query;
    const list = data ?? [];
    setCustomers(list);
    setFiltered(list);
    setLoading(false);
  }

  useEffect(() => { fetchCustomers(); }, [agencyId, role]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(customers); return; }
    setFiltered(
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.insurance_type.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.vehicle_plate?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    );
  }, [search, customers]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Müşteriler</Text>
          <Text style={styles.subtitle}>{customers.length} kayıt</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Ad, telefon, sigorta türü, plaka..."
          placeholderTextColor={Colors.secondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              onPress={() => router.push(`/customer/${item.id}`)}
              onWA={() => Linking.openURL(`whatsapp://send?phone=${waNumber(item.phone)}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>{search ? 'Sonuç bulunamadı' : 'Henüz müşteri eklenmemiş'}</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      {selected && (
        <CustomerDetailModal
          customer={selected}
          onClose={() => setSelected(null)}
          onUpdated={fetchCustomers}
          onDeleted={() => { setSelected(null); fetchCustomers(); }}
          userId={userId}
        />
      )}

      {/* Add Modal */}
      {addVisible && (
        <AddCustomerModal
          agencyId={agencyId}
          onClose={() => setAddVisible(false)}
          onSaved={() => { setAddVisible(false); fetchCustomers(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  subtitle: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.heading },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  // Card
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  cardInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '700', color: Colors.heading, marginBottom: 2 },
  insuranceType: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 2 },
  phone: { fontSize: 12, color: Colors.secondary },
  plateChip: {
    alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  plateText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  note: { fontSize: 11, color: Colors.secondary, marginTop: 3 },
  cardActions: { alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  waBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FDF4',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  waBtnText: { fontSize: 18 },
  chevron: { fontSize: 20, color: Colors.border, fontWeight: '700' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.secondary },

  // Detail Modal
  detailSafe: { flex: 1, backgroundColor: Colors.background },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    backgroundColor: Colors.heading,
  },
  detailAvatar: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  detailAvatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  detailName: { color: '#fff', fontWeight: '700', fontSize: 17 },
  deleteIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(220,38,38,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  deleteIconBtnText: { fontSize: 16 },
  typeChipSmall: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(99,179,237,0.3)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  typeChipSmallText: { color: '#BEE3F8', fontSize: 11, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row', padding: Spacing.md, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border, marginRight: 8,
  },
  actionBtnGreen: { backgroundColor: '#22C55E', borderColor: '#22C55E', marginRight: 0 },
  actionBtnEmoji: { fontSize: 16, marginRight: 6 },
  actionBtnLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderColor: Colors.primary },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: Colors.secondary },
  tabBtnTextActive: { color: Colors.primary },
  detailBody: { padding: Spacing.lg, paddingBottom: 40 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.border,
  },
  infoLabel: { fontSize: 11, color: Colors.secondary, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: Colors.heading, fontWeight: '500', flex: 1, textAlign: 'right' },
  extraTitle: { fontSize: 12, fontWeight: '700', color: Colors.secondary, marginTop: Spacing.md, marginBottom: 4, textTransform: 'uppercase' },
  noteInput: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, fontSize: 14, color: Colors.heading,
    minHeight: 120, textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: Spacing.md,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Add Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalScroll: { padding: Spacing.lg, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.danger, fontSize: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  fieldGroup: { marginBottom: Spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.heading, marginBottom: 5 },
  input: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 14, color: Colors.heading,
  },
  row: { flexDirection: 'row' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  typeChip: {
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, marginRight: 7, marginBottom: 7,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 12, color: Colors.secondary, fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  genderRow: { flexDirection: 'row' },
  genderBtn: {
    flex: 1, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', marginRight: 6,
    backgroundColor: Colors.card,
  },
  genderBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderText: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  infoHint: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoHintText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  doneTitle: { fontSize: 20, fontWeight: '800', color: Colors.heading, marginBottom: 8 },
  doneSub: { fontSize: 14, color: Colors.secondary, textAlign: 'center', lineHeight: 20 },
});
