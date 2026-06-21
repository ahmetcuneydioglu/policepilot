import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { Request, RequestStatus } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';
import { useNotificationStore } from '@/lib/NotificationContext';
import { clearBadge } from '@/lib/notifications';
import { checkLimit } from '@/lib/limits';
import type { LimitResult } from '@/lib/limits';
import LimitModal from '@/components/LimitModal';
import DocumentSection from '@/components/DocumentSection';
import { STAGE_KEYS, stageOf, nextStages, OPPORTUNITY_TYPES } from '@/lib/opportunities';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function waNumber(phone: string) {
  const c = phone.replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c;
}
function actionColor(next: RequestStatus): string {
  if (next === 'Kazanıldı') return Colors.success;
  if (next === 'Kaybedildi') return Colors.danger;
  return Colors.primary;
}
function actionLabel(next: RequestStatus): string {
  switch (next) {
    case 'Teklif Hazırlanıyor': return 'Teklif Hazırla';
    case 'Takip Ediliyor':      return 'Takibe Al';
    case 'Kazanıldı':           return 'Kazanıldı ✓';
    case 'Yeni Lead':           return 'Yeniden Aç';
    default:                    return next;
  }
}

// ─── Stage Badge ──────────────────────────────────────────────────────────────
function StageBadge({ status }: { status: RequestStatus }) {
  const s = stageOf(status);
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: s.badgeBg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: s.dot }]} />
      <Text style={[badgeStyles.text, { color: s.badgeText }]}>{s.label}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ item, onPress }: { item: Request; onPress: () => void }) {
  const date = new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatarWrap}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>{initials(item.customers?.name ?? '?')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardCustomer} numberOfLines={1}>{item.customers?.name ?? '—'}</Text>
            <Text style={styles.cardType}>{item.request_type}</Text>
          </View>
        </View>
        <StageBadge status={item.status} />
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardDate}>{date}</Text>
        {item.price_offer != null && (
          <Text style={styles.cardPrice}>Tahmini Prim · {Number(item.price_offer).toLocaleString('tr-TR')} ₺</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function RequestDetailModal({
  item, onClose, onUpdated, userId,
}: { item: Request; onClose: () => void; onUpdated: () => void; userId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<RequestStatus>(item.status);
  const [updating, setUpdating] = useState(false);
  const [priceInput, setPriceInput] = useState(item.price_offer != null ? String(item.price_offer) : '');
  const [savingPrice, setSavingPrice] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(item.next_follow_up_date ?? null);

  const actions = nextStages(status);
  const customer = item.customers;
  const date = new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  async function changeStatus(next: RequestStatus) {
    Alert.alert('Aşama Güncelle', `"${next}" olarak işaretlensin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Evet',
        onPress: async () => {
          setUpdating(true);
          const { error } = await (supabase.from('requests') as any).update({ status: next }).eq('id', item.id);
          setUpdating(false);
          if (error) { Alert.alert('Hata', error.message); return; }
          setStatus(next);
          onUpdated();
        },
      },
    ]);
  }

  async function savePrice() {
    const val = priceInput ? parseFloat(priceInput) : null;
    setSavingPrice(true);
    await (supabase.from('requests') as any).update({ price_offer: val }).eq('id', item.id);
    setSavingPrice(false);
    onUpdated();
  }

  async function setFollow(days: number | null) {
    const d = days == null ? null : new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    setFollowUp(d);
    await (supabase.from('requests') as any).update({ next_follow_up_date: d }).eq('id', item.id);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.detailSafe} edges={['top']}>
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailType}>{item.request_type}</Text>
            <Text style={styles.detailCustomer}>{customer?.name ?? '—'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
          <View style={styles.statusSection}>
            <StageBadge status={status} />
            {updating && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
          </View>

          {/* Aşama geçişleri */}
          {actions.length > 0 && (
            <View style={styles.actionWrap}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.actionBtn, { backgroundColor: actionColor(a), opacity: updating ? 0.6 : 1 }]}
                  onPress={() => changeStatus(a)}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>{actionLabel(a)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Kazanıldı → Poliçeleştir */}
          {status === 'Kazanıldı' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.heading, marginBottom: Spacing.md }]}
              onPress={() => router.push('/(tabs)/policies')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>⚡ Poliçeye Dönüştür</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoCard}>
            <InfoRow label="Ürün" value={item.request_type} />
            <InfoRow label="Aşama" value={stageOf(status).label} />
            <InfoRow label="Oluşturma" value={date} />
            {item.price_offer != null && (
              <InfoRow label="Tahmini Prim" value={`${Number(item.price_offer).toLocaleString('tr-TR')} ₺`} />
            )}
          </View>

          {customer && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Müşteri Bilgileri</Text>
              <InfoRow label="Ad Soyad" value={customer.name} />
              {customer.phone && <InfoRow label="Telefon" value={customer.phone} />}
              {customer.insurance_type && <InfoRow label="Sigorta" value={customer.insurance_type} />}
            </View>
          )}

          {customer?.phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${customer.phone}`)} activeOpacity={0.8}>
                <Text style={styles.contactBtnEmoji}>📞</Text><Text style={styles.contactBtnLabel}>Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactBtn, styles.contactBtnGreen]} onPress={() => Linking.openURL(`whatsapp://send?phone=${waNumber(customer.phone!)}`)} activeOpacity={0.8}>
                <Text style={styles.contactBtnEmoji}>💬</Text><Text style={[styles.contactBtnLabel, { color: '#fff' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Tahmini Prim Güncelle</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.priceInput, { flex: 1, marginRight: 8 }]}
                value={priceInput} onChangeText={setPriceInput}
                placeholder="Tutar girin (₺)" placeholderTextColor={Colors.secondary} keyboardType="decimal-pad"
              />
              <TouchableOpacity style={[styles.priceSaveBtn, savingPrice && { opacity: 0.6 }]} onPress={savePrice} disabled={savingPrice}>
                {savingPrice ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.priceSaveBtnText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Takip Tarihi</Text>
            <Text style={styles.followCurrent}>
              {followUp
                ? `📅 ${new Date(followUp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Belirlenmedi — Görevler listesine düşmesi için bir tarih seç.'}
            </Text>
            <View style={styles.followRow}>
              {([['Bugün', 0], ['3 gün', 3], ['7 gün', 7], ['15 gün', 15]] as [string, number][]).map(([label, d]) => (
                <TouchableOpacity key={label} style={styles.followChip} onPress={() => setFollow(d)} activeOpacity={0.7}>
                  <Text style={styles.followChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
              {followUp && (
                <TouchableOpacity style={[styles.followChip, { borderColor: Colors.danger }]} onPress={() => setFollow(null)} activeOpacity={0.7}>
                  <Text style={[styles.followChipText, { color: Colors.danger }]}>Temizle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <DocumentSection entity="requests" entityId={item.id} agencyId={item.agency_id ?? null} uploadedBy={userId} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Add Request Modal ────────────────────────────────────────────────────────
function AddRequestModal({ agencyId, onClose, onSaved }: { agencyId: string | null; onClose: () => void; onSaved: () => void }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [requestType, setRequestType] = useState('');
  const [priceOffer, setPriceOffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [limitModal, setLimitModal] = useState<LimitResult | null>(null);

  async function searchCustomers(q: string) {
    setCustomerSearch(q);
    setSelectedCustomer(null);
    if (q.length < 2) { setSuggestions([]); return; }
    let query = (supabase.from('customers') as any).select('id, name, phone').ilike('name', `%${q}%`).limit(5);
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
    if (!requestType) { setError('Ürün seçiniz.'); return; }
    setSaving(true); setError('');

    const limitResult = await checkLimit(agencyId, 'requests');
    if (!limitResult.ok) { setLimitModal(limitResult); setSaving(false); return; }

    const payload: any = {
      customer_id: selectedCustomer.id,
      request_type: requestType,
      status: 'Yeni Lead',
      price_offer: priceOffer ? parseFloat(priceOffer) : null,
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
              <Text style={styles.modalTitle}>Yeni Teklif</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
            </View>

            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            {limitModal && (
              <LimitModal visible entity="requests" current={limitModal.current} max={limitModal.max} reason={limitModal.reason} onClose={() => setLimitModal(null)} />
            )}

            <Text style={styles.sectionTitle}>Müşteri *</Text>
            {selectedCustomer ? (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedText}>✅ {selectedCustomer.name}</Text>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}><Text style={{ color: Colors.danger, fontSize: 13 }}>Değiştir</Text></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <TextInput style={styles.input} value={customerSearch} onChangeText={searchCustomers} placeholder="Müşteri adı ara..." placeholderTextColor={Colors.secondary} />
                {suggestions.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.suggestion} onPress={() => { setSelectedCustomer({ id: c.id, name: c.name }); setSuggestions([]); setCustomerSearch(''); }}>
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    {c.phone ? <Text style={styles.suggestionSub}>{c.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Ürün *</Text>
            <View style={styles.typeGrid}>
              {OPPORTUNITY_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, requestType === t && styles.typeChipActive]} onPress={() => setRequestType(t)} activeOpacity={0.7}>
                  <Text style={[styles.typeChipText, requestType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Tahmini Prim (₺)</Text>
            <View style={styles.fieldGroup}>
              <TextInput style={styles.input} value={priceOffer} onChangeText={setPriceOffer} placeholder="Opsiyonel" placeholderTextColor={Colors.secondary} keyboardType="decimal-pad" />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Teklif Oluştur</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

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
  const { agencyId, role, userId } = useProfile();
  const router = useRouter();
  const { markAllRead } = useNotificationStore();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'Tümü'>('Tümü');
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<Request | null>(null);

  useFocusEffect(useCallback(() => { markAllRead(); clearBadge(); }, [markAllRead]));

  async function fetchRequests() {
    let query = (supabase.from('requests') as any)
      .select('*, customers(name, phone, insurance_type)')
      .order('created_at', { ascending: false });
    if (role === 'agency_user' && agencyId) query = query.eq('agency_id', agencyId);
    else if (role === 'agency_user' && !agencyId) { setRequests([]); setLoading(false); return; }
    const { data } = await query;
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchRequests(); }, [agencyId, role]);

  async function onRefresh() { setRefreshing(true); await fetchRequests(); setRefreshing(false); }

  const filtered = requests
    .filter((r) => filterStatus === 'Tümü' || r.status === filterStatus)
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return r.customers?.name?.toLowerCase().includes(q) || r.request_type.toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
    });

  const filterChips: (RequestStatus | 'Tümü')[] = ['Tümü', ...STAGE_KEYS];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Teklifler</Text>
          <Text style={styles.subtitle}>{filtered.length} kayıt</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/new-request')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Ekle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput} placeholder="Müşteri, ürün ara..." placeholderTextColor={Colors.secondary}
          value={search} onChangeText={setSearch} autoCapitalize="none" clearButtonMode="while-editing"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
        {filterChips.map((s) => {
          const isActive = filterStatus === s;
          const stage = s !== 'Tümü' ? stageOf(s) : null;
          const count = s === 'Tümü' ? requests.length : requests.filter((r) => r.status === s).length;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, isActive && (stage ? { backgroundColor: stage.badgeBg, borderColor: stage.dot } : styles.filterChipActiveDefault)]}
              onPress={() => setFilterStatus(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && (stage ? { color: stage.badgeText } : { color: Colors.primary })]}>
                {s === 'Tümü' ? s : stage!.label}<Text style={styles.filterChipCount}>{' '}{count}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RequestCard item={item} onPress={() => setSelected(item)} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>{search || filterStatus !== 'Tümü' ? 'Sonuç bulunamadı' : 'Henüz teklif yok'}</Text>
              {!search && filterStatus === 'Tümü' && (
                <TouchableOpacity style={[styles.addBtn, { marginTop: Spacing.md }]} onPress={() => setAddVisible(true)}>
                  <Text style={styles.addBtnText}>İlk teklifi oluştur</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {selected && (
        <RequestDetailModal item={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); fetchRequests(); }} userId={userId} />
      )}
      {addVisible && (
        <AddRequestModal agencyId={agencyId} onClose={() => setAddVisible(false)} onSaved={() => { setAddVisible(false); fetchRequests(); }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  subtitle: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.heading },

  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, height: 36, justifyContent: 'center', alignItems: 'center' },
  filterChipActiveDefault: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  filterChipCount: { fontSize: 11, fontWeight: '400' },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardAvatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  cardAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardAvatarText: { fontSize: 13, fontWeight: '700', color: '#4338CA' },
  cardCustomer: { fontSize: 14, fontWeight: '700', color: Colors.heading },
  cardType: { fontSize: 12, color: Colors.secondary, marginTop: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 12, color: Colors.secondary },
  cardPrice: { fontSize: 12, fontWeight: '700', color: Colors.success },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.secondary, marginBottom: 4 },

  detailSafe: { flex: 1, backgroundColor: Colors.background },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, backgroundColor: Colors.heading },
  detailType: { fontSize: 18, fontWeight: '800', color: '#fff' },
  detailCustomer: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  detailBody: { padding: Spacing.lg, paddingBottom: 48 },
  statusSection: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  actionBtn: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.md, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  infoCardTitle: { fontSize: 11, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  followCurrent: { fontSize: 14, color: Colors.heading, fontWeight: '600', marginBottom: Spacing.sm },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  followChip: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  followChipText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border },
  infoLabel: { fontSize: 12, color: Colors.secondary, fontWeight: '500' },
  infoValue: { fontSize: 13, color: Colors.heading, fontWeight: '600', flex: 1, textAlign: 'right' },
  contactRow: { flexDirection: 'row', marginBottom: Spacing.md },
  contactBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  contactBtnGreen: { backgroundColor: '#22C55E', borderColor: '#22C55E', marginRight: 0 },
  contactBtnEmoji: { fontSize: 16, marginRight: 6 },
  contactBtnLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceInput: { backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: 14, color: Colors.heading },
  priceSaveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  priceSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalScroll: { padding: Spacing.lg, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.danger, fontSize: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  fieldGroup: { marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, color: Colors.heading },
  selectedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#86EFAC', marginBottom: Spacing.sm },
  selectedText: { fontSize: 14, color: Colors.success, fontWeight: '600' },
  suggestion: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  suggestionText: { fontSize: 14, color: Colors.heading, fontWeight: '500' },
  suggestionSub: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 13, color: Colors.secondary, fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
