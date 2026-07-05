/**
 * src/app/(tabs)/admin.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Super Admin — Acente Yönetimi Ekranı
 *
 * KURALLAR:
 *  - Sadece anon key — service role asla kullanılmaz
 *  - Yalnızca role === 'super_admin' kullanıcılar bu sekmeyi görebilir
 *  - RLS korunur: anon key + auth.uid() tabanlı politikalar
 *  - StyleSheet'te gap: kullanılmaz (React Native crash)
 *  - minWidth/width için % değil piksel kullanılır
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/useProfile';
import { Colors, Spacing, Radius } from '@/lib/theme';
import type { Agency, AgencyCounts, Profile } from '@/lib/types';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  starter:    { label: 'Starter',    color: '#6B7280', bg: '#F3F4F6' },
  pro:        { label: 'Pro',        color: '#1D4ED8', bg: '#DBEAFE' },
  enterprise: { label: 'Enterprise', color: '#6D28D9', bg: '#EDE9FE' },
};

const EMPTY_FORM = {
  name: '',
  slug: '',
  phone: '',
  email: '',
  plan: 'starter' as string,
  max_users: '20',
  max_customers: '200',
  max_requests: '500',
  max_policies: '500',
  primary_color: '#2563eb',
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── İlerleme çubuğu ──────────────────────────────────────────────────────────
function UsageBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(current / max, 1) : 0;
  const atLimit = current >= max;
  const nearLimit = pct >= 0.8 && !atLimit;

  const barColor = atLimit
    ? '#DC2626'
    : nearLimit
    ? '#D97706'
    : Colors.primary;

  const W = 220;

  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={[bar.track, { width: W }]}>
        <View
          style={[
            bar.fill,
            { width: Math.round(pct * W), backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={[bar.count, atLimit && { color: '#DC2626' }]}>
        {current}/{max}
      </Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    width: 80,
    fontSize: 11,
    color: Colors.secondary,
  },
  track: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  count: {
    marginLeft: 8,
    fontSize: 11,
    color: Colors.secondary,
    width: 50,
  },
});

// ─── Acente kartı ─────────────────────────────────────────────────────────────
function AgencyCard({
  agency,
  counts,
  agencyProfiles,
  unassigned,
  onEdit,
  onToggleActive,
  onDelete,
  onAssignUser,
  onUnassignUser,
}: {
  agency: Agency;
  counts: AgencyCounts;
  agencyProfiles: Profile[];
  unassigned: Profile[];
  onEdit: (ag: Agency) => void;
  onToggleActive: (ag: Agency) => void;
  onDelete: (ag: Agency) => void;
  onAssignUser: (agencyId: string, profileId: string, maxUsers: number) => Promise<void>;
  onUnassignUser: (profileId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const isActive = agency.is_active ?? true;
  const plan = agency.plan ?? 'starter';
  const planMeta = PLAN_LABELS[plan] ?? PLAN_LABELS['starter'];
  const maxUsers = agency.max_users ?? 20;
  const maxCustomers = agency.max_customers ?? 200;
  const maxRequests = agency.max_requests ?? 500;
  const maxPolicies = agency.max_policies ?? 500;

  const anyAtLimit =
    counts.users >= maxUsers ||
    counts.customers >= maxCustomers ||
    counts.requests >= maxRequests ||
    counts.policies >= maxPolicies;

  async function handleAssign(profileId: string) {
    setAssigning(true);
    await onAssignUser(agency.id, profileId, maxUsers);
    setAssigning(false);
    setSelectedUserId('');
    setShowUserPicker(false);
  }

  return (
    <View style={[card.wrap, !isActive && card.inactive]}>
      {/* Başlık satırı */}
      <View style={card.header}>
        {/* Renk rozet */}
        <View style={[card.badge, { backgroundColor: agency.primary_color }]}>
          <Text style={card.badgeText}>{agency.name.slice(0, 2).toUpperCase()}</Text>
        </View>

        {/* Bilgi */}
        <View style={card.info}>
          <View style={card.nameRow}>
            <Text style={card.name} numberOfLines={1}>{agency.name}</Text>
            <View style={[card.planBadge, { backgroundColor: planMeta.bg }]}>
              <Text style={[card.planText, { color: planMeta.color }]}>{planMeta.label}</Text>
            </View>
            {!isActive && (
              <View style={card.passiveBadge}>
                <Text style={card.passiveText}>Pasif</Text>
              </View>
            )}
            {anyAtLimit && isActive && (
              <View style={card.warnBadge}>
                <Text style={card.warnText}>⚠ Limit</Text>
              </View>
            )}
          </View>
          <Text style={card.slug}>/a/{agency.slug}</Text>
          {(agency.phone || agency.email) ? (
            <Text style={card.contact} numberOfLines={1}>
              {[agency.phone, agency.email].filter(Boolean).join('  ·  ')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Kullanım çubukları */}
      <View style={card.bars}>
        <UsageBar label="Kullanıcı" current={counts.users}     max={maxUsers}     />
        <UsageBar label="Müşteri"   current={counts.customers} max={maxCustomers} />
        <UsageBar label="Talep"     current={counts.requests}  max={maxRequests}  />
        <UsageBar label="Poliçe"    current={counts.policies}  max={maxPolicies}  />
      </View>

      {/* Aksiyon düğmeleri */}
      <View style={card.actions}>
        <TouchableOpacity
          style={[card.btn, isActive ? card.activeBtn : card.passiveBtn]}
          onPress={() => onToggleActive(agency)}
        >
          <Text style={[card.btnText, isActive ? card.activeBtnText : card.passiveBtnText]}>
            {isActive ? '✓ Aktif' : '✗ Pasif'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[card.btn, card.editBtn]}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={card.editBtnText}>Kullanıcılar {expanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[card.btn, card.editBtn]}
          onPress={() => onEdit(agency)}
        >
          <Text style={card.editBtnText}>Düzenle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[card.btn, card.deleteBtn]}
          onPress={() => onDelete(agency)}
        >
          <Text style={card.deleteBtnText}>Sil</Text>
        </TouchableOpacity>
      </View>

      {/* Genişletilmiş kullanıcı paneli */}
      {expanded && (
        <View style={card.expanded}>
          <Text style={card.expandTitle}>
            Bağlı Kullanıcılar ({counts.users}/{maxUsers})
          </Text>

          {agencyProfiles.length === 0 ? (
            <Text style={card.emptyUsers}>Henüz kullanıcı yok.</Text>
          ) : (
            agencyProfiles.map((p) => (
              <View key={p.id} style={card.userRow}>
                <View style={card.userInfo}>
                  <Text style={card.userName}>{p.full_name ?? 'İsimsiz'}</Text>
                  <Text style={card.userRole}>{p.role}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Kullanıcıyı Çıkar',
                      `"${p.full_name ?? 'İsimsiz'}" acenteden çıkarılsın mı?`,
                      [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Çıkar',
                          style: 'destructive',
                          onPress: () => onUnassignUser(p.id),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={card.unassignText}>Çıkar</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Kullanıcı atama */}
          {unassigned.length > 0 && counts.users < maxUsers && (
            <View style={card.assignSection}>
              <Text style={card.assignTitle}>Kullanıcı Ata</Text>
              {/* Kullanıcı listesi — picker yerine ScrollView */}
              <ScrollView
                style={card.userPickerList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {unassigned.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      card.userPickerItem,
                      selectedUserId === p.id && card.userPickerItemSelected,
                    ]}
                    onPress={() =>
                      setSelectedUserId(selectedUserId === p.id ? '' : p.id)
                    }
                  >
                    <Text
                      style={[
                        card.userPickerItemText,
                        selectedUserId === p.id && card.userPickerItemTextSelected,
                      ]}
                    >
                      {p.full_name ?? 'İsimsiz'} · {p.role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[
                  card.assignBtn,
                  (!selectedUserId || assigning) && card.assignBtnDisabled,
                ]}
                disabled={!selectedUserId || assigning}
                onPress={() => selectedUserId && handleAssign(selectedUserId)}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={card.assignBtnText}>Ata</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {counts.users >= maxUsers && (
            <View style={card.limitWarning}>
              <Text style={card.limitWarningText}>
                ⚠ Kullanıcı limiti doldu. Düzenle ile limiti artırabilirsiniz.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  inactive: {
    borderColor: Colors.danger,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.heading,
    marginRight: 6,
    flexShrink: 1,
  },
  planBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  planText: {
    fontSize: 10,
    fontWeight: '700',
  },
  passiveBadge: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  passiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  warnBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  slug: {
    fontSize: 11,
    color: Colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  contact: {
    fontSize: 11,
    color: Colors.secondary,
  },
  bars: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeBtn: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  activeBtnText: {
    color: '#059669',
  },
  passiveBtn: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  passiveBtnText: {
    color: '#DC2626',
  },
  editBtn: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  deleteBtn: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
  expandTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.heading,
    marginBottom: 8,
  },
  emptyUsers: {
    fontSize: 12,
    color: Colors.secondary,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.heading,
  },
  userRole: {
    fontSize: 10,
    color: Colors.secondary,
    marginTop: 1,
  },
  unassignText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  assignSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  assignTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.heading,
    marginBottom: 6,
  },
  userPickerList: {
    maxHeight: 140,
    marginBottom: 8,
  },
  userPickerItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginBottom: 4,
  },
  userPickerItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  userPickerItemText: {
    fontSize: 13,
    color: Colors.text,
  },
  userPickerItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  assignBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  assignBtnDisabled: {
    opacity: 0.45,
  },
  assignBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  limitWarning: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  limitWarningText: {
    fontSize: 11,
    color: '#92400E',
  },
});

// ─── Form Modal ───────────────────────────────────────────────────────────────
function AgencyFormModal({
  visible,
  editingAgency,
  form,
  setForm,
  saving,
  error,
  onSave,
  onClose,
}: {
  visible: boolean;
  editingAgency: Agency | null;
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={fm.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Başlık */}
        <View style={fm.header}>
          <TouchableOpacity onPress={onClose} style={fm.cancelBtn}>
            <Text style={fm.cancelText}>İptal</Text>
          </TouchableOpacity>
          <Text style={fm.title}>
            {editingAgency ? 'Acente Düzenle' : 'Yeni Acente'}
          </Text>
          <TouchableOpacity
            style={[fm.saveBtn, saving && fm.saveBtnDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={fm.saveText}>{editingAgency ? 'Güncelle' : 'Oluştur'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={fm.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={fm.body}>

            {error ? (
              <View style={fm.errorBox}>
                <Text style={fm.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Ad */}
            <Text style={fm.label}>Acente Adı *</Text>
            <TextInput
              style={fm.input}
              placeholder="Atlas Sigorta"
              placeholderTextColor={Colors.placeholder}
              value={form.name}
              onChangeText={(v) =>
                setForm({
                  ...form,
                  name: v,
                  slug: editingAgency ? form.slug : slugify(v),
                })
              }
            />

            {/* Slug */}
            <Text style={fm.label}>Slug *</Text>
            <View style={fm.slugRow}>
              <View style={fm.slugPrefix}>
                <Text style={fm.slugPrefixText}>/a/</Text>
              </View>
              <TextInput
                style={fm.slugInput}
                placeholder="atlas-sigorta"
                placeholderTextColor={Colors.placeholder}
                value={form.slug}
                onChangeText={(v) =>
                  setForm({
                    ...form,
                    slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                  })
                }
                autoCapitalize="none"
              />
            </View>

            {/* Plan */}
            <Text style={fm.label}>Plan</Text>
            <View style={fm.planRow}>
              {['starter', 'pro', 'enterprise'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[fm.planChip, form.plan === p && fm.planChipActive]}
                  onPress={() => setForm({ ...form, plan: p })}
                >
                  <Text style={[fm.planChipText, form.plan === p && fm.planChipTextActive]}>
                    {PLAN_LABELS[p]?.label ?? p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Limitler */}
            <Text style={fm.sectionTitle}>Limitler</Text>
            {[
              { key: 'max_users',     label: 'Maks. Kullanıcı' },
              { key: 'max_customers', label: 'Maks. Müşteri' },
              { key: 'max_requests',  label: 'Maks. Talep' },
              { key: 'max_policies',  label: 'Maks. Poliçe' },
            ].map(({ key, label }) => (
              <View key={key} style={fm.row}>
                <Text style={fm.rowLabel}>{label}</Text>
                <TextInput
                  style={fm.rowInput}
                  keyboardType="number-pad"
                  value={form[key as keyof typeof form]}
                  onChangeText={(v) => setForm({ ...form, [key]: v.replace(/[^0-9]/g, '') })}
                />
              </View>
            ))}

            {/* İletişim */}
            <Text style={fm.sectionTitle}>İletişim (isteğe bağlı)</Text>

            <Text style={fm.label}>Telefon</Text>
            <TextInput
              style={fm.input}
              placeholder="0212 000 00 00"
              placeholderTextColor={Colors.placeholder}
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
            />

            <Text style={fm.label}>E-posta</Text>
            <TextInput
              style={fm.input}
              placeholder="info@acente.com"
              placeholderTextColor={Colors.placeholder}
              value={form.email}
              onChangeText={(v) => setForm({ ...form, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fm = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15, color: Colors.secondary },
  title: { fontSize: 16, fontWeight: '700', color: Colors.heading },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  body: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: { fontSize: 13, color: '#DC2626' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  slugRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  slugPrefix: {
    paddingHorizontal: 10,
    paddingVertical: 11,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'center',
  },
  slugPrefixText: {
    fontSize: 13,
    color: Colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  slugInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  planRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  planChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginRight: 8,
  },
  planChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  planChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  planChipTextActive: {
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.heading,
    marginTop: 20,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  rowInput: {
    width: 80,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
  },
});

// ─── Özet kart ────────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[sum.card, { borderTopColor: color }]}>
      <Text style={[sum.value, { color }]}>{value}</Text>
      <Text style={sum.label}>{label}</Text>
    </View>
  );
}

const sum = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 3,
    padding: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    color: Colors.secondary,
    textAlign: 'center',
  },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const { role } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<string, AgencyCounts>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form modal
  const [formVisible, setFormVisible] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Veri yükle ─────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [
      { data: ag },
      { data: pr },
      { data: custRows },
      { data: reqRows },
      { data: polRows },
    ] = await Promise.all([
      (supabase.from('agencies') as any).select('*').order('created_at', { ascending: false }),
      (supabase.from('profiles') as any).select('id, full_name, role, agency_id').order('full_name'),
      (supabase.from('customers') as any).select('agency_id'),
      (supabase.from('requests')  as any).select('agency_id'),
      (supabase.from('policies')  as any).select('agency_id'),
    ]);

    if (ag) setAgencies(ag as Agency[]);
    if (pr) setProfiles(pr as Profile[]);

    const newCounts: Record<string, AgencyCounts> = {};

    function tally(rows: { agency_id: string | null }[] | null, key: keyof AgencyCounts) {
      (rows ?? []).forEach((r) => {
        if (!r.agency_id) return;
        if (!newCounts[r.agency_id])
          newCounts[r.agency_id] = { users: 0, customers: 0, requests: 0, policies: 0 };
        newCounts[r.agency_id][key] += 1;
      });
    }

    // users → profiles tablosundan
    (pr ?? []).forEach((p: any) => {
      if (!p.agency_id) return;
      if (!newCounts[p.agency_id])
        newCounts[p.agency_id] = { users: 0, customers: 0, requests: 0, policies: 0 };
      newCounts[p.agency_id].users += 1;
    });

    tally(custRows as any, 'customers');
    tally(reqRows  as any, 'requests');
    tally(polRows  as any, 'policies');

    setCounts(newCounts);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ─── Özet sayılar ─────────────────────────────────────────────────────────
  const totalAgencies  = agencies.length;
  const activeAgencies = agencies.filter((a) => a.is_active ?? true).length;
  const totalUsers     = profiles.filter((p) => !!p.agency_id).length;
  const totalCustomers = Object.values(counts).reduce((s, c) => s + c.customers, 0);
  const totalPolicies  = Object.values(counts).reduce((s, c) => s + c.policies,  0);

  // ─── Arama filtresi ───────────────────────────────────────────────────────
  const filtered = agencies.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q) ||
      (a.phone ?? '').includes(q)
    );
  });

  // ─── Form yardımcıları ────────────────────────────────────────────────────
  function openAdd() {
    setEditingAgency(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFormVisible(true);
  }

  function openEdit(ag: Agency) {
    setEditingAgency(ag);
    setForm({
      name:          ag.name,
      slug:          ag.slug,
      phone:         ag.phone ?? '',
      email:         ag.email ?? '',
      plan:          ag.plan ?? 'starter',
      max_users:     String(ag.max_users     ?? 20),
      max_customers: String(ag.max_customers ?? 200),
      max_requests:  String(ag.max_requests  ?? 500),
      max_policies:  String(ag.max_policies  ?? 500),
      primary_color: ag.primary_color ?? '#2563eb',
    });
    setFormError('');
    setFormVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Acente adı zorunludur.'); return; }
    if (!form.slug.trim()) { setFormError('Slug zorunludur.'); return; }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setFormError('Slug yalnızca küçük harf, rakam ve tire içerebilir.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      name:          form.name.trim(),
      slug:          form.slug.trim(),
      phone:         form.phone.trim()  || null,
      email:         form.email.trim()  || null,
      primary_color: form.primary_color || '#2563eb',
      max_users:     parseInt(form.max_users,     10) || 20,
      max_customers: parseInt(form.max_customers, 10) || 200,
      max_requests:  parseInt(form.max_requests,  10) || 500,
      max_policies:  parseInt(form.max_policies,  10) || 500,
      plan:          form.plan || 'starter',
    };

    const sb = supabase.from('agencies') as any;
    const { error } = editingAgency
      ? await sb.update(payload).eq('id', editingAgency.id)
      : await sb.insert([payload]);

    setSaving(false);
    if (error) {
      const msg = error.message ?? String(error);
      setFormError(
        msg.includes('unique') ? `"${form.slug}" slug zaten kullanımda.` : msg
      );
      return;
    }

    setFormVisible(false);
    load();
  }

  async function handleToggleActive(ag: Agency) {
    await (supabase.from('agencies') as any)
      .update({ is_active: !(ag.is_active ?? true) })
      .eq('id', ag.id);
    load();
  }

  function handleDelete(ag: Agency) {
    Alert.alert(
      'Acente Sil',
      `"${ag.name}" silinsin mi? Bu işlem geri alınamaz.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await (supabase.from('agencies') as any).delete().eq('id', ag.id);
            load();
          },
        },
      ]
    );
  }

  async function handleAssignUser(agencyId: string, profileId: string, maxUsers: number) {
    const current = counts[agencyId]?.users ?? 0;
    if (current >= maxUsers) {
      Alert.alert('Limit Doldu', `Kullanıcı limitine ulaşıldı (${current}/${maxUsers}).`);
      return;
    }
    await (supabase.from('profiles') as any)
      .update({ agency_id: agencyId })
      .eq('id', profileId);
    load();
  }

  async function handleUnassignUser(profileId: string) {
    await (supabase.from('profiles') as any)
      .update({ agency_id: null })
      .eq('id', profileId);
    load();
  }

  const unassigned = profiles.filter((p) => !p.agency_id);

  // ─── Yetkisiz erişim ──────────────────────────────────────────────────────
  if (role && role !== 'super_admin') {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessIcon}>🔒</Text>
        <Text style={styles.accessTitle}>Erişim Yok</Text>
        <Text style={styles.accessDesc}>Bu ekran yalnızca Super Admin için kullanılabilir.</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Başlık */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.pageTitle}>Yönetim</Text>
          <Text style={styles.pageSubtitle}>
            {loading ? 'Yükleniyor...' : `${activeAgencies}/${totalAgencies} aktif acente`}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Acente Ekle</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + Spacing.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Özet */}
          <View style={styles.summaryRow}>
            <SummaryCard label="Acenteler" value={totalAgencies}  color="#2563EB" />
            <SummaryCard label="Kullanıcı" value={totalUsers}     color="#7C3AED" />
            <SummaryCard label="Müşteri"   value={totalCustomers} color="#059669" />
            <SummaryCard label="Poliçe"    value={totalPolicies}  color="#D97706" />
          </View>

          {/* Arama */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Acente ara..."
              placeholderTextColor={Colors.placeholder}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Acente listesi */}
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>
                {search ? 'Eşleşen acente bulunamadı' : 'Henüz acente yok'}
              </Text>
              {!search && (
                <Text style={styles.emptyDesc}>
                  Yeni acente eklemek için yukarıdaki butonu kullanın.
                </Text>
              )}
            </View>
          ) : (
            filtered.map((ag) => (
              <AgencyCard
                key={ag.id}
                agency={ag}
                counts={counts[ag.id] ?? { users: 0, customers: 0, requests: 0, policies: 0 }}
                agencyProfiles={profiles.filter((p) => p.agency_id === ag.id)}
                unassigned={unassigned}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
                onAssignUser={handleAssignUser}
                onUnassignUser={handleUnassignUser}
              />
            ))
          )}

          {/* Alt boşluk */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Form modal */}
      <AgencyFormModal
        visible={formVisible}
        editingAgency={editingAgency}
        form={form}
        setForm={setForm}
        saving={saving}
        error={formError}
        onSave={handleSave}
        onClose={() => setFormVisible(false)}
      />
    </View>
  );
}

// ─── Ana stiller ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBarLeft: {},
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.heading,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.secondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.secondary,
    fontSize: 14,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    marginHorizontal: -4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.heading,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  accessIcon: { fontSize: 48, marginBottom: 16 },
  accessTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.heading,
    marginBottom: 8,
  },
  accessDesc: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
  },
});
