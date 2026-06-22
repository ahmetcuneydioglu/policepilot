/**
 * src/app/quote-center.tsx — Teklif Merkezi (liste + KPI + yeni çalışma)
 * Demo motoru (quoteDemo) + web /api/quote-runs köprüsü. Detay: /quote-run/[id].
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { formatTRY, formatShortTRY } from '@/lib/format';
import { QUOTE_PRODUCTS } from '@/lib/quoteDemo';
import { listQuoteRuns, startQuoteRun, runStatusMeta, bestPrice, productMeta, QuoteRun } from '@/lib/quoteCenter';
import { ApiError } from '@/lib/api';

const ACTIVE = ['Yeni', 'Teklif Verildi', 'Müşteri Düşünüyor'];
const STATUS_TABS = ['Tümü', 'Yeni', 'Teklif Verildi', 'Müşteri Düşünüyor', 'Kazanıldı', 'Kaybedildi', 'İptal'];

function initials(n: string) { return n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

export default function QuoteCenterScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();
  const [runs, setRuns] = useState<QuoteRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('Tümü');

  const load = useCallback(async () => {
    setError(null);
    try { setRuns(await listQuoteRuns()); }
    catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Sunucuya bağlanılamadı — web köprüsü yayınlanmalı.' : e instanceof Error ? e.message : 'Hata');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const kpi = useMemo(() => {
    const total = runs.length;
    const won = runs.filter((r) => r.status === 'Kazanıldı').length;
    const active = runs.filter((r) => ACTIVE.includes(r.status)).length;
    const ym = new Date().toISOString().slice(0, 7);
    const month = runs.filter((r) => (r.created_at ?? '').slice(0, 7) === ym).length;
    const winRate = won + runs.filter((r) => r.status === 'Kaybedildi').length > 0
      ? Math.round((won / (won + runs.filter((r) => r.status === 'Kaybedildi').length)) * 100) : 0;
    return { total, active, won, winRate, month };
  }, [runs]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of runs) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [runs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (statusTab !== 'Tümü' && r.status !== statusTab) return false;
      if (q) {
        const hay = `${r.customer_name ?? ''} ${r.product_type ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [runs, query, statusTab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>Teklif Merkezi</Text>
        <TouchableOpacity onPress={() => setNewOpen(true)} style={styles.hBtn}><Text style={styles.hAdd}>+ Yeni</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} showsVerticalScrollIndicator={false}>
          {error && <View style={styles.errBanner}><Text style={styles.errText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.errRetry}>Tekrar dene</Text></TouchableOpacity></View>}

          {/* KPI */}
          <View style={styles.kpiRow}>
            <Kpi label="ÇALIŞMA" value={String(kpi.total)} />
            <Kpi label="AKTİF" value={String(kpi.active)} accent={Colors.primary} />
            <Kpi label="KAZANILDI" value={String(kpi.won)} accent={Colors.success} />
            <Kpi label="ORAN" value={`%${kpi.winRate}`} accent={Colors.warning} />
            <Kpi label="BU AY" value={String(kpi.month)} accent={Colors.secondary} />
          </View>

          {runs.length > 0 && (
            <>
              {/* Arama */}
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Müşteri veya ürün ara…"
                placeholderTextColor={Colors.placeholder}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />

              {/* Durum filtre çipleri */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsRow}
                style={styles.tabsScroll}
              >
                {STATUS_TABS.map((t) => {
                  const active = statusTab === t;
                  const n = t === 'Tümü' ? runs.length : (statusCounts[t] ?? 0);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tabChip, active && styles.tabChipActive]}
                      onPress={() => setStatusTab(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t}</Text>
                      <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{n}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {runs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧮</Text>
              <Text style={styles.emptyTitle}>Henüz teklif çalışması yok</Text>
              <Text style={styles.emptySub}>“+ Yeni” ile müşteri ve ürün seçip 12 şirketten demo teklif al.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setNewOpen(true)}><Text style={styles.emptyBtnText}>Yeni Teklif Çalışması</Text></TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.noResult}>
              <Text style={styles.noResultEmoji}>🔍</Text>
              <Text style={styles.noResultText}>Sonuç bulunamadı</Text>
            </View>
          ) : (
            filtered.map((r) => {
              const m = runStatusMeta(r.status);
              const pm = productMeta(r.product_type);
              const bp = bestPrice(r.quote_results ?? []);
              const count = (r.quote_results ?? []).filter((x) => x.price != null).length;
              return (
                <TouchableOpacity key={r.id} style={styles.card} onPress={() => router.push(`/quote-run/${r.id}`)} activeOpacity={0.7}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(r.customer_name ?? '?')}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>{r.customer_name ?? 'Müşteri'}</Text>
                      <View style={styles.cardMetaRow}>
                        <View style={[styles.prodPill, { backgroundColor: pm.bg }]}>
                          <Text style={[styles.prodPillText, { color: pm.fg }]} numberOfLines={1}>{pm.emoji} {r.product_type}</Text>
                        </View>
                        <Text style={styles.cardMeta}>· {count} teklif</Text>
                      </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: m.bg }]}><Text style={[styles.badgeText, { color: m.fg }]}>{r.status}</Text></View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardDate}>{new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</Text>
                    {bp != null && <Text style={styles.cardBest}>En iyi: {formatTRY(bp)}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {newOpen && <NewQuoteModal agencyId={agencyId} onClose={() => setNewOpen(false)} onStarted={(runId) => { setNewOpen(false); load(); router.push(`/quote-run/${runId}`); }} />}
    </SafeAreaView>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ─── Yeni teklif çalışması ────────────────────────────────────────────────────
function NewQuoteModal({ agencyId, onClose, onStarted }: { agencyId: string | null; onClose: () => void; onStarted: (runId: string) => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null; identity_no: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string; phone: string; tc: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [plaka, setPlaka] = useState('');
  const [product, setProduct] = useState('');
  const [running, setRunning] = useState(false);

  async function searchCustomers(q: string) {
    setSearch(q); setSelected(null);
    if (q.length < 2) { setSuggestions([]); return; }
    let query = (supabase.from('customers') as any).select('id, name, phone, identity_no').ilike('name', `%${q}%`).limit(6);
    if (agencyId) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    setSuggestions(data ?? []);
  }

  async function start() {
    const name = mode === 'existing' ? selected?.name : newName.trim();
    if (!name) { Alert.alert('Müşteri gerekli', mode === 'existing' ? 'Müşteri seçin.' : 'Ad Soyad girin.'); return; }
    if (!product) { Alert.alert('Ürün gerekli', 'Bir ürün seçin.'); return; }
    setRunning(true);
    try {
      const runId = await startQuoteRun({
        customerId: mode === 'existing' ? selected?.id : null,
        createCustomer: mode === 'new',
        name,
        phone: mode === 'existing' ? (selected?.phone ?? '') : newPhone.trim(),
        tc: mode === 'existing' ? (selected?.tc ?? '') : '',
        plaka: plaka.trim() || undefined,
        productType: product,
      });
      onStarted(runId);
    } catch (e) {
      Alert.alert('Başarısız', e instanceof Error ? e.message : 'Teklif çalışması oluşturulamadı');
    } finally { setRunning(false); }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.hBtn} />
            <Text style={styles.hTitle}>Yeni Teklif</Text>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hAdd}>Kapat</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggle, mode === 'existing' && styles.toggleActive]} onPress={() => setMode('existing')}><Text style={[styles.toggleText, mode === 'existing' && styles.toggleTextActive]}>Mevcut Müşteri</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.toggle, mode === 'new' && styles.toggleActive]} onPress={() => setMode('new')}><Text style={[styles.toggleText, mode === 'new' && styles.toggleTextActive]}>Yeni Müşteri</Text></TouchableOpacity>
            </View>

            {mode === 'existing' ? (
              selected ? (
                <View style={styles.selectedBox}><Text style={styles.selectedText}>✅ {selected.name}</Text><TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color: Colors.danger, fontSize: 13 }}>Değiştir</Text></TouchableOpacity></View>
              ) : (
                <>
                  <TextInput style={styles.input} value={search} onChangeText={searchCustomers} placeholder="Müşteri adı ara…" placeholderTextColor={Colors.placeholder} />
                  {suggestions.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.suggestion} onPress={() => { setSelected({ id: c.id, name: c.name, phone: c.phone ?? '', tc: c.identity_no ?? '' }); setSuggestions([]); setSearch(''); }}>
                      <Text style={styles.suggestionText}>{c.name}</Text>{c.phone ? <Text style={styles.suggestionSub}>{c.phone}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </>
              )
            ) : (
              <>
                <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Ad Soyad" placeholderTextColor={Colors.placeholder} />
                <TextInput style={[styles.input, { marginTop: 8 }]} value={newPhone} onChangeText={setNewPhone} placeholder="Telefon (05...)" placeholderTextColor={Colors.placeholder} keyboardType="phone-pad" />
              </>
            )}

            <Text style={styles.sectionLabel}>ÜRÜN</Text>
            <View style={styles.prodGrid}>
              {QUOTE_PRODUCTS.map((p) => (
                <TouchableOpacity key={p} style={[styles.prodChip, product === p && styles.prodChipActive]} onPress={() => setProduct(p)} activeOpacity={0.7}>
                  <Text style={[styles.prodChipText, product === p && styles.prodChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>PLAKA / SEED (opsiyonel)</Text>
            <TextInput style={styles.input} value={plaka} onChangeText={setPlaka} placeholder="34 ABC 123 (araç ürünleri için)" placeholderTextColor={Colors.placeholder} autoCapitalize="characters" />

            <TouchableOpacity style={[styles.startBtn, running && { opacity: 0.6 }]} onPress={start} disabled={running}>
              {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>⚡ 12 Şirketten Teklif Al</Text>}
            </TouchableOpacity>
            <Text style={styles.hint}>Demo motoru: deterministik fiyatlar + gerçekçi şirket hataları (Allianz/Mapfre/Aksigorta/Sompo). Sonuçlar kaydedilir.</Text>
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

  errBanner: { backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#FECACA' },
  errText: { ...Type.caption, color: Colors.danger, lineHeight: 17 },
  errRetry: { ...Type.subhead, color: Colors.danger, marginTop: 6 },

  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md },
  kpi: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 2, alignItems: 'center', ...Shadow.sm },
  kpiValue: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  kpiLabel: { fontSize: 8, fontWeight: '700', color: Colors.secondary, letterSpacing: 0.3, marginTop: 2 },

  searchInput: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.heading, marginBottom: Spacing.sm },
  tabsScroll: { marginBottom: Spacing.md },
  tabsRow: { gap: 8, paddingRight: Spacing.sm },
  tabChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  tabChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabChipText: { ...Type.caption, fontWeight: '600', color: Colors.text },
  tabChipTextActive: { color: '#fff' },
  tabBadge: { marginLeft: 6, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radius.full, backgroundColor: Colors.background, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.secondary },
  tabBadgeTextActive: { color: '#fff' },

  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  cardName: { ...Type.subhead, fontSize: 15 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  cardMeta: { ...Type.caption },
  prodPill: { flexShrink: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  prodPillText: { fontSize: 11, fontWeight: '700' },
  badge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardDate: { ...Type.caption, color: Colors.placeholder },
  cardBest: { ...Type.subhead, fontSize: 14, color: Colors.success },

  noResult: { alignItems: 'center', paddingVertical: 40 },
  noResultEmoji: { fontSize: 32, marginBottom: 8 },
  noResultText: { ...Type.caption, color: Colors.secondary, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { ...Type.heading, textAlign: 'center' },
  emptySub: { ...Type.caption, textAlign: 'center', marginTop: 4, paddingHorizontal: 30, lineHeight: 18 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 11, marginTop: Spacing.lg },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  toggle: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { ...Type.subhead, fontSize: 13, color: Colors.text },
  toggleTextActive: { color: '#fff' },

  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, color: Colors.heading },
  suggestion: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  suggestionText: { ...Type.subhead, fontSize: 14 },
  suggestionSub: { ...Type.caption, marginTop: 2 },
  selectedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#86EFAC' },
  selectedText: { fontSize: 14, color: Colors.success, fontWeight: '600' },

  sectionLabel: { ...Type.label, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  prodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prodChip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  prodChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  prodChipText: { ...Type.caption, color: Colors.text },
  prodChipTextActive: { color: '#fff' },

  startBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: Spacing.lg },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { ...Type.caption, color: Colors.placeholder, marginTop: Spacing.md, lineHeight: 17 },
});
