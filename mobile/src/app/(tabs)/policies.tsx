import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import type { Policy, PolicyStatus, Customer } from '@/lib/types';
import DocumentSection from '@/components/DocumentSection';
import { checkLimit } from '@/lib/limits';
import type { LimitResult } from '@/lib/limits';
import LimitModal from '@/components/LimitModal';
import BulkPolicyImportMobile from '@/components/BulkPolicyImportMobile';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── helpers ────────────────────────────────────────────────────────────────

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 864e5));
}

function isExpired(endDate: string): boolean {
  return new Date(endDate).getTime() < Date.now();
}

function formatDate(d: string) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function phoneDigits(p: string) {
  return p.replace(/\D/g, '');
}

type BadgeCfg = { bg: string; text: string; dot: string; label: string };

function expiryBadge(endDate: string, status: PolicyStatus): BadgeCfg {
  if (status === 'Pasif') {
    return { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: 'Pasif' };
  }
  if (isExpired(endDate)) {
    return { bg: Colors.dangerBg, text: Colors.danger, dot: Colors.danger, label: 'Süresi geçmiş' };
  }
  const days = daysLeft(endDate);
  if (days <= 5) return { bg: Colors.dangerBg, text: Colors.danger, dot: Colors.danger, label: `${days} gün kaldı` };
  if (days <= 15) return { bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B', label: `${days} gün kaldı` };
  if (days <= 30) return { bg: '#FEF9C3', text: '#CA8A04', dot: '#EAB308', label: `${days} gün kaldı` };
  return { bg: '#F0FDF4', text: '#16A34A', dot: '#16A34A', label: `${days} gün kaldı` };
}

// ─── types ───────────────────────────────────────────────────────────────────

type FilterKey = 'Tümü' | 'Aktif' | 'Yaklaşan' | 'Geçmiş' | 'Pasif';

const POLICY_TYPES = [
  'Trafik Sigortası',
  'Kasko',
  'Konut Sigortası',
  'DASK',
  'Sağlık Sigortası',
  'Hayat Sigortası',
  'Ferdi Kaza',
  'Seyahat Sigortası',
  'İşyeri Sigortası',
  'Diğer',
];

const FILTERS: FilterKey[] = ['Tümü', 'Aktif', 'Yaklaşan', 'Geçmiş', 'Pasif'];

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.infoRow}>
      <Text style={detailStyles.infoLabel}>{label}</Text>
      <Text style={detailStyles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── PolicyCard ──────────────────────────────────────────────────────────────

function PolicyCard({ policy, onPress }: { policy: Policy; onPress: () => void }) {
  const badge = expiryBadge(policy.end_date, policy.status);
  const isCritical = policy.status === 'Aktif' && !isExpired(policy.end_date) && daysLeft(policy.end_date) <= 5;

  return (
    <TouchableOpacity
      style={[styles.card, isCritical && styles.cardCritical]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, isCritical ? styles.avatarCritical : styles.avatarDefault]}>
          <Text style={[styles.avatarText, isCritical ? styles.avatarTextCritical : styles.avatarTextDefault]}>
            {initials(policy.customers?.name ?? '?')}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>{policy.customers?.name ?? '—'}</Text>
          <Text style={styles.policyType}>{policy.policy_type}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: badge.dot }]} />
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardInfoLabel}>Başlangıç</Text>
          <Text style={styles.cardInfoValue}>{formatDate(policy.start_date)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardInfoLabel}>Bitiş</Text>
          <Text style={[styles.cardInfoValue, isCritical && { color: Colors.danger }]}>
            {formatDate(policy.end_date)}
          </Text>
        </View>
        {policy.premium != null && (
          <View style={styles.cardInfo}>
            <Text style={styles.cardInfoLabel}>Prim</Text>
            <Text style={styles.cardInfoValue}>₺{policy.premium.toLocaleString('tr-TR')}</Text>
          </View>
        )}
        {!!policy.insurance_company && (
          <View style={styles.cardInfo}>
            <Text style={styles.cardInfoLabel}>Şirket</Text>
            <Text style={styles.cardInfoValue} numberOfLines={1}>{policy.insurance_company}</Text>
          </View>
        )}
      </View>

      {!!policy.policy_no && (
        <View style={styles.policyNoRow}>
          <Text style={styles.policyNoLabel}>Poliçe No:</Text>
          <Text style={styles.policyNoValue}>{policy.policy_no}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({
  policy,
  onClose,
  onRefresh,
  userId,
}: {
  policy: Policy;
  onClose: () => void;
  onRefresh: () => void;
  userId: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    policy_type: policy.policy_type,
    start_date: policy.start_date,
    end_date: policy.end_date,
    premium: policy.premium?.toString() ?? '',
    insurance_company: policy.insurance_company ?? '',
    policy_no: policy.policy_no ?? '',
    commission: policy.commission?.toString() ?? '',
    note: policy.note ?? '',
  });

  const badge = expiryBadge(policy.end_date, policy.status);
  const phone = policy.customers?.phone ?? '';
  const days = policy.status === 'Aktif' && !isExpired(policy.end_date) ? daysLeft(policy.end_date) : 0;

  async function handleSave() {
    setSaving(true);
    const update: Record<string, unknown> = {
      policy_type: editFields.policy_type,
      start_date: editFields.start_date,
      end_date: editFields.end_date,
    };
    if (editFields.premium) update.premium = parseFloat(editFields.premium);
    if (editFields.insurance_company) update.insurance_company = editFields.insurance_company;
    if (editFields.policy_no) update.policy_no = editFields.policy_no;
    if (editFields.commission) update.commission = parseFloat(editFields.commission);
    if (editFields.note) update.note = editFields.note;

    const { error } = await (supabase.from('policies') as any).update(update).eq('id', policy.id);
    setSaving(false);
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      setEditing(false);
      onRefresh();
    }
  }

  function handleCall() {
    if (!phone) return;
    Linking.openURL(`tel:${phoneDigits(phone)}`);
  }

  function handleWhatsApp() {
    if (!phone) return;
    const name = policy.customers?.name ?? 'Müşteri';
    const endStr = formatDate(policy.end_date);
    const dayText = days > 0 ? `${days} gün içinde` : 'yakında';
    const message = encodeURIComponent(
      `Sayın ${name},\n\n"${policy.policy_type}" poliçenizin bitiş tarihi ${endStr} olup ${dayText} sona erecektir.\n\nPoliçenizi yenilemek için bizimle iletişime geçebilirsiniz.\n\nSaygılarımızla 🙏`
    );
    Linking.openURL(`whatsapp://send?phone=90${phoneDigits(phone)}&text=${message}`);
  }

  async function handleToggleStatus() {
    const next: PolicyStatus = policy.status === 'Aktif' ? 'Pasif' : 'Aktif';
    Alert.alert(
      `Poliçeyi ${next} yap`,
      `Bu poliçeyi ${next} olarak işaretlemek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            await (supabase.from('policies') as any).update({ status: next }).eq('id', policy.id);
            onRefresh();
          },
        },
      ]
    );
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
        {/* Header */}
        <View style={detailStyles.header}>
          <View style={detailStyles.avatarLarge}>
            <Text style={detailStyles.avatarLargeText}>{initials(policy.customers?.name ?? '?')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={detailStyles.customerName}>{policy.customers?.name ?? '—'}</Text>
            <Text style={detailStyles.policyType}>{policy.policy_type}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
            <Text style={detailStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Badge + actions */}
        <View style={detailStyles.actionRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: badge.dot }]} />
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <View style={detailStyles.actionBtns}>
            {!!phone && (
              <>
                <TouchableOpacity style={detailStyles.callBtn} onPress={handleCall}>
                  <Text style={detailStyles.callBtnText}>📞 Ara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={detailStyles.waBtn} onPress={handleWhatsApp}>
                  <Text style={detailStyles.waBtnText}>💬 Hatırlat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}>
          {/* Info card */}
          <View style={detailStyles.infoCard}>
            <Text style={detailStyles.sectionTitle}>Poliçe Bilgileri</Text>

            {editing ? (
              <View>
                <Text style={detailStyles.fieldLabel}>Poliçe Türü</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.policy_type}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, policy_type: v }))}
                />
                <Text style={detailStyles.fieldLabel}>Başlangıç Tarihi (YYYY-AA-GG)</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.start_date}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, start_date: v }))}
                  placeholder="2024-01-01"
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Bitiş Tarihi (YYYY-AA-GG)</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.end_date}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, end_date: v }))}
                  placeholder="2025-01-01"
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Prim (₺)</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.premium}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, premium: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Sigorta Şirketi</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.insurance_company}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, insurance_company: v }))}
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Poliçe No</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.policy_no}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, policy_no: v }))}
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Komisyon (₺)</Text>
                <TextInput
                  style={detailStyles.input}
                  value={editFields.commission}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, commission: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.secondary}
                />
                <Text style={detailStyles.fieldLabel}>Not</Text>
                <TextInput
                  style={[detailStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={editFields.note}
                  onChangeText={(v) => setEditFields((p) => ({ ...p, note: v }))}
                  multiline
                  placeholderTextColor={Colors.secondary}
                />
                <View style={detailStyles.editActions}>
                  <TouchableOpacity
                    style={[detailStyles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={detailStyles.saveBtnText}>Kaydet</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={detailStyles.cancelEditBtn} onPress={() => setEditing(false)}>
                    <Text style={detailStyles.cancelEditBtnText}>İptal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <InfoRow label="Poliçe Türü" value={policy.policy_type} />
                <InfoRow label="Başlangıç" value={formatDate(policy.start_date)} />
                <InfoRow label="Bitiş" value={formatDate(policy.end_date)} />
                {policy.premium != null && (
                  <InfoRow label="Prim" value={`₺${policy.premium.toLocaleString('tr-TR')}`} />
                )}
                {!!policy.insurance_company && (
                  <InfoRow label="Sigorta Şirketi" value={policy.insurance_company} />
                )}
                {!!policy.policy_no && (
                  <InfoRow label="Poliçe No" value={policy.policy_no} />
                )}
                {policy.commission != null && (
                  <InfoRow label="Komisyon" value={`₺${policy.commission.toLocaleString('tr-TR')}`} />
                )}
                <InfoRow label="Durum" value={policy.status} />
                {!!policy.note && <InfoRow label="Not" value={policy.note} />}

                <TouchableOpacity style={detailStyles.editBtn} onPress={() => setEditing(true)}>
                  <Text style={detailStyles.editBtnText}>✏️ Düzenle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Customer card */}
          {!!policy.customers && (
            <View style={detailStyles.infoCard}>
              <Text style={detailStyles.sectionTitle}>Müşteri</Text>
              <InfoRow label="Ad Soyad" value={policy.customers.name} />
              {!!policy.customers.phone && (
                <InfoRow label="Telefon" value={policy.customers.phone} />
              )}
            </View>
          )}

          {/* Status toggle */}
          <TouchableOpacity
            style={[
              detailStyles.statusToggle,
              policy.status === 'Aktif' ? detailStyles.statusTogglePasif : detailStyles.statusToggleAktif,
            ]}
            onPress={handleToggleStatus}
          >
            <Text style={detailStyles.statusToggleText}>
              {policy.status === 'Aktif' ? '🔴 Poliçeyi Pasif Yap' : '✅ Poliçeyi Aktif Yap'}
            </Text>
          </TouchableOpacity>

          {/* Evraklar */}
          <DocumentSection
            entity="policies"
            entityId={policy.id}
            agencyId={policy.agency_id ?? null}
            uploadedBy={userId}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── AddModal ────────────────────────────────────────────────────────────────

function AddModal({
  visible,
  onClose,
  onAdded,
  agencyId,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  agencyId: string | null;
}) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'name' | 'insurance_type'>[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Pick<Customer, 'id' | 'name' | 'insurance_type'> | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [policyType, setPolicyType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [commission, setCommission] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [limitModal, setLimitModal] = useState<LimitResult | null>(null);

  useEffect(() => {
    if (!visible) {
      setCustomerSearch('');
      setSelectedCustomer(null);
      setPolicyType('');
      setStartDate('');
      setEndDate('');
      setPremium('');
      setInsuranceCompany('');
      setPolicyNo('');
      setCommission('');
      setNote('');
      setCustomers([]);
      setShowSuggestions(false);
    }
  }, [visible]);

  async function searchCustomers(text: string) {
    setCustomerSearch(text);
    if (text.length < 2) {
      setCustomers([]);
      setShowSuggestions(false);
      return;
    }
    let q = (supabase.from('customers') as any)
      .select('id, name, insurance_type')
      .ilike('name', `%${text}%`)
      .limit(6);
    if (agencyId) q = q.eq('agency_id', agencyId);
    const { data } = await q;
    setCustomers(data ?? []);
    setShowSuggestions(true);
  }

  async function handleSave() {
    if (!selectedCustomer) return Alert.alert('Hata', 'Müşteri seçiniz.');
    if (!policyType) return Alert.alert('Hata', 'Poliçe türü seçiniz.');
    if (!startDate) return Alert.alert('Hata', 'Başlangıç tarihi giriniz.');
    if (!endDate) return Alert.alert('Hata', 'Bitiş tarihi giriniz.');

    setSaving(true);

    // ── Poliçe limiti kontrolü ───────────────────────────────────────────────
    const limitResult = await checkLimit(agencyId, 'policies');
    if (!limitResult.ok) {
      setLimitModal(limitResult);
      setSaving(false);
      return;
    }

    const insert: Record<string, unknown> = {
      customer_id: selectedCustomer.id,
      policy_type: policyType,
      start_date: startDate,
      end_date: endDate,
      status: 'Aktif',
    };
    if (agencyId) insert.agency_id = agencyId;
    if (premium) insert.premium = parseFloat(premium);
    if (insuranceCompany) insert.insurance_company = insuranceCompany;
    if (policyNo) insert.policy_no = policyNo;
    if (commission) insert.commission = parseFloat(commission);
    if (note) insert.note = note;

    const { error } = await (supabase.from('policies') as any).insert(insert);
    setSaving(false);
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      onAdded();
      onClose();
    }
  }

  const typeChipWidth = (SCREEN_WIDTH - Spacing.md * 2 - 8) / 2;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={addStyles.header}>
            <Text style={addStyles.title}>Yeni Poliçe</Text>
            <TouchableOpacity onPress={onClose} style={addStyles.closeBtn}>
              <Text style={addStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Limit modal */}
          {limitModal && (
            <LimitModal
              visible
              entity="policies"
              current={limitModal.current}
              max={limitModal.max}
              reason={limitModal.reason}
              onClose={() => setLimitModal(null)}
            />
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={addStyles.content} keyboardShouldPersistTaps="handled">
            {/* Customer search */}
            <Text style={addStyles.label}>Müşteri *</Text>
            {selectedCustomer ? (
              <TouchableOpacity
                style={addStyles.selectedCustomer}
                onPress={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                }}
              >
                <Text style={addStyles.selectedCustomerName}>{selectedCustomer.name}</Text>
                <Text style={addStyles.selectedCustomerSub}>Değiştir ×</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <TextInput
                  style={addStyles.input}
                  placeholder="Müşteri adı ile ara..."
                  value={customerSearch}
                  onChangeText={searchCustomers}
                  placeholderTextColor={Colors.secondary}
                />
                {showSuggestions && customers.length > 0 && (
                  <View style={addStyles.suggestions}>
                    {customers.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={addStyles.suggestion}
                        onPress={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch(c.name);
                          setShowSuggestions(false);
                        }}
                      >
                        <Text style={addStyles.suggestionName}>{c.name}</Text>
                        <Text style={addStyles.suggestionSub}>{c.insurance_type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Policy type chips */}
            <Text style={addStyles.label}>Poliçe Türü *</Text>
            <View style={addStyles.typeGrid}>
              {POLICY_TYPES.map((t, i) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    addStyles.typeChip,
                    { width: typeChipWidth },
                    policyType === t && addStyles.typeChipSelected,
                    i % 2 === 0 ? { marginRight: 8 } : {},
                  ]}
                  onPress={() => setPolicyType(t)}
                >
                  <Text style={[addStyles.typeChipText, policyType === t && addStyles.typeChipTextSelected]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={addStyles.label}>Başlangıç Tarihi * (YYYY-AA-GG)</Text>
            <TextInput
              style={addStyles.input}
              placeholder="2024-01-01"
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Bitiş Tarihi * (YYYY-AA-GG)</Text>
            <TextInput
              style={addStyles.input}
              placeholder="2025-01-01"
              value={endDate}
              onChangeText={setEndDate}
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Sigorta Şirketi</Text>
            <TextInput
              style={addStyles.input}
              placeholder="Şirket adı"
              value={insuranceCompany}
              onChangeText={setInsuranceCompany}
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Poliçe No</Text>
            <TextInput
              style={addStyles.input}
              placeholder="Poliçe numarası"
              value={policyNo}
              onChangeText={setPolicyNo}
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Prim (₺)</Text>
            <TextInput
              style={addStyles.input}
              placeholder="0"
              value={premium}
              onChangeText={setPremium}
              keyboardType="numeric"
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Komisyon (₺)</Text>
            <TextInput
              style={addStyles.input}
              placeholder="0"
              value={commission}
              onChangeText={setCommission}
              keyboardType="numeric"
              placeholderTextColor={Colors.secondary}
            />

            <Text style={addStyles.label}>Not</Text>
            <TextInput
              style={[addStyles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Opsiyonel not..."
              value={note}
              onChangeText={setNote}
              multiline
              placeholderTextColor={Colors.secondary}
            />

            <TouchableOpacity
              style={[addStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={addStyles.saveBtnText}>Poliçeyi Kaydet</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PoliciesScreen() {
  const { role, agencyId, userId } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('Tümü');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Policy | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  // App icon Quick Action "Poliçe Tara" → /(tabs)/policies?scan=1 ile gelir
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  useEffect(() => { if (scan === '1') setOcrOpen(true); }, [scan]);

  const fetchPolicies = useCallback(async () => {
    let q = (supabase.from('policies') as any)
      .select('*, customers(name, phone)')
      .order('end_date', { ascending: true });
    if (role === 'agency_user' && agencyId) {
      q = q.eq('agency_id', agencyId);
    }
    const { data } = await q;
    setPolicies(data ?? []);
  }, [role, agencyId]);

  useEffect(() => {
    setLoading(true);
    fetchPolicies().finally(() => setLoading(false));
  }, [fetchPolicies]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchPolicies();
    setRefreshing(false);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().split('T')[0];

  function matchesFilter(p: Policy): boolean {
    switch (filter) {
      case 'Aktif': return p.status === 'Aktif' && p.end_date >= todayStr;
      case 'Yaklaşan': return p.status === 'Aktif' && p.end_date >= todayStr && p.end_date <= in30Str;
      case 'Geçmiş': return p.end_date < todayStr;
      case 'Pasif': return p.status === 'Pasif';
      default: return true;
    }
  }

  function matchesSearch(p: Policy): boolean {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.customers?.name?.toLowerCase().includes(q) ?? false) ||
      p.policy_type.toLowerCase().includes(q) ||
      (p.insurance_company?.toLowerCase().includes(q) ?? false) ||
      (p.policy_no?.toLowerCase().includes(q) ?? false)
    );
  }

  const filtered = policies.filter((p) => matchesFilter(p) && matchesSearch(p));

  function countFor(f: FilterKey) {
    switch (f) {
      case 'Tümü': return policies.length;
      case 'Aktif': return policies.filter((p) => p.status === 'Aktif' && p.end_date >= todayStr).length;
      case 'Yaklaşan': return policies.filter((p) => p.status === 'Aktif' && p.end_date >= todayStr && p.end_date <= in30Str).length;
      case 'Geçmiş': return policies.filter((p) => p.end_date < todayStr).length;
      case 'Pasif': return policies.filter((p) => p.status === 'Pasif').length;
      default: return 0;
    }
  }

  // Alert banners (active + not yet expired)
  const critical = policies.filter((p) => p.status === 'Aktif' && !isExpired(p.end_date) && daysLeft(p.end_date) <= 5);
  const warning = policies.filter((p) => {
    const d = daysLeft(p.end_date);
    return p.status === 'Aktif' && !isExpired(p.end_date) && d > 5 && d <= 15;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Poliçeler</Text>
          <Text style={styles.subtitle}>{loading ? 'Yükleniyor...' : `${policies.length} poliçe`}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.ocrBtn} onPress={() => setOcrOpen(true)} activeOpacity={0.8}>
            <Text style={styles.ocrBtnText}>📷 Tara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Poliçe</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alert banners */}
      {!loading && critical.length > 0 && (
        <View style={styles.bannerCritical}>
          <View style={styles.bannerDotCritical} />
          <Text style={styles.bannerTextCritical}>
            <Text style={{ fontWeight: '800' }}>{critical.length} poliçe</Text> kritik — 5 gün veya daha az kaldı
          </Text>
        </View>
      )}
      {!loading && warning.length > 0 && (
        <View style={styles.bannerWarning}>
          <View style={styles.bannerDotWarning} />
          <Text style={styles.bannerTextWarning}>
            <Text style={{ fontWeight: '800' }}>{warning.length} poliçe</Text> yaklaşıyor — 15 gün içinde bitiyor
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Poliçe ara..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.secondary}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f}{countFor(f) > 0 ? ` (${countFor(f)})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📄</Text>
          <Text style={styles.emptyText}>
            {search ? 'Sonuç bulunamadı' : 'Henüz poliçe yok'}
          </Text>
          {!search && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setAddVisible(true)}>
              <Text style={styles.emptyAddBtnText}>İlk poliçeyi ekle</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + Spacing.md }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PolicyCard policy={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      {/* Detail modal */}
      {!!selected && (
        <DetailModal
          policy={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            fetchPolicies();
            setSelected(null);
          }}
          userId={userId}
        />
      )}

      {/* Add modal */}
      <AddModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onAdded={fetchPolicies}
        agencyId={agencyId}
      />

      {/* OCR ile tekli/toplu poliçe içe aktarma */}
      {ocrOpen && (
        <BulkPolicyImportMobile
          agencyId={agencyId}
          onClose={() => setOcrOpen(false)}
          onDone={fetchPolicies}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.heading, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ocrBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md },
  ocrBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  bannerCritical: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginHorizontal: Spacing.lg,
    marginBottom: 6,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerDotCritical: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, marginRight: 10 },
  bannerTextCritical: { fontSize: 13, color: '#991B1B', flex: 1 },
  bannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginHorizontal: Spacing.lg,
    marginBottom: 6,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerDotWarning: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, marginRight: 10 },
  bannerTextWarning: { fontSize: 13, color: '#92400E', flex: 1 },

  searchRow: { paddingHorizontal: Spacing.lg, marginBottom: 8 },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 15,
    color: Colors.heading,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
    paddingTop: 4,
    alignItems: 'center',
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: '#fff' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: Colors.secondary, fontWeight: '500' },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyAddBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardCritical: { borderColor: '#FECACA', backgroundColor: '#FFFAFA' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarDefault: { backgroundColor: Colors.primaryLight },
  avatarCritical: { backgroundColor: Colors.dangerBg },
  avatarText: { fontSize: 14, fontWeight: '800' },
  avatarTextDefault: { color: Colors.primary },
  avatarTextCritical: { color: Colors.danger },
  customerName: { fontSize: 15, fontWeight: '700', color: Colors.heading, marginBottom: 2 },
  policyType: { fontSize: 12, color: Colors.secondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 10 },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap' },
  cardInfo: { marginRight: 20, marginBottom: 6 },
  cardInfoLabel: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardInfoValue: { fontSize: 13, color: Colors.heading, fontWeight: '600', marginTop: 2 },
  policyNoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  policyNoLabel: { fontSize: 11, color: Colors.secondary, marginRight: 6 },
  policyNoValue: { fontSize: 12, color: Colors.heading, fontWeight: '600' },
});

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarLargeText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  customerName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  policyType: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionBtns: { flexDirection: 'row', marginLeft: 'auto' },
  callBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    marginLeft: 8,
  },
  callBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  waBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    marginLeft: 8,
  },
  waBtnText: { color: Colors.success, fontWeight: '700', fontSize: 13 },

  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 13, color: Colors.secondary },
  infoValue: {
    fontSize: 13,
    color: Colors.heading,
    fontWeight: '600',
    maxWidth: SCREEN_WIDTH * 0.5,
    textAlign: 'right',
  },

  editBtn: {
    marginTop: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.heading,
  },
  editActions: { flexDirection: 'row', marginTop: 16 },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelEditBtnText: { color: Colors.secondary, fontWeight: '600', fontSize: 15 },

  statusToggle: {
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTogglePasif: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  statusToggleAktif: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' },
  statusToggleText: { fontSize: 15, fontWeight: '700', color: Colors.heading },
});

const addStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 16, color: Colors.secondary, fontWeight: '700' },
  content: { padding: Spacing.md, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.heading, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.heading,
  },
  selectedCustomer: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCustomerName: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  selectedCustomerSub: { fontSize: 12, color: Colors.primary },
  suggestions: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestion: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionName: { fontSize: 14, fontWeight: '600', color: Colors.heading },
  suggestionSub: { fontSize: 12, color: Colors.secondary, marginTop: 2 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginBottom: 8,
    alignItems: 'center',
  },
  typeChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '600', color: Colors.secondary, textAlign: 'center' },
  typeChipTextSelected: { color: '#fff' },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
