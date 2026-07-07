/**
 * src/app/portfoy.tsx — PORTFÖY · Satış Hattı (route: /portfoy)
 * ─────────────────────────────────────────────────────────────────────────────
 * Uzun satış döngüsü (Hayat, BES, kurumsal) — saha aracı. Mobilde Kanban değil,
 * aşama filtreli liste: hastane çıkışında 30 saniyede görüşme kaydet, aşamayı çek.
 * Poliçeleşti + Hayat → LifePolicySheet kapanış adımı olarak açılır.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { useCachedQuery } from '@/lib/query';
import { tapHaptic, successHaptic, errorHaptic, warningHaptic } from '@/lib/haptics';
import AddInteractionSheet from '@/components/AddInteractionSheet';
import LifePolicySheet from '@/components/LifePolicySheet';
import { channelMeta, outcomeLabel, fetchInteractions, Interaction } from '@/lib/relationship';
import {
  DEAL_STAGES, dealStageOf, PORTFOLIO_PRODUCTS, DEAL_SOURCES, LOST_REASONS,
  ACCOUNT_KINDS, STALE_WARN_DAYS, STALE_DANGER_DAYS, daysSinceTouch, lostReasonLabel,
  fetchDeals, fetchAccounts, addDeal, updateDealStage, markDealLost, reopenDeal,
  Deal, DealStageKey,
} from '@/lib/portfolio';

function fmtMoney(n: number) {
  return `₺${n.toLocaleString('tr-TR')}`;
}
function relDay(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d === 0 ? 'bugün' : `${d}g önce`;
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */
function Chip({ on, label, color, onPress }: { on: boolean; label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && { backgroundColor: color ?? Colors.primary, borderColor: color ?? Colors.primary }]}
      onPress={() => { tapHaptic(); onPress(); }}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Bayat iş rozeti ──────────────────────────────────────────────────────── */
function TouchBadge({ deal }: { deal: Deal }) {
  const d = daysSinceTouch(deal);
  if (deal.stage === 'policelesti' || deal.stage === 'referans_kazanildi') return null;
  if (d < STALE_WARN_DAYS) return <Text style={styles.touchOk}>{d === 0 ? 'bugün' : `${d}g`}</Text>;
  const danger = d >= STALE_DANGER_DAYS;
  return (
    <View style={[styles.touchBadge, { backgroundColor: danger ? Colors.dangerBg : Colors.warningBg }]}>
      <Text style={[styles.touchBadgeText, { color: danger ? Colors.danger : '#D97706' }]}>⏳ {d}g</Text>
    </View>
  );
}

/* ── İş kartı ─────────────────────────────────────────────────────────────── */
function DealCard({ deal, onPress }: { deal: Deal; onPress: () => void }) {
  const st = dealStageOf(deal.stage);
  const lost = deal.status === 'lost';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{deal.customers?.name ?? deal.title}</Text>
        <View style={[styles.stageBadge, { backgroundColor: lost ? Colors.dangerBg : `${st.color}1A` }]}>
          <View style={[styles.stageDot, { backgroundColor: lost ? Colors.danger : st.color }]} />
          <Text style={[styles.stageBadgeText, { color: lost ? Colors.danger : st.color }]}>
            {lost ? 'Kaybedildi' : st.label}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSub} numberOfLines={1}>
        {deal.product_interest}
        {deal.expected_premium != null ? ` · ${fmtMoney(deal.expected_premium)}` : ''}
        {deal.accounts ? ` · ${ACCOUNT_KINDS[deal.accounts.kind]?.emoji ?? '🏢'} ${deal.accounts.name}` : ''}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardOwner} numberOfLines={1}>👤 {deal.owner_name ?? 'Atanmadı'}</Text>
        {!lost && <TouchBadge deal={deal} />}
      </View>
    </TouchableOpacity>
  );
}

