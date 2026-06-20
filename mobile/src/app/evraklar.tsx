/**
 * src/app/evraklar.tsx — Evrak Merkezi
 * Acentenin tüm evrakları tek yerde; müşteri seçip kamera/galeri/dosya ile yükle.
 * Mevcut storage.ts + DocumentUploader altyapısını kullanır (müşteri bazlı klasör).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Linking, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { fileIcon, formatFileSize, getSignedUrl, deleteDocument } from '@/lib/storage';
import type { DocumentRecord } from '@/lib/types';
import DocumentUploader from '@/components/DocumentUploader';

type DocRow = DocumentRecord & { customers?: { name: string } | null };

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
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    let q = (supabase.from('documents') as any)
      .select('id,file_name,file_path,file_type,file_size,customer_id,agency_id,created_at,customers(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (agencyId) q = q.eq('agency_id', agencyId);
    const { data } = await q;
    setDocs(data ?? []);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>Evrak Merkezi</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.hBtn}><Text style={styles.hAdd}>+ Ekle</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.countLabel}>{docs.length} evrak</Text>
          {docs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={styles.emptyTitle}>Henüz evrak yok</Text>
              <Text style={styles.emptySub}>Kimlik, ruhsat, poliçe veya hasar evrakını müşteriye ekle.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddOpen(true)}><Text style={styles.emptyBtnText}>Belge Ekle</Text></TouchableOpacity>
            </View>
          ) : (
            docs.map((d) => {
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
                  <Text style={styles.chevron}>›</Text>
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
    </SafeAreaView>
  );
}

// ─── Belge ekleme: müşteri seç → kamera/galeri/dosya ──────────────────────────
function AddDocModal({
  agencyId, userId, onClose, onUploaded,
}: { agencyId: string | null; userId: string | null; onClose: () => void; onUploaded: () => void }) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

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
                <TextInput
                  style={styles.input}
                  value={search} onChangeText={searchCustomers}
                  placeholder="Müşteri adı ara…" placeholderTextColor={Colors.placeholder}
                />
                {suggestions.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.suggestion} onPress={() => { setSelected({ id: c.id, name: c.name }); setSuggestions([]); setSearch(''); }}>
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    {c.phone ? <Text style={styles.suggestionSub}>{c.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {selected && (
              <View style={{ marginTop: Spacing.lg }}>
                <Text style={styles.sectionLabel}>EVRAK YÜKLE</Text>
                <DocumentUploader
                  entity="customers"
                  entityId={selected.id}
                  agencyId={agencyId}
                  uploadedBy={userId}
                  onUploaded={() => { Alert.alert('✅ Yüklendi', 'Evrak kaydedildi.'); onUploaded(); }}
                />
                <Text style={styles.hint}>Kamera ile çek, galeriden seç veya PDF yükle. {selected.name} klasörüne kaydedilir.</Text>
              </View>
            )}
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

  countLabel: { ...Type.label, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  fileIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fileName: { ...Type.subhead, fontSize: 14 },
  fileMeta: { ...Type.caption, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.placeholder, fontWeight: '300', marginLeft: 8 },
  hint: { ...Type.caption, color: Colors.placeholder, marginTop: Spacing.md, lineHeight: 17 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { ...Type.heading },
  emptySub: { ...Type.caption, textAlign: 'center', marginTop: 4, paddingHorizontal: 30, lineHeight: 18 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 11, marginTop: Spacing.lg },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, color: Colors.heading },
  suggestion: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  suggestionText: { ...Type.subhead, fontSize: 14 },
  suggestionSub: { ...Type.caption, marginTop: 2 },
  selectedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#86EFAC' },
  selectedText: { fontSize: 14, color: Colors.success, fontWeight: '600' },
});
