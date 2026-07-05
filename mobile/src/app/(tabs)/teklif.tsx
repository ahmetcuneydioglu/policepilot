/**
 * src/app/quote-center.tsx — Teklif Merkezi (liste + KPI + yeni çalışma)
 * Demo motoru (quoteDemo) + web /api/quote-runs köprüsü. Detay: /quote-run/[id].
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { supabase } from '@/lib/supabase';
import { FEATURES } from '@/lib/features';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { formatTRY, formatShortTRY } from '@/lib/format';
import { QUOTE_PRODUCTS } from '@/lib/quoteDemo';
import { groupOf, FIELDS_BY_GROUP, FieldDef } from '@/lib/quoteFields';
import { getPersonFromTc, getVehicleFromPlaka } from '@/lib/quoteLookup';
import { listQuoteRuns, runStatusMeta, bestPrice, productMeta, QuoteRun, StartQuoteParams } from '@/lib/quoteCenter';
import { ApiError } from '@/lib/api';

const ACTIVE = ['Yeni', 'Teklif Verildi', 'Müşteri Düşünüyor'];
const STATUS_TABS = ['Tümü', 'Yeni', 'Teklif Verildi', 'Müşteri Düşünüyor', 'Kazanıldı', 'Kaybedildi', 'İptal'];

function initials(n: string) { return n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }

export default function QuoteCenterScreen() {
  const router = useRouter();
  // App Store v1.0: Teklif Merkezi kapalı — deep link/scheme ile doğrudan erişim de kilitli
  if (!FEATURES.quoteCenter) return <Redirect href="/(tabs)" />;
  const { agencyId } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const [runs, setRuns] = useState<QuoteRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('Tümü');
  const [issuedRunIds, setIssuedRunIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      setRuns(await listQuoteRuns());
      // Poliçeleştirilen teklif çalışmaları (policies.quote_run_id) listeden gizlenir — Poliçeler'de yaşar
      const { data: pol } = await (supabase.from('policies') as any).select('quote_run_id').not('quote_run_id', 'is', null);
      setIssuedRunIds(new Set((pol ?? []).map((p: any) => p.quote_run_id).filter(Boolean)));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Sunucuya bağlanılamadı — web köprüsü yayınlanmalı.' : e instanceof Error ? e.message : 'Hata');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
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

  // Poliçeleştirilenler hariç — liste/sekme/sayım tabanı
  const visibleRuns = useMemo(() => runs.filter((r) => !issuedRunIds.has(r.id)), [runs, issuedRunIds]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of visibleRuns) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [visibleRuns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleRuns.filter((r) => {
      if (statusTab !== 'Tümü' && r.status !== statusTab) return false;
      if (q) {
        const hay = `${r.customer_name ?? ''} ${r.product_type ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleRuns, query, statusTab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.hBtn} />
        <Text style={styles.hTitle}>Teklif Merkezi</Text>
        <TouchableOpacity onPress={() => setNewOpen(true)} style={styles.hBtn}><Text style={styles.hAdd}>+ Yeni</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.md }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />} showsVerticalScrollIndicator={false}>
          {error && <View style={styles.errBanner}><Text style={styles.errText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.errRetry}>Tekrar dene</Text></TouchableOpacity></View>}

          {/* KPI */}
          <View style={styles.kpiRow}>
            <Kpi label="ÇALIŞMA" value={String(kpi.total)} />
            <Kpi label="AKTİF" value={String(kpi.active)} accent={Colors.primary} />
            <Kpi label="KAZANILDI" value={String(kpi.won)} accent={Colors.success} />
            <Kpi label="ORAN" value={`%${kpi.winRate}`} accent={Colors.warning} />
            <Kpi label="BU AY" value={String(kpi.month)} accent={Colors.secondary} />
          </View>

          {visibleRuns.length > 0 && (
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
                  const n = t === 'Tümü' ? visibleRuns.length : (statusCounts[t] ?? 0);
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
          ) : visibleRuns.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📄</Text>
              <Text style={styles.emptyTitle}>Tüm teklifler poliçeleştirildi</Text>
              <Text style={styles.emptySub}>Kesilen poliçeler “Poliçeler” ekranında listelenir.</Text>
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
function NewQuoteModal({ agencyId, onClose }: { agencyId: string | null; onClose: () => void; onStarted?: (runId: string) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null; identity_no: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string; phone: string; tc: string } | null>(null);
  const [cust, setCust] = useState<Record<string, string>>({ name: '', phone: '', email: '', tc: '', dob: '', city: '', district: '' });
  const [product, setProduct] = useState('');
  const [pdata, setPdata] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [tcBusy, setTcBusy] = useState(false);
  const [plakaBusy, setPlakaBusy] = useState(false);

  const group = product ? groupOf(product) : null;
  const setCustField = (k: string, v: string) => setCust((s) => ({ ...s, [k]: v }));
  const setPField = (k: string, v: string) => setPdata((s) => ({ ...s, [k]: v }));

  async function searchCustomers(q: string) {
    setSearch(q); setSelected(null);
    if (q.length < 2) { setSuggestions([]); return; }
    let query = (supabase.from('customers') as any).select('id, name, phone, identity_no').ilike('name', `%${q}%`).limit(6);
    if (agencyId) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    setSuggestions(data ?? []);
  }

  function tcLookup() {
    const tc = cust.tc.trim();
    if (tc.length < 10) { Alert.alert('TC gerekli', 'Sorgu için en az 10 haneli TC/VKN girin.'); return; }
    setTcBusy(true);
    setTimeout(() => {
      const d = getPersonFromTc(tc);
      setCust((s) => ({ ...s, name: s.name || d.name, city: s.city || d.city, district: s.district || d.district, dob: s.dob || d.dob }));
      setTcBusy(false);
    }, 450);
  }

  function plakaLookup() {
    const pl = (pdata.plaka ?? '').replace(/\s/g, '');
    if (pl.length < 5) { Alert.alert('Plaka gerekli', 'Sorgu için geçerli bir plaka girin.'); return; }
    setPlakaBusy(true);
    setTimeout(() => {
      const v = getVehicleFromPlaka(pl);
      setPdata((s) => ({ ...s, marka: s.marka || v.marka, model: s.model || v.model, modelYili: s.modelYili || v.modelYili, kullanimTarzi: s.kullanimTarzi || v.kullanimTarzi, motorNo: s.motorNo || v.motorNo, sasiNo: s.sasiNo || v.sasiNo, tescilTarihi: s.tescilTarihi || v.tescilTarihi }));
      setPlakaBusy(false);
    }, 450);
  }

  function goNext() {
    const name = mode === 'existing' ? selected?.name : cust.name.trim();
    if (!name) { Alert.alert('Müşteri gerekli', mode === 'existing' ? 'Bir müşteri seçin.' : 'Ad Soyad girin.'); return; }
    setStep(2);
  }

  function start() {
    if (!product || !group) { Alert.alert('Ürün gerekli', 'Bir ürün seçin.'); return; }
    for (const f of FIELDS_BY_GROUP[group]) {
      if (f.required && !(pdata[f.key] ?? '').trim()) { Alert.alert(`${f.label} gerekli`, `${f.label} alanını doldurun.`); return; }
    }
    const name = mode === 'existing' ? (selected?.name ?? '') : cust.name.trim();
    const cleanData = Object.fromEntries(Object.entries(pdata).filter(([, v]) => (v ?? '').trim() !== '')) as Record<string, string>;
    const params: StartQuoteParams = {
      customerId: mode === 'existing' ? (selected?.id ?? null) : null,
      createCustomer: mode === 'new',
      name,
      phone: mode === 'existing' ? (selected?.phone ?? '') : cust.phone.trim(),
      tc: mode === 'existing' ? (selected?.tc ?? '') : cust.tc.trim(),
      email: mode === 'new' ? cust.email.trim() : '',
      productType: product,
      productData: cleanData,
      notes: notes.trim(),
    };
    onClose();
    // Canlı teklif ekranına git (async simülasyon → poll → kaydet → detay)
    router.push({ pathname: '/quote-live', params: { payload: JSON.stringify(params) } });
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            {step === 2 ? (
              <TouchableOpacity onPress={() => setStep(1)} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
            ) : <View style={styles.hBtn} />}
            <Text style={styles.hTitle}>{step === 1 ? 'Yeni Teklif · Müşteri' : 'Yeni Teklif · Ürün'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hAdd}>Kapat</Text></TouchableOpacity>
          </View>

          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepBar, step === 2 && styles.stepBarActive]} />
            <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 1 ? (
              <>
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
                    <Text style={styles.fieldLabel}>TC / VKN</Text>
                    <View style={styles.lookupRow}>
                      <TextInput style={[styles.input, { flex: 1 }]} value={cust.tc} onChangeText={(v) => setCustField('tc', v)} placeholder="11 haneli TC veya VKN" placeholderTextColor={Colors.placeholder} keyboardType="numeric" />
                      <TouchableOpacity style={styles.lookupBtn} onPress={tcLookup} disabled={tcBusy}>{tcBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.lookupBtnText}>Sorgula</Text>}</TouchableOpacity>
                    </View>
                    <LabeledInput label="Ad Soyad *" value={cust.name} onChange={(v) => setCustField('name', v)} placeholder="Ad Soyad" />
                    <LabeledInput label="Telefon" value={cust.phone} onChange={(v) => setCustField('phone', v)} placeholder="05..." keyboardType="phone-pad" />
                    <LabeledInput label="E-posta" value={cust.email} onChange={(v) => setCustField('email', v)} placeholder="ornek@eposta.com" keyboardType="email-address" />
                    <LabeledInput label="Doğum Tarihi" value={cust.dob} onChange={(v) => setCustField('dob', v)} placeholder="GG.AA.YYYY" />
                    <LabeledInput label="İl" value={cust.city} onChange={(v) => setCustField('city', v)} placeholder="İSTANBUL" autoCap />
                    <LabeledInput label="İlçe" value={cust.district} onChange={(v) => setCustField('district', v)} placeholder="KADIKÖY" autoCap />
                  </>
                )}

                <TouchableOpacity style={styles.startBtn} onPress={goNext}><Text style={styles.startBtnText}>Devam →</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>ÜRÜN</Text>
                <View style={styles.prodGrid}>
                  {QUOTE_PRODUCTS.map((p) => (
                    <TouchableOpacity key={p} style={[styles.prodChip, product === p && styles.prodChipActive]} onPress={() => setProduct(p)} activeOpacity={0.7}>
                      <Text style={[styles.prodChipText, product === p && styles.prodChipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {group && (
                  <>
                    <Text style={styles.sectionLabel}>{product.toUpperCase()} BİLGİLERİ</Text>
                    {FIELDS_BY_GROUP[group].length === 0 && <Text style={styles.hint}>Bu ürün için ek bilgi gerekmiyor.</Text>}
                    {FIELDS_BY_GROUP[group].map((f) => (
                      f.key === 'plaka' ? (
                        <View key="plaka">
                          <Text style={styles.fieldLabel}>{f.label} *</Text>
                          <View style={styles.lookupRow}>
                            <TextInput style={[styles.input, { flex: 1 }]} value={pdata.plaka ?? ''} onChangeText={(v) => setPField('plaka', v)} placeholder={f.placeholder} placeholderTextColor={Colors.placeholder} autoCapitalize="characters" />
                            <TouchableOpacity style={styles.lookupBtn} onPress={plakaLookup} disabled={plakaBusy}>{plakaBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.lookupBtnText}>Sorgula</Text>}</TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <DynField key={f.key} def={f} value={pdata[f.key] ?? ''} onChange={(v) => setPField(f.key, v)} />
                      )
                    ))}

                    <Text style={styles.sectionLabel}>NOTLAR</Text>
                    <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} placeholder="Opsiyonel not…" placeholderTextColor={Colors.placeholder} multiline />

                    <TouchableOpacity style={[styles.startBtn, running && { opacity: 0.6 }]} onPress={start} disabled={running}>
                      {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>⚡ 12 Şirketten Teklif Al</Text>}
                    </TouchableOpacity>
                    <Text style={styles.hint}>Demo motoru: deterministik fiyatlar + gerçekçi şirket hataları (Allianz/Mapfre/Aksigorta/Sompo). Sonuçlar kaydedilir.</Text>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Etiketli input + dinamik alan ────────────────────────────────────────────
function LabeledInput({ label, value, onChange, placeholder, keyboardType, autoCap }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address'; autoCap?: boolean }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.placeholder} keyboardType={keyboardType ?? 'default'} autoCapitalize={autoCap ? 'characters' : 'none'} />
    </View>
  );
}

function DynField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.fieldLabel}>{def.label}{def.required ? ' *' : ''}</Text>
      {def.type === 'select' ? (
        <View style={styles.segRow}>
          {(def.options ?? []).map((o) => (
            <TouchableOpacity key={o} style={[styles.segChip, value === o && styles.segChipActive]} onPress={() => onChange(o)} activeOpacity={0.7}>
              <Text style={[styles.segChipText, value === o && styles.segChipTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={def.placeholder} placeholderTextColor={Colors.placeholder} keyboardType={def.type === 'number' ? 'numeric' : 'default'} autoCapitalize={def.autoCap ? 'characters' : 'none'} />
      )}
    </View>
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

  // Çok adımlı yeni-teklif formu
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary },
  stepBar: { width: 40, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  stepBarActive: { backgroundColor: Colors.primary },
  fieldLabel: { ...Type.caption, color: Colors.secondary, fontWeight: '700', marginBottom: 5 },
  lookupRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lookupBtn: { backgroundColor: Colors.heading, borderRadius: Radius.md, paddingHorizontal: 16, height: 46, alignItems: 'center', justifyContent: 'center' },
  lookupBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  segRow: { flexDirection: 'row', gap: 8 },
  segChip: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 11 },
  segChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segChipText: { ...Type.subhead, fontSize: 13, color: Colors.text },
  segChipTextActive: { color: '#fff' },
  notesInput: { minHeight: 70, paddingTop: 12, textAlignVertical: 'top' },
});