/* ── Ana ekran ────────────────────────────────────────────────────────────── */
export default function PortfolioScreen() {
  const router = useRouter();
  const { agencyId, role, userId, profile } = useProfile();

  const { data: deals, loading, refreshing, onRefresh, refetch } = useCachedQuery(
    ['deals', agencyId], () => fetchDeals(agencyId, role)
  );

  const [filter, setFilter] = useState<'all' | 'lost' | DealStageKey>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lifeFor, setLifeFor] = useState<{ id: string; name: string } | null>(null);

  const list = useMemo(() => {
    const all = deals ?? [];
    if (filter === 'lost') return all.filter((d) => d.status === 'lost');
    const open = all.filter((d) => d.status === 'open');
    return filter === 'all' ? open : open.filter((d) => d.stage === filter);
  }, [deals, filter]);

  const openCount = (deals ?? []).filter((d) => d.status === 'open').length;
  const openDeal = openId ? (deals ?? []).find((d) => d.id === openId) ?? null : null;

  const countFor = useCallback((key: 'all' | 'lost' | DealStageKey) => {
    const all = deals ?? [];
    if (key === 'all') return all.filter((d) => d.status === 'open').length;
    if (key === 'lost') return all.filter((d) => d.status === 'lost').length;
    return all.filter((d) => d.status === 'open' && d.stage === key).length;
  }, [deals]);

  // Poliçeleşti + Hayat → LifePolicySheet kapanış adımı
  const maybeOfferLifeSheet = useCallback((deal: Deal, newStage: DealStageKey) => {
    if (newStage !== 'policelesti') return;
    if (deal.product_interest !== 'Hayat' || !deal.customer_id || !agencyId) return;
    const name = deal.customers?.name ?? deal.title;
    setTimeout(() => {
      Alert.alert('🎉 Poliçeleşti', `${name} için Hayat poliçesi ve prim takvimini şimdi oluşturmak ister misin?`, [
        { text: 'Sonra', style: 'cancel' },
        { text: 'Poliçeyi Oluştur', onPress: () => setLifeFor({ id: deal.customer_id!, name }) },
      ]);
    }, 350);
  }, [agencyId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}>
          <Text style={styles.hBack}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.hTitle}>Satış Hattı</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)} style={[styles.hBtn, { alignItems: 'flex-end' }]}>
          <Text style={styles.hAdd}>+ İş</Text>
        </TouchableOpacity>
      </View>

      {/* Aşama filtresi */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip on={filter === 'all'} label={`Tümü (${countFor('all')})`} onPress={() => setFilter('all')} />
          {DEAL_STAGES.map((s) => (
            <Chip key={s.key} on={filter === s.key} color={s.color}
              label={`${s.label} (${countFor(s.key)})`} onPress={() => setFilter(filter === s.key ? 'all' : s.key)} />
          ))}
          <Chip on={filter === 'lost'} color={Colors.danger} label={`Kaybedilen (${countFor('lost')})`} onPress={() => setFilter(filter === 'lost' ? 'all' : 'lost')} />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => <DealCard deal={item} onPress={() => setOpenId(item.id)} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>{filter === 'lost' ? '🎉' : '🧭'}</Text>
              <Text style={styles.emptyText}>
                {filter === 'lost'
                  ? 'Kaybedilen iş yok'
                  : openCount === 0
                    ? 'Satış Hattı boş — ilk işini aç:\nHayat, BES veya kurumsal bir görüşmeyi Lead olarak ekle.'
                    : 'Bu aşamada iş yok'}
              </Text>
            </View>
          }
        />
      )}

      {/* Yeni iş */}
      {addOpen && agencyId && (
        <AddDealSheet
          agencyId={agencyId}
          ownerId={userId ?? null}
          ownerName={profile?.full_name ?? null}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); refetch(); }}
        />
      )}

      {/* İş detayı */}
      {openDeal && (
        <DealDetailSheet
          deal={openDeal}
          agencyId={agencyId}
          userId={userId ?? null}
          staffName={profile?.full_name ?? null}
          onClose={() => setOpenId(null)}
          onChanged={refetch}
          onStageChanged={maybeOfferLifeSheet}
          onOpenCustomer={(id) => { setOpenId(null); router.push(`/customer/${id}`); }}
        />
      )}

      {/* Poliçeleşti kapanışı: Hayat poliçesi + prim takvimi */}
      {lifeFor && agencyId && (
        <LifePolicySheet
          customerId={lifeFor.id}
          customerName={lifeFor.name}
          agencyId={agencyId}
          onClose={() => setLifeFor(null)}
          onSaved={() => { setLifeFor(null); refetch(); }}
        />
      )}
    </SafeAreaView>
  );
}

