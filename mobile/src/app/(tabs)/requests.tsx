import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Linking, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { Request, RequestStatus, Customer } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';
import { useNotificationStore } from '@/lib/NotificationContext';
import { clearBadge } from '@/lib/notifications';
import DocumentSection from '@/components/DocumentSection';

// ── Constants (web ile birebir) ───────────────────────────────────────────────
const REQUEST_TYPES = [
  'Kasko', 'Trafik', 'Konut', 'Sağlık', 'Hayat',
  'DASK', 'Ferdi Kaza', 'İMM', 'Yeşil Kart', 'Seyahat',
];

const STATUS_CONFIG: Record<RequestStatus, { color: string; bg: string; border: string }> = {
  Yeni:       { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  İşlemde:    { color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' },
  Tamamlandı: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  İptal:      { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

const ALL_STATUSES: (RequestStatus | 'Tümü')[] = ['Tümü', 'Yeni', 'İşlemde', 'Tamamlandı', 'İptal'];

// Status transition (web ile aynı mantık)
function nextActions(status: RequestStatus): { label: string; next: RequestStatus; color: string }[] {
  if (status === 'Yeni') return [
    { label: 'İşleme Al', next: 'İşlemde', color: Colors.primary },
    { label: 'İptal Et',  next: 'İptal',    color: Colors.danger  },
  ];
  if (status === 'İşlemde') return [
    { label: 'Tamamla', next: 'Tamamlandı', color: Colors.success },
    { label: 'İptal Et', next: 'İptal',     color: Colors.danger  },
  ];
  return [];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function waNumber(phone: string) {
  const c = phone.replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Yeni'];
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[badgeStyles.text, { color: cfg.color }]}>{status}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ item, onPress }: { item: Request; onPress: () => void }) {
  const date = new Date(item.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatarWrap}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>
              {initials(item.customers?.name ?? '?')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardCustomer} numberOfLines={1}>
              {item.customers?.name ?? '—'}
            </Text>
            <Text style={styles.cardType}>{item.request_type}</Text>
          </View>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardDate}>{date}</Text>
        {item.price_offer != null && (
          <Text style={styles.cardPrice}>
            {Number(item.price_offer).toLocaleString('tr-TR')} ₺
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function RequestDetailModal({
  item,
  onClose,
  onUpdated,
  userId,
}: {
  item: Request;
  onClose: () => void;
  onUpdated: () => void;
  userId: string | null;
}) {
  const [status, setStatus] = useState<RequestStatus>(item.status);
  const [updating, setUpdating] = useState(false);
  const [priceInput, setPriceInput] = useState(
    item.price_offer != null ? String(item.price_offer) : ''
  );
  const [savingPrice, setSavingPrice] = useState(false);

  const actions = nextActions(status);
  const customer = item.customers;
  const date = new Date(item.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  async function changeStatus(next: RequestStatus) {
    Alert.alert(
      'Durum Güncelle',
      `"${next}" olarak değiştirilsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            setUpdating(true);
            await (supabase.from('requests') as any).update({ status: next }).eq('id', item.id);
            setStatus(next);
            setUpdating(false);
            onUpdated();
          },
        },
      ]
    );
  }

  async function savePrice() {
    const val = priceInput ? parseFloat(priceInput) : null;
    setSavingPrice(true);
    await (supabase.from('requests') as any)
      .update({ price_offer: val })
      .eq('id', item.id);
    setSavingPrice(false);
    onUpdated();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.detailSafe} edges={['top']}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailType}>{item.request_type}</Text>
            <Text style={styles.detailCustomer}>
              {customer?.name ?? '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
          {/* Status */}
          <View style={styles.statusSection}>
            <StatusBadge status={status} />
            {updating && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
          </View>

          {/* Action Buttons (status geçişi) */}
          {actions.length > 0 && (
            <View style={styles.actionRow}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.next}
                  style={[styles.actionBtn, { backgroundColor: a.color, opacity: updating ? 0.6 : 1 }]}
                  onPress={() => changeStatus(a.next)}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Info rows */}
          <View style={styles.infoCard}>
            <InfoRow label="Talep Türü"     value={item.request_type} />
            <InfoRow label="Durum"          value={status} />
            <InfoRow label="Tarih"          value={date} />
            {item.price_offer != null && (
              <InfoRow label="Teklif Tutarı" value={`${Number(item.price_offer).toLocaleString('tr-TR')} ₺`} />
            )}
          </View>

          {/* Customer info */}
          {customer && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Müşteri Bilgileri</Text>
              <InfoRow label="Ad Soyad" value={customer.name} />
              {customer.phone && <InfoRow label="Telefon" value={customer.phone} />}
              {customer.insurance_type && <InfoRow label="Sigorta" value={customer.insurance_type} />}
            </View>
          )}

          {/* Call & WhatsApp */}
          {customer?.phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.contactBtnEmoji}>📞</Text>
                <Text style={styles.contactBtnLabel}>Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactBtn, styles.contactBtnGreen]}
                onPress={() => Linking.openURL(`whatsapp://send?phone=${waNumber(customer.phone!)}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.contactBtnEmoji}>💬</Text>
                <Text style={[styles.contactBtnLabel, { color: '#fff' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Teklif tutarı güncelle */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Teklif Tutarı Güncelle</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.priceInput, { flex: 1, marginRight: 8 }]}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="Tutar girin (₺)"
                placeholderTextColor={Colors.secondary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[styles.priceSaveBtn, savingPrice && { opacity: 0.6 }]}
                onPress={savePrice}
                disabled={savingPrice}
              >
                {savingPrice
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.priceSaveBtnText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Evraklar */}
          <DocumentSection
            entity="requests"
            entityId={item.id}
            agencyId={item.agency_id ?? null}
            uploadedBy={userId}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Add Request Modal ────────────────────────────────────────────────────────
function AddRequestModal({
  agencyId,
  onClose,
  onSaved,
}: {
  agencyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [requestType, setRequestType] = useState('');
  const [priceOffer, setPriceOffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function searchCustomers(q: string) {
    setCustomerSearch(q);
    setSelectedCustomer(null);
    if (q.length < 2) { setSuggestions([]); return; }
    let query = (supabase.from('customers') as any)
      .select('id, name, phone')
      .ilike('name', `%${q}%`)
      .limit(5);
    if (agencyId) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    setSuggestions(data ?? []);
  }

  function reset() {
    setCustomerSearch(''); setSuggestions([]); setSelectedCustomer(null);
    setRequestType(''); setPriceOffer(''); setError('');
  }

  async function handleSave() {
    if (!selectedCustomer) { setError('Müşteri seçiniz.'); return; }
    if (!requestType)       { setError('Talep türü seçiniz.'); return; }
    setSaving(true);
    setError('');

    const payload: any = {
      customer_id:  selectedCustomer.id,
      request_type: requestType,
      status:       'Yeni',
      price_offer:  priceOffer ? parseFloat(priceOffer) : null,
    };
    if (agencyId) payload.agency_id = agencyId;

    const { error: err } = await (supabase.from('requests') as any).insert(payload);
    setSaving(false);
    if (err) { setError('Kaydedilemedi: ' + err.message); return; }
    onSaved();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Teklif Talebi</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
            ) : null}

            {/* Müşteri seç */}
            <Text style={styles.sectionTitle}>Müşteri *</Text>
            {selectedCustomer ? (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedText}>✅ {selectedCustomer.name}</Text>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={{ color: Colors.danger, fontSize: 13 }}>Değiştir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <TextInput
                  style={styles.input}
                  value={customerSearch}
                  onChangeText={searchCustomers}
                  placeholder="Müşteri adı ara..."
                  placeholderTextColor={Colors.secondary}
                />
                {suggestions.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.suggestion}
                    onPress={() => {
                      setSelectedCustomer({ id: c.id, name: c.name });
                      setSuggestions([]);
                      setCustomerSearch('');
                    }}
                  >
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    {c.phone ? <Text style={styles.suggestionSub}>{c.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Talep türü */}
            <Text style={styles.sectionTitle}>Talep Türü *</Text>
            <View style={styles.typeGrid}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, requestType === t && styles.typeChipActive]}
                  onPress={() => setRequestType(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, requestType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Teklif tutarı */}
            <Text style={styles.sectionTitle}>Teklif Tutarı (₺)</Text>
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={priceOffer}
                onChangeText={setPriceOffer}
                placeholder="Opsiyonel"
                placeholderTextColor={Colors.secondary}
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Teklif Oluştur</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Info Row helper ──────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RequestsScreen() {
  const { agencyId, role } = useProfile();
  const router = useRouter();
  const { markAllRead } = useNotificationStore();
  const { userId } = useProfile();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'Tümü'>('Tümü');
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<Request | null>(null);

  // Ekran odaklandığında badge temizle ve tüm bildirimleri okundu say
  useFocusEffect(
    useCallback(() => {
      markAllRead();
      clearBadge();
    }, [markAllRead])
  );

  async function fetchRequests() {
    let query = (supabase.from('requests') as any)
      .select('*, customers(name, phone, insurance_type)')
      .order('created_at', { ascending: false });

    if (role === 'agency_user' && agencyId) {
      query = query.eq('agency_id', agencyId);
    } else if (role === 'agency_user' && !agencyId) {
      setRequests([]); setLoading(false); return;
    }

    const { data } = await query;
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchRequests(); }, [agencyId, role]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }

  const filtered = requests
    .filter((r) => filterStatus === 'Tümü' || r.status === filterStatus)
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        r.customers?.name?.toLowerCase().includes(q) ||
        r.request_type.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Talepler</Text>
          <Text style={styles.subtitle}>{filtered.length} kayıt</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/new-request')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Müşteri adı, talep türü ara..."
          placeholderTextColor={Colors.secondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {ALL_STATUSES.map((s) => {
          const isActive = filterStatus === s;
          const cfg = s !== 'Tümü' ? STATUS_CONFIG[s as RequestStatus] : null;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterChip,
                isActive && cfg
                  ? { backgroundColor: cfg.bg, borderColor: cfg.border }
                  : isActive
                  ? styles.filterChipActiveDefault
                  : {},
              ]}
              onPress={() => setFilterStatus(s)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                isActive && cfg ? { color: cfg.color } : isActive ? { color: Colors.primary } : {},
              ]}>
                {s}
                {s !== 'Tümü' && (
                  <Text style={styles.filterChipCount}>
                    {' '}{requests.filter((r) => r.status === s).length}
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
            <RequestCard item={item} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>
                {search || filterStatus !== 'Tümü'
                  ? 'Sonuç bulunamadı'
                  : 'Henüz teklif talebi yok'}
              </Text>
              {!search && filterStatus === 'Tümü' && (
                <TouchableOpacity
                  style={[styles.addBtn, { marginTop: Spacing.md }]}
                  onPress={() => setAddVisible(true)}
                >
                  <Text style={styles.addBtnText}>İlk talebi oluştur</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      {selected && (
        <RequestDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            fetchRequests();
          }}
          userId={userId}
        />
      )}

      {/* Add Modal */}
      {addVisible && (
        <AddRequestModal
          agencyId={agencyId}
          onClose={() => setAddVisible(false)}
          onSaved={() => { setAddVisible(false); fetchRequests(); }}
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

  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActiveDefault: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  filterChipCount: { fontSize: 11, fontWeight: '400' },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardAvatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  cardAvatar: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  cardAvatarText: { fontSize: 13, fontWeight: '700', color: '#4338CA' },
  cardCustomer: { fontSize: 14, fontWeight: '700', color: Colors.heading },
  cardType: { fontSize: 12, color: Colors.secondary, marginTop: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 12, color: Colors.secondary },
  cardPrice: { fontSize: 13, fontWeight: '700', color: Colors.success },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.secondary, marginBottom: 4 },

  // Detail
  detailSafe: { flex: 1, backgroundColor: Colors.background },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, backgroundColor: Colors.heading,
  },
  detailType: { fontSize: 18, fontWeight: '800', color: '#fff' },
  detailCustomer: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  detailBody: { padding: Spacing.lg, paddingBottom: 48 },
  statusSection: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  actionRow: { flexDirection: 'row', marginBottom: Spacing.md },
  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', marginRight: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoCardTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border,
  },
  infoLabel: { fontSize: 12, color: Colors.secondary, fontWeight: '500' },
  infoValue: { fontSize: 13, color: Colors.heading, fontWeight: '600', flex: 1, textAlign: 'right' },
  contactRow: { flexDirection: 'row', marginBottom: Spacing.md },
  contactBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, marginRight: 8,
  },
  contactBtnGreen: { backgroundColor: '#22C55E', borderColor: '#22C55E', marginRight: 0 },
  contactBtnEmoji: { fontSize: 16, marginRight: 6 },
  contactBtnLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceInput: {
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11,
    fontSize: 14, color: Colors.heading,
  },
  priceSaveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  priceSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
    letterSpacing: 0.8, marginBottom: Spacing.sm, marginTop: Spacing.sm,
  },
  fieldGroup: { marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 14, color: Colors.heading,
  },
  selectedBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDF4', borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: '#86EFAC', marginBottom: Spacing.sm,
  },
  selectedText: { fontSize: 14, color: Colors.success, fontWeight: '600' },
  suggestion: {
    backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4,
  },
  suggestionText: { fontSize: 14, color: Colors.heading, fontWeight: '500' },
  suggestionSub: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 13, color: Colors.secondary, fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
