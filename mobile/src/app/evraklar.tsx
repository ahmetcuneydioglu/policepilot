/**
 * src/app/evraklar.tsx — Evrak Merkezi
 * - Liste: MÜŞTERİ ADI (büyük) + poliçe türü; imzalı URL ile açma (her bucket)
 * - Poliçe Tara (OCR) + Toplu Poliçe → /api/customers/from-policy (müşteri eşleştirme + policy_no dedup)
 * - + Ekle: müşteri+kategori seçip kamera/galeri/dosya yükleme
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
import { fileIcon, formatFileSize, deleteDocument } from '@/lib/storage';
import { apiPost, ApiError } from '@/lib/api';
import {
  POLICY_TYPES, ocrToRow, ocrExtract, submitFromPolicy, isValidRow,
  type Asset, type PolicyRow,
} from '@/lib/policyOcr';
import type { DocumentRecord } from '@/lib/types';
import DocumentUploader from '@/components/DocumentUploader';
import BulkPolicyImportMobile from '@/components/BulkPolicyImportMobile';

type DocRow = DocumentRecord & { customers?: { name: string } | null; policies?: { policy_type: string } | null };

const CATEGORIES = ['Kimlik', 'Ruhsat', 'Poliçe', 'Hasar Evrakı', 'Diğer'];

function getImagePicker() {
  try { return require('expo-image-picker'); } catch { return null; }
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function docTypeLabel(t?: string | null): string {
  if (!t) return '';
  if (t === 'policy' || t === 'ocr' || t === 'ocr_upload') return 'Poliçe';
  return t;
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocr, setOcr] = useState<{ row: PolicyRow; asset: Asset; meta: { provider: string; mode: string; raw: string } } | null>(null);

  const load = useCallback(async () => {
    let q = (supabase.from('documents') as any)
      .select('id,file_name,file_path,file_type,file_size,customer_id,agency_id,bucket,doc_type,created_at,customers(name),policies(policy_type)')
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
    () => (filter === 'Tümü' ? docs : docs.filter((d) => (docTypeLabel(d.doc_type) || '') === filter || (d.doc_type ?? '') === filter)),
    [docs, filter]
  );

  async function openDoc(d: DocRow) {
    setOpening(d.id);
    try {
      const { url } = await apiPost<{ url: string }>('/api/documents/sign', { id: d.id });
      if (url) await Linking.openURL(url);
      else Alert.alert('Açılamadı', 'Dosya bağlantısı alınamadı.');
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401 ? 'Sunucu güncellemesi yayınlanmalı.' : e instanceof Error ? e.message : 'Açılamadı';
      Alert.alert('Açılamadı', msg);
    } finally {
      setOpening(null);
    }
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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    const asset: Asset = { uri: a.uri, fileName: a.fileName ?? `police_${Date.now()}.jpg`, mimeType: 'image/jpeg' };

    setScanning(true);
    try {
      const res = await ocrExtract(asset);
      setOcr({ row: ocrToRow(res.fields), asset, meta: { provider: res.provider, mode: res.mode, raw: res.raw } });
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401 ? 'Sunucu güncellemesi henüz yayınlanmamış olabilir.' : e instanceof Error ? e.message : 'OCR başarısız';
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

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.action, scanning && { opacity: 0.6 }]} onPress={scanPolicy} disabled={scanning} activeOpacity={0.85}>
          {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>📸  Poliçe Tara</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, styles.actionAlt]} onPress={() => setBulkOpen(true)} activeOpacity={0.85}>
          <Text style={[styles.actionText, { color: Colors.primary }]}>📦  Toplu Poliçe</Text>
        </TouchableOpacity>
      </View>

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
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} showsVerticalScrollIndicator={false}>
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={styles.emptyTitle}>{filter === 'Tümü' ? 'Henüz evrak yok' : `"${filter}" kategorisinde evrak yok`}</Text>
              <Text style={styles.emptySub}>Poliçe tara, toplu içe aktar ya da “+ Ekle” ile belge yükle.</Text>
            </View>
          ) : (
            visible.map((d) => {
              const ic = fileIcon(d.file_type);
              const desc = d.policies?.policy_type || docTypeLabel(d.doc_type) || 'Evrak';
              return (
                <TouchableOpacity key={d.id} style={styles.row} onPress={() => openDoc(d)} onLongPress={() => confirmDelete(d)} activeOpacity={0.7}>
                  <View style={[styles.fileIcon, { backgroundColor: ic.color + '18' }]}>
                    {opening === d.id ? <ActivityIndicator size="small" color={ic.color} /> : <Text style={{ fontSize: 18 }}>{ic.icon}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{(d.customers?.name ?? 'MÜŞTERİ YOK').toLocaleUpperCase('tr-TR')}</Text>
                    <Text style={styles.fileMeta} numberOfLines={1}>{desc} · {fmtDate(d.created_at)}{d.file_size ? ` · ${formatFileSize(d.file_size)}` : ''}</Text>
                  </View>
                  <View style={styles.catBadge}><Text style={styles.catBadgeText}>{docTypeLabel(d.doc_type) || desc}</Text></View>
                </TouchableOpacity>
              );
            })
          )}
          <Text style={styles.hint}>İpucu: Bir evrakı silmek için uzun bas.</Text>
        </ScrollView>
      )}

      {addOpen && <AddDocModal agencyId={agencyId} userId={userId} onClose={() => setAddOpen(false)} onUploaded={() => { setAddOpen(false); load(); }} />}
      {bulkOpen && <BulkPolicyImportMobile agencyId={agencyId} onClose={() => setBulkOpen(false)} onDone={load} />}
      {ocr && <OcrReviewModal row={ocr.row} asset={ocr.asset} meta={ocr.meta} agencyId={agencyId} onClose={() => setOcr(null)} onCreated={() => { setOcr(null); load(); }} />}
    </SafeAreaView>
  );
}

// ─── + Ekle: müşteri + kategori → kamera/galeri/dosya ─────────────────────────
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
                  <DocumentUploader entity="customers" entityId={selected.id} agencyId={agencyId} uploadedBy={userId} docType={category}
                    onUploaded={() => { Alert.alert('✅ Yüklendi', `${category} · ${selected.name}`); onUploaded(); }} />
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

// ─── OCR tekli inceleme → from-policy ─────────────────────────────────────────
const OCR_FIELDS: { key: keyof PolicyRow; label: string; isType?: boolean }[] = [
  { key: 'name', label: 'Ad Soyad *' },
  { key: 'phone', label: 'Telefon' },
  { key: 'tc_identity_no', label: 'TC / VKN' },
  { key: 'policy_type', label: 'Tür *', isType: true },
  { key: 'policy_no', label: 'Poliçe No' },
  { key: 'insurance_company', label: 'Şirket' },
  { key: 'start_date', label: 'Başlangıç (YYYY-AA-GG)' },
  { key: 'end_date', label: 'Bitiş (YYYY-AA-GG)' },
  { key: 'premium', label: 'Prim ₺' },
  { key: 'plate', label: 'Plaka' },
  { key: 'brand_model', label: 'Marka / Model' },
  { key: 'vehicle_year', label: 'Yıl' },
];
const CORE = new Set<keyof PolicyRow>(['name', 'phone', 'policy_type', 'start_date', 'end_date', 'premium']);

function OcrReviewModal({
  row, asset, meta, agencyId, onClose, onCreated,
}: { row: PolicyRow; asset: Asset; meta: { provider: string; mode: string; raw: string }; agencyId: string | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<PolicyRow>(row);
  const [creating, setCreating] = useState(false);
  const [typePicker, setTypePicker] = useState(false);
  const set = (k: keyof PolicyRow, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function create() {
    if (!isValidRow(form)) { Alert.alert('Eksik', 'Ad Soyad ve Tür zorunludur.'); return; }
    setCreating(true);
    const res = await submitFromPolicy(asset, form, meta, agencyId);
    setCreating(false);
    if (res.status === 'saved') {
      Alert.alert('✅ Oluşturuldu', res.matched ? `${form.name} (mevcut müşteriye eklendi) + poliçe.` : `${form.name} + poliçe kaydedildi.`);
      onCreated();
    } else if (res.status === 'duplicate') {
      Alert.alert('Zaten kayıtlı', res.error ?? 'Bu poliçe numarası zaten kayıtlı — yeni kayıt oluşturulmadı.');
      onCreated();
    } else {
      Alert.alert('Hata', res.error ?? 'Oluşturulamadı');
    }
  }

  const fields = OCR_FIELDS.filter(({ key }) => CORE.has(key) || (form[key] ?? '').length > 0);

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
            <Text style={styles.hint}>Alanları kontrol et, gerekirse düzelt. Aynı TC/telefon mevcut müşteriye bağlanır; aynı poliçe no tekrar eklenmez.</Text>
            <View style={[styles.card, { marginTop: Spacing.md, paddingVertical: 4 }]}>
              {fields.map(({ key, label, isType }, i) => (
                <View key={key} style={[styles.ocrRow, i < fields.length - 1 && styles.ocrRowBorder]}>
                  <Text style={styles.ocrLabel}>{label}</Text>
                  {isType ? (
                    <TouchableOpacity onPress={() => setTypePicker(true)}><Text style={[styles.ocrInput, !form.policy_type && { color: Colors.placeholder }]}>{form.policy_type || 'Tür seç…'}</Text></TouchableOpacity>
                  ) : (
                    <TextInput style={styles.ocrInput} value={form[key]} onChangeText={(v) => set(key, v)} placeholder="—" placeholderTextColor={Colors.placeholder} />
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={create} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Müşteri + Poliçe Oluştur</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {typePicker && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setTypePicker(false)}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setTypePicker(false)}>
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>Poliçe Türü</Text>
                <ScrollView>
                  {POLICY_TYPES.map((t) => (
                    <TouchableOpacity key={t} style={styles.sheetRow} onPress={() => { set('policy_type', t); setTypePicker(false); }}>
                      <Text style={styles.sheetRowText}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
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

  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, ...Shadow.sm },
  actionAlt: { backgroundColor: Colors.primaryLight },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterScroll: { flexGrow: 0, marginTop: Spacing.sm },
  filterRow: { paddingHorizontal: Spacing.lg, gap: 8, paddingVertical: Spacing.sm },
  chip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Type.caption, color: Colors.text },
  chipTextActive: { color: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  fileIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fileName: { fontSize: 14, fontWeight: '800', color: Colors.heading, letterSpacing: 0.2 },
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

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '70%' },
  sheetTitle: { ...Type.heading, fontSize: 16, marginBottom: Spacing.sm },
  sheetRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetRowText: { ...Type.body, color: Colors.heading },
});