/* ── İş detayı sheet ──────────────────────────────────────────────────────── */
function DealDetailSheet({
  deal, agencyId, userId, staffName, onClose, onChanged, onStageChanged, onOpenCustomer,
}: {
  deal: Deal;
  agencyId: string | null;
  userId: string | null;
  staffName: string | null;
  onClose: () => void;
  onChanged: () => void;
  onStageChanged: (deal: Deal, stage: DealStageKey) => void;
  onOpenCustomer: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const { data: feed, refetch: refetchFeed } = useCachedQuery(
    ['deal-feed', deal.id],
    async () => {
      if (!deal.customer_id) return [] as Interaction[];
      const all = await fetchInteractions(deal.customer_id);
      return all.filter((i) => i.deal_id === deal.id).slice(0, 10);
    }
  );

  const st = dealStageOf(deal.stage);
  const lost = deal.status === 'lost';
  const stale = daysSinceTouch(deal);

  async function setStage(stage: DealStageKey) {
    if (saving || stage === deal.stage) return;
    setSaving(true);
    const { error } = await updateDealStage(deal.id, stage, userId);
    setSaving(false);
    if (error) { errorHaptic(); Alert.alert('Güncellenemedi', error); return; }
    successHaptic();
    onChanged();
    onStageChanged(deal, stage);
  }

  function askLost() {
    warningHaptic();
    Alert.alert('Kaybedildi olarak kapat', 'Kayıp nedeni?', [
      ...LOST_REASONS.map((r) => ({
        text: r.label,
        onPress: async () => {
          const { error } = await markDealLost(deal.id, r.key, userId);
          if (error) { errorHaptic(); Alert.alert('Kapatılamadı', error); return; }
          onChanged();
        },
      })),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  }

  async function reopen() {
    const { error } = await reopenDeal(deal.id, userId);
    if (error) { errorHaptic(); Alert.alert('Açılamadı', error); return; }
    successHaptic();
    onChanged();
  }

  const phone = deal.customers?.phone ?? null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}>
            <Text style={styles.hBack}>Kapat</Text>
          </TouchableOpacity>
          <Text style={styles.hTitle} numberOfLines={1}>{deal.customers?.name ?? deal.title}</Text>
          <View style={styles.hBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          {/* Durum banner'ları */}
          {lost && (
            <View style={[styles.banner, { backgroundColor: Colors.dangerBg }]}>
              <Text style={[styles.bannerText, { color: Colors.danger }]}>
                Kaybedildi{deal.lost_reason ? ` · ${lostReasonLabel(deal.lost_reason)}` : ''}
              </Text>
              <TouchableOpacity onPress={reopen}><Text style={styles.bannerAction}>Geri Aç</Text></TouchableOpacity>
            </View>
          )}
          {!lost && stale >= STALE_WARN_DAYS && deal.stage !== 'policelesti' && deal.stage !== 'referans_kazanildi' && (
            <View style={[styles.banner, { backgroundColor: stale >= STALE_DANGER_DAYS ? Colors.dangerBg : Colors.warningBg }]}>
              <Text style={[styles.bannerText, { color: stale >= STALE_DANGER_DAYS ? Colors.danger : '#D97706' }]}>
                ⏳ Son temastan bu yana {stale} gün geçti
              </Text>
            </View>
          )}

          {/* Özet */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>İŞ</Text>
            <Text style={styles.dealTitle}>{deal.title}</Text>
            <Text style={styles.dealMeta}>
              {deal.product_interest}
              {deal.expected_premium != null ? ` · ${fmtMoney(deal.expected_premium)}` : ''}
              {deal.source ? ` · ${deal.source}` : ''}
            </Text>
            {deal.accounts && (
              <Text style={styles.dealMeta}>
                {ACCOUNT_KINDS[deal.accounts.kind]?.emoji ?? '🏢'} {deal.accounts.name}
              </Text>
            )}
            {deal.note ? <Text style={styles.dealNote}>{deal.note}</Text> : null}
          </View>

          {/* Aşama */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AŞAMA {saving ? '· kaydediliyor…' : ''}</Text>
            <View style={styles.chipWrap}>
              {DEAL_STAGES.map((s) => (
                <Chip key={s.key} on={deal.stage === s.key} color={s.color} label={s.label}
                  onPress={() => { if (!lost) setStage(s.key); }} />
              ))}
            </View>
            {!lost && (
              <TouchableOpacity style={styles.lostBtn} onPress={askLost} activeOpacity={0.7}>
                <Text style={styles.lostBtnText}>✕ Kaybedildi olarak kapat</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Kişi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>KİŞİ</Text>
            {deal.customers ? (
              <>
                <TouchableOpacity onPress={() => onOpenCustomer(deal.customers!.id)} activeOpacity={0.7}>
                  <Text style={styles.customerLink}>
                    🤝 {deal.customers.name}{deal.customers.title ? ` · ${deal.customers.title}` : ''}  ›
                  </Text>
                </TouchableOpacity>
                {phone && (
                  <View style={styles.contactRow}>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
                      <Text style={styles.contactBtnText}>📞 Ara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.contactBtn, { backgroundColor: Colors.successBg }]}
                      onPress={() => Linking.openURL(`whatsapp://send?phone=${phone.replace(/\D/g, '').replace(/^0/, '90')}`)}>
                      <Text style={[styles.contactBtnText, { color: Colors.success }]}>💬 WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.dealMeta}>Kişi bağlanmamış</Text>
            )}
          </View>

          {/* Görüşmeler */}
          <View style={styles.section}>
            <View style={styles.feedHeader}>
              <Text style={styles.sectionLabel}>BU İŞİN GÖRÜŞMELERİ</Text>
              <Text style={styles.dealMeta}>👤 {deal.owner_name ?? 'Atanmadı'}</Text>
            </View>
            {(feed ?? []).length === 0 ? (
              <Text style={styles.dealMeta}>Bu işe bağlı görüşme yok — aşağıdan ekle.</Text>
            ) : (
              (feed ?? []).map((it) => {
                const ch = channelMeta(it.channel);
                const oc = outcomeLabel(it.outcome);
                return (
                  <View key={it.id} style={styles.feedRow}>
                    <Text style={styles.feedEmoji}>{ch.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedText}>
                        <Text style={{ fontWeight: '700' }}>{ch.label}</Text>
                        {it.staff_name ? ` · ${it.staff_name}` : ''}{oc ? ` · ${oc}` : ''}
                      </Text>
                      {it.note ? <Text style={styles.feedNote} numberOfLines={2}>{it.note}</Text> : null}
                      <Text style={styles.feedTime}>{relDay(it.occurred_at)}</Text>
                    </View>
                  </View>
                );
              })
            )}
            {deal.customer_id && agencyId && (
              <TouchableOpacity style={styles.addInteractionBtn} onPress={() => setInteractionOpen(true)} activeOpacity={0.85}>
                <Text style={styles.addInteractionText}>🤝 Görüşme Ekle</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footNote}>
            Açılış {new Date(deal.created_at).toLocaleDateString('tr-TR')}
            {deal.closed_at ? ` · Kapanış ${new Date(deal.closed_at).toLocaleDateString('tr-TR')}` : ''}
          </Text>
        </ScrollView>

        {interactionOpen && deal.customer_id && agencyId && (
          <AddInteractionSheet
            customerId={deal.customer_id}
            agencyId={agencyId}
            staffId={userId}
            staffName={staffName}
            dealId={deal.id}
            initialProduct={PORTFOLIO_PRODUCTS.includes(deal.product_interest as any) ? deal.product_interest : undefined}
            initialChannel="face_to_face"
            onClose={() => setInteractionOpen(false)}
            onSaved={() => { setInteractionOpen(false); refetchFeed(); onChanged(); }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ── Yeni iş sheet ────────────────────────────────────────────────────────── */
function AddDealSheet({
  agencyId, ownerId, ownerName, onClose, onSaved,
}: {
  agencyId: string;
  ownerId: string | null;
  ownerName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [product, setProduct] = useState<string>('Hayat');
  const [title, setTitle] = useState('');
  const [premium, setPremium] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Kişi seçimi (zorunlu — ilişki akışı kişiye bağlanır)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  // Hesap seçimi (opsiyonel)
  const { data: accounts } = useCachedQuery(['accounts', agencyId], () => fetchAccounts(agencyId, 'agency_user'));
  const [accountId, setAccountId] = useState<string | null>(null);

  const searchCustomers = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await (supabase.from('customers') as any)
      .select('id, name, phone')
      .eq('agency_id', agencyId)
      .ilike('name', `%${q.trim()}%`)
      .order('name')
      .limit(6);
    setResults(data ?? []);
  }, [agencyId]);

  async function save() {
    if (!selected) { setError('Kişi seç — Satış Hattı ilişki üzerinden ilerler.'); return; }
    setSaving(true);
    setError('');
    const premiumNum = premium.trim() ? parseFloat(premium.replace(/\./g, '').replace(',', '.')) : NaN;
    const { error: err } = await addDeal({
      agency_id: agencyId,
      customer_id: selected.id,
      account_id: accountId,
      title: title.trim() || `${selected.name} — ${product}`,
      product_interest: product,
      owner_id: ownerId,
      owner_name: ownerName,
      expected_premium: Number.isFinite(premiumNum) ? premiumNum : null,
      source,
      note: note.trim() || null,
    });
    setSaving(false);
    if (err) { errorHaptic(); setError('Kaydedilemedi: ' + err); return; }
    successHaptic();
    onSaved();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}>
            <Text style={styles.hBack}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={styles.hTitle}>Yeni İş</Text>
          <View style={styles.hBtn} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={[styles.banner, { backgroundColor: Colors.dangerBg }]}>
                <Text style={[styles.bannerText, { color: Colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>ÜRÜN</Text>
            <View style={styles.chipWrap}>
              {PORTFOLIO_PRODUCTS.map((p) => (
                <Chip key={p} on={product === p} label={p} onPress={() => setProduct(p)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>KİŞİ *</Text>
            {selected ? (
              <View style={styles.selectedRow}>
                <Text style={styles.selectedText}>✓ {selected.name}</Text>
                <TouchableOpacity onPress={() => { setSelected(null); setQuery(''); setResults([]); }}>
                  <Text style={styles.selectedChange}>Değiştir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={searchCustomers}
                  placeholder="Müşteri adı ara… (en az 2 harf)"
                  placeholderTextColor={Colors.placeholder}
                />
                {results.map((r) => (
                  <TouchableOpacity key={r.id} style={styles.resultRow}
                    onPress={() => { tapHaptic(); setSelected({ id: r.id, name: r.name }); setResults([]); }}>
                    <Text style={styles.resultName}>{r.name}</Text>
                    {r.phone ? <Text style={styles.resultPhone}>{r.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
                {query.trim().length >= 2 && results.length === 0 && (
                  <Text style={styles.dealMeta}>Eşleşen müşteri yok — önce Müşteriler&apos;den ekle.</Text>
                )}
              </>
            )}

            {(accounts ?? []).length > 0 && (
              <>
                <Text style={styles.fieldLabel}>BAĞLI HESAP (OPSİYONEL)</Text>
                <View style={styles.chipWrap}>
                  {(accounts ?? []).map((a) => (
                    <Chip key={a.id} on={accountId === a.id}
                      label={`${ACCOUNT_KINDS[a.kind]?.emoji ?? '🏢'} ${a.name}`}
                      onPress={() => setAccountId(accountId === a.id ? null : a.id)} />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>İŞ BAŞLIĞI</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder={selected ? `${selected.name} — ${product}` : 'Örn: Dr. Kaya — Hayat'}
              placeholderTextColor={Colors.placeholder} />

            <Text style={styles.fieldLabel}>BEKLENEN PRİM (₺)</Text>
            <TextInput style={styles.input} value={premium} onChangeText={setPremium}
              placeholder="25.000" placeholderTextColor={Colors.placeholder} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>KAYNAK</Text>
            <View style={styles.chipWrap}>
              {DEAL_SOURCES.map((s) => (
                <Chip key={s} on={source === s} label={s} onPress={() => setSource(source === s ? null : s)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>NOT</Text>
            <TextInput style={[styles.input, styles.noteInput]} value={note} onChangeText={setNote}
              placeholder="İlk izlenim, tanışma bağlamı…" placeholderTextColor={Colors.placeholder} multiline />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>İşi Aç</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hBtn: { minWidth: 64 },
  hBack: { ...Type.subhead, color: Colors.secondary },
  hTitle: { ...Type.heading, fontSize: 16, flex: 1, textAlign: 'center' },
  hAdd: { ...Type.subhead, color: Colors.primary, fontWeight: '800' },

  filterWrap: { backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 7, flexDirection: 'row' },

  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    marginRight: 0,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  listContent: { padding: Spacing.lg, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.secondary, textAlign: 'center', lineHeight: 21 },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: 10, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.heading, flex: 1 },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4,
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stageBadgeText: { fontSize: 10, fontWeight: '800' },
  cardSub: { fontSize: 12, color: Colors.secondary, marginTop: 4 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardOwner: { fontSize: 11, color: Colors.secondary, flex: 1 },
  touchOk: { fontSize: 11, color: Colors.placeholder },
  touchBadge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  touchBadgeText: { fontSize: 10, fontWeight: '800' },

  detailContent: { padding: Spacing.lg, paddingBottom: 48 },
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, marginBottom: Spacing.md,
  },
  bannerText: { fontSize: 13, fontWeight: '700', flex: 1 },
  bannerAction: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginLeft: 10 },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  sectionLabel: { ...Type.label, marginBottom: 8 },
  dealTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  dealMeta: { fontSize: 13, color: Colors.secondary, marginTop: 3 },
  dealNote: { fontSize: 13, color: Colors.text, marginTop: 8, lineHeight: 19 },

  lostBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.md, backgroundColor: Colors.background },
  lostBtnText: { fontSize: 12, fontWeight: '700', color: Colors.danger },

  customerLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  contactBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: Radius.md, backgroundColor: Colors.primaryLight,
  },
  contactBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  feedEmoji: { fontSize: 15, marginTop: 1 },
  feedText: { fontSize: 12.5, color: Colors.text },
  feedNote: { fontSize: 12, color: Colors.secondary, marginTop: 1 },
  feedTime: { fontSize: 10.5, color: Colors.placeholder, marginTop: 2 },
  addInteractionBtn: {
    marginTop: 14, alignItems: 'center', paddingVertical: 12,
    borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  addInteractionText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  footNote: { ...Type.caption, textAlign: 'center', color: Colors.placeholder, marginTop: 4 },

  fieldLabel: { ...Type.label, marginTop: Spacing.md, marginBottom: 8 },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: Colors.heading,
  },
  noteInput: { minHeight: 68, textAlignVertical: 'top' },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  selectedText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  selectedChange: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 6,
  },
  resultName: { fontSize: 13.5, fontWeight: '600', color: Colors.heading },
  resultPhone: { fontSize: 12, color: Colors.secondary },
  saveBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
