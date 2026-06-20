/**
 * src/app/evraklar.tsx — Evrak Merkezi
 * - Tüm acente evrakları (kategori filtreli) + müşteri seçip kategoriyle yükleme
 * - Poliçe Tara (OCR): kamerayla poliçe çek → /api/ocr/policy → müşteri+poliçe oluştur
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Linking, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { fileIcon, formatFileSize, getSignedUrl, deleteDocument, uploadDocument } from '@/lib/storage';
import { apiPostForm, ApiError } from '@/lib/api';
import { checkLimit, limitErrorMessage } from '@/lib/limits';
import type { DocumentRecord } from '@/lib/types';
import DocumentUploader from '@/components/DocumentUploader';

type DocRow = DocumentRecord & { customers?: { name: string } | null };
type OcrField = { value: string | null; confidence?: number; needsReview?: boolean };
type OcrFields = Record<string, OcrField>;
type Asset = { uri: string; fileName: string; mimeType: string };

const CATEGORIES = ['Kimlik', 'Ruhsat', 'Poliçe', 'Hasar Evrakı', 'Diğer'];

function getImagePicker() {
  try { return require('expo-image-picker'); } catch { return null; }
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EvraklarScreen() {
  const router = useRouter();
  const { agencyId, userId } = useProfile();

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('Tümü');
  const [addOpen, setAddOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocr, setOcr] = useState<{ fields: OcrFields; asset: Asset } | null>(null);

  const load = useCallback(async () => {
    let q = (supabase.from('documents') as any)
      .select('id,file_name,file_path,file_type,file_size,customer_id,agency_id,doc_type,created_at,customers(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (agencyId) q = q.eq('agency_id', agencyId);
    const { data } = await q;
    setDocs(data ?? []);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const visible = useMemo(
    () => (filter === 'Tümü' ? docs : docs.filter((d) => (d.doc_type ?? '') === filter)),
    [docs, filter]
  );

  async function openDoc(d: DocRow) {
    setOpening(d.id);
    const url = await getSignedUrl(d.file_path);
    setOpening(null);
    if (url) Linking.openURL(url).catch(() => Alert.alert('Açılamadı', 'Dosya açılamadı.'));
    else Alert.alert('Açılamadı', 'Dosya bağlantısı alınamadı.');
  }

  function confirmDelete(d: DocRow) {
    Alert.alert('Evrakı Sil', `"${d.file_name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          const res = await deleteDocument(d);
          if (res.ok) setDocs((prev) => prev.filter((x) => x.id !== d.id));
          else Alert.alert('Hata', res.error ?? 'Silinemedi');
        },
      },
    ]);
  }

  async function scanPolicy() {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) { Alert.alert('Kamera yok', 'Kamera modülü yüklenemedi.'); return; }
    const perm = await ImagePicker.getCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await ImagePicker.requestCameraPermissionsAsync();
      if (req.status !== 'granted') { Alert.alert('İzin gerekli', 'Poliçe taramak için kamera izni gerekli.'); return; }
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
    if (result.canceled || !result.assets?.length) return;

    const a = result.assets[0];
    const asset: Asset = { uri: a.uri, fileName: a.fileName ?? `police_${Date.now()}.jpg`, mimeType: 'image/jpeg' };

    setScanning(true);
    try {
      const form = new FormData();
      // React Native dosya parçası: { uri, name, type }
      form.append('file', { uri: asset.uri, name: asset.fileName, type: asset.mimeType } as any);
      const res = await apiPostForm<{ fields: OcrFields }>('/api/ocr/policy', form);
      setOcr({ fields: res.fields ?? {}, asset });
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'OCR başarısız';
      if (e instanceof ApiError && e.status === 401) msg = 'Sunucu güncellemesi henüz yayınlanmamış olabilir.';
      Alert.alert('Okunamadı', msg);
    } finally {
      setScanning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>Evrak Merkezi</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.hBtn}><Text style={styles.hAdd}>+ Ekle</Text></TouchableOpacity>
      </View>

      {/* Poliçe Tara (OCR) */}
      <TouchableOpacity style={styles.scanBtn} onPress={scanPolicy} disabled={scanning} activeOpacity={0.85}>
        {scanning
          ? <><ActivityIndicator color="#fff" /><Text style={styles.scanText}>  Okunuyor…</Text></>
          : <Text style={styles.scanText}>📸  Poliçe Tara (OCR) → Otomatik Müşteri/Poliçe</Text>}
      </TouchableOpacity>

      {/* Kategori filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {['Tümü', ...CATEGORIES].map((c) => {
          const active = filter === c;
          return (
            <TouchableOpacity key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(c)} activeOpacity={0.7}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={styles.emptyTitle}>{filter === 'Tümü' ? 'Henüz evrak yok' : `"${filter}" kategorisinde evrak yok`}</Text>
              <Text style={styles.emptySub}>Yukarıdan poliçe tara ya da “+ Ekle” ile belge yükle.</Text>
            </View>
          ) : (
            visible.map((d) => {
              const ic = fileIcon(d.file_type);
              return (
                <TouchableOpacity key={d.id} style={styles.row} onPress={() => openDoc(d)} onLongPress={() => confirmDelete(d)} activeOpacity={0.7}>
                  <View style={[styles.fileIcon, { backgroundColor: ic.color + '18' }]}>
                    {opening === d.id ? <ActivityIndicator size="small" color={ic.color} /> : <Text style={{ fontSize: 18 }}>{ic.icon}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{d.file_name}</Text>
                    <Text style={styles.fileMeta} numberOfLines={1}>
                      {d.customers?.name ?? 'Müşteri yok'} · {fmtDate(d.created_at)}{d.file_size ? ` · ${formatFileSize(d.file_size)}` : ''}
                    </Text>
                  </View>
                  {!!d.doc_type && <View style={styles.catBadge}><Text style={styles.catBadgeText}>{d.doc_type}</Text></View>}
                </TouchableOpacity>
              );
            })
          )}
          <Text style={styles.hint}>İpucu: Bir evrakı silmek için uzun bas.</Text>
        </ScrollView>
      )}

      {addOpen && (
        <AddDocModal agencyId={agencyId} userId={userId} onClose={() => setAddOpen(false)} onUploaded={() => { setAddOpen(false); load(); }} />
      )}
      {ocr && (
        <OcrReviewModal
          fields={ocr.fields}
          asset={ocr.asset}
          agencyId={agencyId}
          userId={userId}
          onClose={() => setOcr(null)}
          onCreated={() => { setOcr(null); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Belge ekleme: müşteri seç + kategori → kamera/galeri/dosya ───────────────
function AddDocModal({
  agencyId, userId, onClose, onUploaded,
}: { agencyId: string | null; userId: string | null; onClose: () => void; onUploaded: () => void }) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [category, setCategory] = useState('Diğer');

  async function searchCustomers(q: string) {
    setSearch(q);
    if (q.length < 2) { setSuggestions([]); return; }
    let query = (supabase.from('customers') as any).select('id, name, phone').ilike('name', `%${q}%`).limit(6);
    if (agencyId) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    setSuggestions(data ?? []);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.hBtn} />
            <Text style={styles.hTitle}>Belge Ekle</Text>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hAdd}>Kapat</Text></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>MÜŞTERİ SEÇ</Text>
            {selected ? (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedText}>✅ {selected.name}</Text>
                <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color: Colors.danger, fontSize: 13 }}>Değiştir</Text></TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput style={styles.input} value={search} onChangeText={searchCustomers} placeholder="Müşteri adı ara…" placeholderTextColor={Colors.placeholder} />
                {suggestions.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.suggestion} onPress={() => { setSelected({ id: c.id, name: c.name }); setSuggestions([]); setSearch(''); }}>
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    {c.phone ? <Text style={styles.suggestionSub}>{c.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {selected && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>KATEGORİ</Text>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)} activeOpacity={0.7}>
                      <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ marginTop: Spacing.lg }}>
                  <Text style={styles.sectionLabel}>EVRAK YÜKLE</Text>
                  <DocumentUploader
                    entity="customers"
                    entityId={selected.id}
                    agencyId={agencyId}
                    uploadedBy={userId}
                    docType={category}
                    onUploaded={() => { Alert.alert('✅ Yüklendi', `${category} · ${selected.name}`); onUploaded(); }}
                  />
                  <Text style={styles.hint}>Kamera ile çek, galeriden seç veya PDF yükle. {selected.name} klasörüne kaydedilir.</Text>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── OCR sonucu inceleme + müşteri/poliçe oluşturma ───────────────────────────
const OCR_GROUPS: { title: string; rows: [string, string][] }[] = [
  { title: 'MÜŞTERİ', rows: [['customer_name', 'Ad Soyad'], ['phone', 'Telefon'], ['tc_identity_no', 'TC / VKN']] },
  { title: 'POLİÇE', rows: [['policy_type', 'Tür'], ['policy_no', 'Poliçe No'], ['insurance_company', 'Şirket'], ['start_date', 'Başlangıç (YYYY-AA-GG)'], ['end_date', 'Bitiş (YYYY-AA-GG)'], ['premium', 'Prim ₺']] },
  { title: 'ARAÇ / DİĞER', rows: [['plate', 'Plaka'], ['vehicle_brand', 'Marka'], ['vehicle_model', 'Model'], ['vehicle_year', 'Yıl'], ['address', 'Adres']] },
];
const CORE = new Set(['customer_name', 'policy_type', 'start_date', 'end_date', 'premium', 'phone']);

function OcrReviewModal({
  fields, asset, agencyId, userId, onClose, onCreated,
}: { fields: OcrFields; asset: Asset; agencyId: string | null; userId: string | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const k of Object.keys(fields)) f[k] = fields[k]?.value ?? '';
    return f;
  });
  const [creating, setCreating] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function create() {
    const name = (form.customer_name ?? '').trim();
    if (!name) { Alert.alert('Ad gerekli', 'OCR ad bulamadı — lütfen elle girin.'); return; }
    setCreating(true);
    try {
      const cl = await checkLimit(agencyId, 'customers');
      if (!cl.ok) { Alert.alert('Limit', limitErrorMessage('customers', cl)); setCreating(false); return; }

      const today = new Date().toISOString().slice(0, 10);
      const extra: Record<string, string> = {};
      if (form.plate) extra.plaka = form.plate;
      const mm = [form.vehicle_brand, form.vehicle_model].filter(Boolean).join(' ').trim();
      if (mm) extra.marka_model = mm;
      if (form.vehicle_year) extra.arac_yili = form.vehicle_year;
      if (form.address) extra.adres = form.address;
      if (form.city) extra.il = form.city;
      if (form.district) extra.ilce = form.district;

      const { data: cust, error: ce } = await (supabase.from('customers') as any).insert({
        name,
        phone: form.phone || '',
        insurance_type: form.policy_type || 'Diğer',
        identity_no: form.tc_identity_no || form.identity_no || form.tax_no || null,
        vehicle_plate: form.plate || null,
        policy_end_date: form.end_date || null,
        extra_data: Object.keys(extra).length ? extra : null,
        agency_id: agencyId,
      }).select().single();
      if (ce) throw new Error(ce.message);

      let policyId: string | null = null;
      const pl = await checkLimit(agencyId, 'policies');
      if (pl.ok && form.policy_type && form.end_date) {
        const premium = form.premium ? Number(form.premium.replace(/[^\d]/g, '')) : null;
        const { data: pol, error: pe } = await (supabase.from('policies') as any).insert({
          customer_id: cust.id,
          policy_type: form.policy_type,
          start_date: form.start_date || today,
          end_date: form.end_date,
          premium: Number.isFinite(premium as number) ? premium : null,
          insurance_company: form.insurance_company || null,
          policy_no: form.policy_no || null,
          status: 'Aktif',
          agency_id: agencyId,
        }).select().single();
        if (!pe && pol) policyId = pol.id;
      }

      // Taranan görseli ilgili kayda Poliçe evrakı olarak ekle (best-effort)
      await uploadDocument({
        uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: null,
        entity: policyId ? 'policies' : 'customers',
        entityId: policyId ?? cust.id,
        agencyId, uploadedBy: userId, docType: 'Poliçe',
      }).catch(() => {});

      Alert.alert('✅ Oluşturuldu', `${name}${policyId ? ' + poliçe' : ''} kaydedildi.`);
      onCreated();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hBack}>İptal</Text></TouchableOpacity>
            <Text style={styles.hTitle}>OCR Sonucu</Text>
            <View style={styles.hBtn} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>Alanları kontrol et, gerekirse düzelt. Sonra müşteri ve poliçe oluşturulur.</Text>
            {OCR_GROUPS.map((g) => {
              const rows = g.rows.filter(([k]) => CORE.has(k) || (form[k] ?? '').length > 0);
              if (!rows.length) return null;
              return (
                <View key={g.title} style={{ marginTop: Spacing.md }}>
                  <Text style={styles.sectionLabel}>{g.title}</Text>
                  <View style={styles.card}>
                    {rows.map(([k, label], i) => {
                      const lowConf = fields[k]?.needsReview || (fields[k]?.confidence != null && (fields[k]!.confidence as number) < 0.5);
                      return (
                        <View key={k} style={[styles.ocrRow, i < rows.length - 1 && styles.ocrRowBorder]}>
                          <Text style={styles.ocrLabel}>{label}{lowConf ? ' ⚠️' : ''}</Text>
                          <TextInput
                            style={styles.ocrInput}
                            value={form[k] ?? ''}
                            onChangeText={(v) => set(k, v)}
                            placeholder="—"
                            placeholderTextColor={Colors.placeholder}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={create} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Müşteri + Poliçe Oluştur</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 64 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hAdd: { ...Type.subhead, color: Colors.primary, textAlign: 'right' },
  hTitle: { ...Type.heading, fontSize: 16 },

  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: Radius.lg, paddingVertical: 14, ...Shadow.sm },
  scanText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterScroll: { flexGrow: 0, marginTop: Spacing.sm },
  filterRow: { paddingHorizontal: Spacing.lg, gap: 8, paddingVertical: Spacing.sm },
  chip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Type.caption, color: Colors.text },
  chipTextActive: { color: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  fileIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fileName: { ...Type.subhead, fontSize: 14 },
  fileMeta: { ...Type.caption, marginTop: 2 },
  catBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  hint: { ...Type.caption, color: Colors.placeholder, marginTop: Spacing.md, lineHeight: 17 },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { ...Type.heading, textAlign: 'center', paddingHorizontal: 20 },
  emptySub: { ...Type.caption, textAlign: 'center', marginTop: 4, paddingHorizontal: 30, lineHeight: 18 },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, ...Shadow.sm },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, color: Colors.heading },
  suggestion: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  suggestionText: { ...Type.subhead, fontSize: 14 },
  suggestionSub: { ...Type.caption, marginTop: 2 },
  selectedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#86EFAC' },
  selectedText: { fontSize: 14, color: Colors.success, fontWeight: '600' },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { ...Type.caption, color: Colors.text },
  catChipTextActive: { color: '#fff' },

  ocrRow: { paddingVertical: 8 },
  ocrRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  ocrLabel: { ...Type.caption, color: Colors.secondary, marginBottom: 2 },
  ocrInput: { ...Type.body, color: Colors.heading, paddingVertical: 4 },
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: Spacing.lg },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
