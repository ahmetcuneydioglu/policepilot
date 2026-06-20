/**
 * src/components/BulkPolicyImportMobile.tsx
 * Toplu Poliçe İçe Aktarma (web BulkPolicyImport mobil karşılığı):
 *   çoklu PDF/JPG/PNG seç → sırayla /api/ocr/policy → düzenlenebilir liste →
 *   "Hepsini Kaydet" sırayla /api/customers/from-policy (mükerrer poliçe atlanır).
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import {
  POLICY_TYPES, ocrToRow, ocrExtract, submitFromPolicy, isValidRow, emptyRow,
  type Asset, type PolicyRow,
} from '@/lib/policyOcr';

function getDocumentPicker() {
  try { return require('expo-document-picker'); } catch { return null; }
}

type Status = 'queued' | 'reading' | 'ready' | 'ocr_error' | 'saving' | 'saved' | 'save_error' | 'duplicate';
type Row = { id: string; asset: Asset; status: Status; data: PolicyRow; meta?: { provider: string; mode: string; raw: string }; matched?: boolean; error?: string };

export default function BulkPolicyImportMobile({
  agencyId, onClose, onDone,
}: { agencyId: string | null; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<'select' | 'review' | 'done'>('select');
  const [busy, setBusy] = useState(false);
  const [typePickerFor, setTypePickerFor] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ saved: number; matched: number; failed: number; duplicate: number } | null>(null);

  async function pickFiles() {
    const DP = getDocumentPicker();
    if (!DP) { Alert.alert('Modül yok', 'Dosya seçici yüklenemedi.'); return; }
    const res = await DP.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const added: Row[] = res.assets
        .map((a: any) => ({
          id: `${a.name}-${a.size ?? 0}`,
          asset: { uri: a.uri, fileName: a.name, mimeType: a.mimeType ?? 'application/pdf' } as Asset,
          status: 'queued' as Status,
          data: emptyRow(),
        }))
        .filter((r: Row) => !seen.has(r.id));
      return [...prev, ...added];
    });
  }

  async function runOcr() {
    setBusy(true);
    setPhase('review');
    // Sırayla oku (Vercel süre limiti güvenli)
    for (const row of rows) {
      if (row.status !== 'queued') continue;
      setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'reading' } : r)));
      try {
        const ocr = await ocrExtract(row.asset);
        const data = ocrToRow(ocr.fields);
        setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'ready', data, meta: { provider: ocr.provider, mode: ocr.mode, raw: ocr.raw } } : r)));
      } catch (e) {
        setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'ocr_error', error: e instanceof Error ? e.message : 'OCR hatası' } : r)));
      }
    }
    setBusy(false);
  }

  function update(id: string, key: keyof PolicyRow, value: string) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, data: { ...r.data, [key]: value } } : r)));
  }
  function removeRow(id: string) { setRows((p) => p.filter((r) => r.id !== id)); }

  async function saveAll() {
    const valid = rows.filter((r) => (r.status === 'ready' || r.status === 'save_error') && isValidRow(r.data));
    if (!valid.length) { Alert.alert('Eksik', 'Kaydedilecek geçerli satır yok (Ad ve Tür zorunlu).'); return; }
    setBusy(true);
    let saved = 0, matched = 0, failed = 0, duplicate = 0;
    for (const row of valid) {
      setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'saving' } : r)));
      const res = await submitFromPolicy(row.asset, row.data, row.meta ?? { provider: '', mode: 'real', raw: '' }, agencyId);
      if (res.status === 'saved') {
        saved++; if (res.matched) matched++;
        setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'saved', matched: res.matched } : r)));
      } else if (res.status === 'duplicate') {
        duplicate++;
        setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'duplicate', error: res.error } : r)));
      } else {
        failed++;
        setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: 'save_error', error: res.error } : r)));
      }
    }
    setBusy(false);
    setSummary({ saved, matched, failed, duplicate });
    setPhase('done');
    onDone();
  }

  const readCount = rows.filter((r) => ['ready', 'saved', 'save_error', 'duplicate'].includes(r.status)).length;
  const validCount = rows.filter((r) => (r.status === 'ready' || r.status === 'save_error') && isValidRow(r.data)).length;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.hTitle}>📦 Toplu Poliçe</Text>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hClose}>Kapat</Text></TouchableOpacity>
        </View>

        {phase === 'done' && summary ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneEmoji}>✅</Text>
            <Text style={styles.doneTitle}>İçe aktarma tamamlandı</Text>
            <Text style={styles.doneLine}><Text style={{ color: Colors.success, fontWeight: '800' }}>{summary.saved}</Text> poliçe kaydedildi{summary.matched > 0 ? ` · ${summary.matched} mevcut müşteriye eklendi` : ''}</Text>
            {summary.duplicate > 0 && <Text style={[styles.doneLine, { color: '#B45309' }]}>{summary.duplicate} poliçe zaten kayıtlıydı (atlandı)</Text>}
            {summary.failed > 0 && <Text style={[styles.doneLine, { color: Colors.danger }]}>{summary.failed} satır kaydedilemedi</Text>}
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose}><Text style={styles.primaryBtnText}>Bitti</Text></TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.pickBtn} onPress={pickFiles} activeOpacity={0.8}>
              <Text style={styles.pickEmoji}>📎</Text>
              <Text style={styles.pickText}>Poliçe dosyalarını seç (çoklu)</Text>
              <Text style={styles.pickSub}>PDF / JPG / PNG · her biri max 8MB</Text>
            </TouchableOpacity>

            {rows.length > 0 && (
              <View style={styles.barRow}>
                <Text style={styles.barText}>{rows.length} dosya{readCount > 0 ? ` · ${readCount} okundu` : ''}{validCount > 0 ? ` · ${validCount} hazır` : ''}</Text>
                {phase === 'select'
                  ? <TouchableOpacity style={[styles.actBtn, busy && { opacity: 0.6 }]} onPress={runOcr} disabled={busy}><Text style={styles.actBtnText}>{busy ? 'Okunuyor…' : `${rows.length} Poliçeyi Oku`}</Text></TouchableOpacity>
                  : <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.success }, (busy || validCount === 0) && { opacity: 0.6 }]} onPress={saveAll} disabled={busy || validCount === 0}><Text style={styles.actBtnText}>{busy ? 'Kaydediliyor…' : `${validCount} Poliçeyi Kaydet`}</Text></TouchableOpacity>}
              </View>
            )}

            {busy && (
              <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.round((readCount / Math.max(1, rows.length)) * 100)}%` }]} /></View>
            )}

            {rows.map((r) => {
              const valid = isValidRow(r.data);
              const locked = ['saving', 'saved', 'reading', 'duplicate'].includes(r.status);
              return (
                <View key={r.id} style={[styles.card, r.status === 'duplicate' && { opacity: 0.7 }]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardFile} numberOfLines={1}>{r.asset.fileName}</Text>
                    <StatusTag row={r} valid={valid} />
                  </View>
                  {(r.status === 'ready' || r.status === 'save_error' || r.status === 'saving' || r.status === 'saved' || r.status === 'duplicate') && (
                    <>
                      <TextInput style={[styles.input, !r.data.name && styles.inputWarn]} value={r.data.name} editable={!locked} onChangeText={(v) => update(r.id, 'name', v)} placeholder="Ad Soyad *" placeholderTextColor={Colors.placeholder} />
                      <View style={styles.twoCol}>
                        <TouchableOpacity style={[styles.typeBtn, !r.data.policy_type && styles.inputWarn]} disabled={locked} onPress={() => setTypePickerFor(r.id)}>
                          <Text style={[styles.typeBtnText, !r.data.policy_type && { color: '#B45309' }]}>{r.data.policy_type || 'Tür seç *'}</Text>
                        </TouchableOpacity>
                        <TextInput style={[styles.input, { flex: 1 }]} value={r.data.premium} editable={!locked} onChangeText={(v) => update(r.id, 'premium', v)} placeholder="Prim ₺" placeholderTextColor={Colors.placeholder} keyboardType="decimal-pad" />
                      </View>
                      {!!r.error && <Text style={styles.errText} numberOfLines={2}>{r.error}</Text>}
                      {!locked && <TouchableOpacity onPress={() => removeRow(r.id)}><Text style={styles.removeText}>Kaldır</Text></TouchableOpacity>}
                    </>
                  )}
                  {r.status === 'ocr_error' && (
                    <Text style={styles.errText}>OCR okunamadı: {r.error}</Text>
                  )}
                </View>
              );
            })}

            {phase === 'review' && rows.length > 0 && (
              <Text style={styles.hint}>Sarı alanlar zorunlu (Ad, Tür). Aynı TC/telefona sahip poliçeler tek müşteriye bağlanır; mükerrer poliçe no atlanır.</Text>
            )}
          </ScrollView>
        )}

        {/* Tür seçici */}
        {typePickerFor && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setTypePickerFor(null)}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setTypePickerFor(null)}>
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>Poliçe Türü</Text>
                <ScrollView>
                  {POLICY_TYPES.map((t) => (
                    <TouchableOpacity key={t} style={styles.sheetRow} onPress={() => { update(typePickerFor, 'policy_type', t); setTypePickerFor(null); }}>
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

function StatusTag({ row, valid }: { row: Row; valid: boolean }) {
  const map: Record<Status, { t: string; c: string }> = {
    queued: { t: 'bekliyor', c: Colors.secondary },
    reading: { t: '⏳ okunuyor', c: '#6D28D9' },
    ready: valid ? { t: '● hazır', c: Colors.success } : { t: '● eksik', c: '#B45309' },
    ocr_error: { t: '❌ OCR', c: Colors.danger },
    saving: { t: '💾 kayıt', c: Colors.primary },
    saved: { t: row.matched ? '✓ eklendi' : '✓ kaydedildi', c: Colors.success },
    duplicate: { t: '⊘ zaten kayıtlı', c: '#B45309' },
    save_error: { t: '❌ kayıt', c: Colors.danger },
  };
  const s = map[row.status];
  return <Text style={{ fontSize: 11, fontWeight: '700', color: s.c }}>{s.t}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hTitle: { ...Type.heading, fontSize: 16 },
  hBtn: { minWidth: 56 },
  hClose: { ...Type.subhead, color: Colors.primary, textAlign: 'right' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  pickBtn: { alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: Radius.lg, paddingVertical: 24, backgroundColor: Colors.primaryLight },
  pickEmoji: { fontSize: 28, marginBottom: 6 },
  pickText: { ...Type.subhead, color: Colors.primary },
  pickSub: { ...Type.caption, color: Colors.primary, marginTop: 2 },

  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  barText: { ...Type.caption, flex: 1 },
  actBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  actBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  progress: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginTop: 10, ...Shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardFile: { ...Type.caption, flex: 1, marginRight: 8, color: Colors.heading, fontWeight: '600' },
  input: { backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.heading, marginBottom: 8 },
  inputWarn: { borderColor: '#FCD34D' },
  twoCol: { flexDirection: 'row', gap: 8 },
  typeBtn: { backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, justifyContent: 'center', minWidth: 110, marginBottom: 8 },
  typeBtnText: { fontSize: 14, color: Colors.heading, fontWeight: '600' },
  errText: { ...Type.caption, color: Colors.danger, marginTop: 2 },
  removeText: { ...Type.caption, color: Colors.danger, fontWeight: '700', marginTop: 6 },
  hint: { ...Type.caption, color: Colors.placeholder, marginTop: Spacing.md, lineHeight: 17 },

  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { ...Type.title, fontSize: 20, marginBottom: 8 },
  doneLine: { ...Type.body, color: Colors.text, textAlign: 'center', marginBottom: 4 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 28, paddingVertical: 12, marginTop: Spacing.lg },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '70%' },
  sheetTitle: { ...Type.heading, fontSize: 16, marginBottom: Spacing.sm },
  sheetRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetRowText: { ...Type.body, color: Colors.heading },
});
