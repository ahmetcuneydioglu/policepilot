import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Alert, TextInput, RefreshControl, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow, Dark, renewalUrgency } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { formatTRY } from '@/lib/format';
import { daysUntil } from '@/lib/renewals';
import { stageOf } from '@/lib/opportunities';
import {
  fetchCustomerBundle, buildTimeline, upcomingRenewals,
  CustomerBundle, TimelineEvent,
} from '@/lib/customer';
import { apiGet } from '@/lib/api';
import DocumentSection from '@/components/DocumentSection';
import DarkHero, { heroGlass } from '@/components/DarkHero';
import Icon from '@/components/Icon';
import { tapHaptic } from '@/lib/haptics';
import AddInteractionSheet from '@/components/AddInteractionSheet';
import {
  fetchInteractions, updateCustomerTags, channelMeta, outcomeLabel, locationLabel,
  nextActionMeta, AUTO_SOURCE_META, CUSTOMER_TAGS, Interaction,
} from '@/lib/relationship';

type WaMsg = { id: string; phone: string; message: string; status: string; created_at: string };

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function waNumber(phone: string) {
  const c = (phone ?? '').replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c;
}
/** Yerel saat diliminde YYYY-MM-DD (toISOString UTC kayması yapar). */
function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId, agencyId: myAgencyId, profile } = useProfile();

  const [bundle, setBundle] = useState<CustomerBundle | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [muayeneDate, setMuayeneDate] = useState('');
  const [savingMuayene, setSavingMuayene] = useState(false);
  const [showMuayenePicker, setShowMuayenePicker] = useState(false); // Android dialog
  const [waMsgs, setWaMsgs] = useState<WaMsg[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [b, ints] = await Promise.all([fetchCustomerBundle(id), fetchInteractions(id)]);
    setBundle(b);
    setTimeline(buildTimeline(b));
    setInteractions(ints);
    setTags(((b.customer as unknown as { tags?: string[] })?.tags) ?? []);
    setNote(b.customer?.note ?? '');
    setMuayeneDate(b.customer?.muayene_bitis ?? '');
    setLoading(false);
    // WhatsApp geçmişi — arka planda (manager-uyumlu; yetkisizde boş döner)
    const last10 = (b.customer?.phone ?? '').replace(/\D/g, '').slice(-10);
    if (last10) {
      try {
        const res = await apiGet<{ items: WaMsg[] }>('/api/whatsapp/queue?limit=200');
        setWaMsgs((res.items ?? []).filter((m) => (m.phone ?? '').replace(/\D/g, '').slice(-10) === last10));
      } catch { /* sessiz — yetki yoksa boş */ }
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  async function saveNote() {
    if (!id) return;
    setSavingNote(true);
    await (supabase.from('customers') as any).update({ note }).eq('id', id);
    setSavingNote(false);
  }

  async function saveMuayene() {
    if (!id) return;
    const v = muayeneDate.trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return Alert.alert('Geçersiz tarih', 'Tarihi YYYY-AA-GG biçiminde girin (ör. 2026-12-31).');
    }
    setSavingMuayene(true);
    await (supabase.from('customers') as any).update({ muayene_bitis: v || null, muayene_tahmini: false }).eq('id', id);
    setSavingMuayene(false);
    await load();
  }

  function remove() {
    Alert.alert('Müşteriyi Sil', 'Bu müşteri ve ilişkili kayıt bağlantıları silinecek. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          await (supabase.from('customers') as any).delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const c = bundle?.customer;
  if (!c) {
    return (
      <View style={styles.safe}>
        <DarkHero title="Müşteri" onBack={() => router.back()} />
        <View style={styles.center}><Text style={styles.muted}>Müşteri bulunamadı.</Text></View>
      </View>
    );
  }

  const policies = bundle!.policies;
  const requests = bundle!.requests;
  const activePolicies = policies.filter((p) => p.status === 'Aktif');
  const renewals = upcomingRenewals(policies);
  const openReqs = requests.filter((r) => r.status !== 'Kazanıldı' && r.status !== 'Kaybedildi');
  const taskRows = [
    ...renewals.map((p) => {
      const u = renewalUrgency(p.end_date ? daysUntil(p.end_date) : 0);
      return { id: 'rn-' + p.id, icon: '🔄', title: `${p.policy_type} yenileme`, sub: p.end_date ? `Bitiş ${fmtDate(p.end_date)}` : '', badge: u };
    }),
    ...requests.filter((r) => r.next_follow_up_date).map((r) => {
      const u = renewalUrgency(daysUntil(r.next_follow_up_date as string));
      return { id: 'fu-' + r.id, icon: '📞', title: `${r.request_type} takip`, sub: `Takip: ${fmtDate(r.next_follow_up_date as string)}`, badge: u };
    }),
  ];
  // ── IRM: birleşik ilişki akışı (manuel görüşmeler + sistem olayları) ─────────
  const feed: TimelineEvent[] = [
    ...interactions.map((it): TimelineEvent => {
      if (it.kind === 'auto') {
        const m = AUTO_SOURCE_META[it.auto_source ?? ''] ?? { label: 'Sistem olayı', emoji: '•' };
        return { id: 'int-' + it.id, icon: m.emoji, title: m.label, subtitle: it.note ?? '', date: it.occurred_at };
      }
      const ch = channelMeta(it.channel);
      const bits = [
        outcomeLabel(it.outcome),
        it.location ? '📍 ' + (locationLabel(it.location) ?? '') + (it.location_note ? ' · ' + it.location_note : '') : null,
        it.note,
        it.next_action ? '→ ' + (nextActionMeta(it.next_action)?.label ?? '') : null,
      ].filter(Boolean);
      return {
        id: 'int-' + it.id,
        icon: ch.emoji,
        title: `${it.staff_name ?? 'Personel'} · ${ch.label}${it.product ? ' · ' + it.product : ''}`,
        subtitle: bits.join(' · '),
        date: it.occurred_at,
      };
    }),
    ...timeline,
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  async function toggleTag(key: string) {
    tapHaptic();
    const next = tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key];
    setTags(next); // optimistic
    await updateCustomerTags(c!.id, next);
  }

  const extra = c.extra_data ? Object.entries(c.extra_data).filter(([, v]) => v) : [];

  return (
    <View style={styles.safe}>
      <DarkHero
        title={c.name}
        subtitle={c.insurance_type || 'Müşteri'}
        onBack={() => router.back()}
        right={
          <TouchableOpacity style={[styles.heroDelete, heroGlass]} onPress={remove} activeOpacity={0.7}>
            <Icon symbol="trash.fill" emoji="🗑️" size={15} color="#FCA5A5" />
          </TouchableOpacity>
        }
      >
        {/* Hızlı aksiyonlar */}
        <View style={styles.heroActions}>
          {!!c.phone && (
            <TouchableOpacity
              style={[styles.heroActionBtn, heroGlass]}
              onPress={() => { tapHaptic(); Linking.openURL(`tel:${c.phone}`); }}
              activeOpacity={0.8}
            >
              <Icon symbol="phone.fill" emoji="📞" size={15} color="#fff" />
              <Text style={styles.heroActionText}>Ara</Text>
            </TouchableOpacity>
          )}
          {!!c.phone && (
            <TouchableOpacity
              style={[styles.heroActionBtn, styles.heroActionWA]}
              onPress={() => { tapHaptic(); Linking.openURL(`whatsapp://send?phone=${waNumber(c.phone)}`); }}
              activeOpacity={0.8}
            >
              <Icon symbol="message.fill" emoji="💬" size={15} color="#fff" />
              <Text style={styles.heroActionText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.heroActionBtn, heroGlass]}
            onPress={() => { tapHaptic(); setSheetOpen(true); }}
            activeOpacity={0.8}
          >
            <Icon symbol="plus.bubble.fill" emoji="📝" size={15} color="#fff" />
            <Text style={styles.heroActionText}>Görüşme</Text>
          </TouchableOpacity>
        </View>

        {/* İstatistik pill'leri */}
        <View style={styles.heroStats}>
          <View style={[styles.heroStat, heroGlass]}>
            <Text style={styles.heroStatValue}>{activePolicies.length}</Text>
            <Text style={styles.heroStatLabel}>Aktif Poliçe</Text>
          </View>
          <View style={[styles.heroStat, heroGlass]}>
            <Text style={styles.heroStatValue}>{openReqs.length}</Text>
            <Text style={styles.heroStatLabel}>Açık Fırsat</Text>
          </View>
          <View style={[styles.heroStat, heroGlass]}>
            <Text style={[styles.heroStatValue, renewals.length > 0 && { color: '#FCA5A5' }]}>{renewals.length}</Text>
            <Text style={styles.heroStatLabel}>Yaklaşan</Text>
          </View>
        </View>

        {/* Müşteri analizi etiketleri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll} contentContainerStyle={styles.tagRow}>
          {CUSTOMER_TAGS.map((t) => {
            const on = tags.includes(t.key);
            return (
              <TouchableOpacity key={t.key} style={[styles.tagChip, heroGlass, on && styles.tagChipOn]} onPress={() => toggleTag(t.key)} activeOpacity={0.7}>
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{t.emoji} {t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </DarkHero>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Künye */}
        <View style={styles.card}>
          {!!c.phone && <InfoRow label="Telefon" value={c.phone} />}
          {!!c.identity_no && <InfoRow label="TC / VKN" value={c.identity_no} />}
          {!!c.email && <InfoRow label="E-posta" value={c.email} />}
          {!!c.policy_end_date && <InfoRow label="Poliçe Bitiş" value={fmtDate(c.policy_end_date)} />}
          {!!c.muayene_bitis && <InfoRow label="Araç Muayene" value={fmtDate(c.muayene_bitis)} />}
          <InfoRow label="Kayıt" value={fmtDate(c.created_at)} />
          {extra.map(([k, v]) => <InfoRow key={k} label={humanize(k)} value={String(v)} />)}
        </View>

        {/* Aktif Poliçeler */}
        {activePolicies.length > 0 && (
          <Section label="AKTİF POLİÇELER">
            {activePolicies.map((p) => {
              const d = p.end_date ? daysUntil(p.end_date) : null;
              const u = d != null ? renewalUrgency(d) : null;
              return (
                <View key={p.id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{p.policy_type}{p.insurance_company ? ` · ${p.insurance_company}` : ''}</Text>
                    <Text style={styles.rowSub}>{p.premium ? formatTRY(p.premium) : '—'}{p.end_date ? ` · bitiş ${fmtDate(p.end_date)}` : ''}</Text>
                  </View>
                  {u && (
                    <View style={[styles.miniBadge, { backgroundColor: u.bg }]}>
                      <Text style={[styles.miniBadgeText, { color: u.text }]}>{u.label}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Section>
        )}

        {/* Bekleyen Teklifler */}
        {openReqs.length > 0 && (
          <Section label="AÇIK FIRSATLAR">
            {openReqs.map((r) => {
              const s = stageOf(r.status);
              return (
                <View key={r.id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{r.request_type}</Text>
                    <Text style={styles.rowSub}>{r.price_offer ? formatTRY(r.price_offer) : 'Tahmini prim yok'}</Text>
                  </View>
                  <View style={[styles.miniBadge, { backgroundColor: s.badgeBg }]}>
                    <Text style={[styles.miniBadgeText, { color: s.badgeText }]}>{s.label}</Text>
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        {/* Not */}
        <Section label="NOT">
          <TextInput
            style={styles.noteInput}
            value={note} onChangeText={setNote}
            placeholder="Müşteri hakkında not ekle…" placeholderTextColor={Colors.placeholder}
            multiline
          />
          <TouchableOpacity style={[styles.noteSave, savingNote && { opacity: 0.6 }]} onPress={saveNote} disabled={savingNote}>
            {savingNote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.noteSaveText}>Notu Kaydet</Text>}
          </TouchableOpacity>
        </Section>

        {/* Araç Muayene */}
        <Section label="ARAÇ MUAYENE">
          <View style={styles.muayeneRow}>
            <Text style={styles.muayeneHint}>Muayene bitiş tarihi</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={muayeneDate ? new Date(`${muayeneDate}T12:00:00`) : new Date()}
                mode="date"
                display="compact"
                locale="tr-TR"
                onChange={(_e, d) => { if (d) setMuayeneDate(toLocalISO(d)); }}
              />
            ) : (
              <>
                <TouchableOpacity style={styles.muayeneDateBtn} onPress={() => setShowMuayenePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.muayeneDateBtnText}>{muayeneDate ? fmtDate(muayeneDate) : 'Tarih seç'}</Text>
                </TouchableOpacity>
                {showMuayenePicker && (
                  <DateTimePicker
                    value={muayeneDate ? new Date(`${muayeneDate}T12:00:00`) : new Date()}
                    mode="date"
                    onChange={(_e, d) => { setShowMuayenePicker(false); if (d) setMuayeneDate(toLocalISO(d)); }}
                  />
                )}
              </>
            )}
          </View>
          {!muayeneDate && <Text style={styles.muayeneEmptyHint}>Henüz tarih seçilmedi — takvimden seçip kaydedin.</Text>}
          <TouchableOpacity style={[styles.noteSave, savingMuayene && { opacity: 0.6 }]} onPress={saveMuayene} disabled={savingMuayene}>
            {savingMuayene ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.noteSaveText}>Muayene Tarihini Kaydet</Text>}
          </TouchableOpacity>
          {c.muayene_tahmini && !!c.muayene_bitis && (
            <Text style={styles.tahminiNote}>⚠️ Bu tarih model yılından tahmin edildi. Müşteriyle görüşüp kesin tarihi girin (kaydedince işaret kalkar).</Text>
          )}
        </Section>

        {/* Evraklar */}
        <View style={{ marginTop: Spacing.lg }}>
          <DocumentSection entity="customers" entityId={c.id} agencyId={c.agency_id ?? null} uploadedBy={userId} />
        </View>

        {/* Zaman Tüneli */}
        <Section label="İLİŞKİ AKIŞI">
          {feed.length === 0 ? (
            <Text style={styles.muted}>Henüz ilişki kaydı yok — hero'daki "Görüşme" ile ilk kaydı ekleyin.</Text>
          ) : (
            feed.map((e, i) => (
              <View key={e.id} style={styles.tlRow}>
                <View style={styles.tlLeft}>
                  <View style={styles.tlIcon}><Text style={{ fontSize: 14 }}>{e.icon}</Text></View>
                  {i < feed.length - 1 && <View style={styles.tlLine} />}
                </View>
                <View style={styles.tlBody}>
                  <Text style={styles.tlTitle}>{e.title}</Text>
                  <Text style={styles.tlSub} numberOfLines={1}>{e.subtitle}</Text>
                  <Text style={styles.tlDate}>{fmtDate(e.date)}</Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Görevler / Takip */}
        <Section label="GÖREVLER / TAKİP">
          {taskRows.length === 0 ? (
            <Text style={styles.muted}>Bekleyen görev yok.</Text>
          ) : (
            taskRows.map((t) => (
              <View key={t.id} style={styles.rowItem}>
                <Text style={{ fontSize: 16, width: 28 }}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t.title}</Text>
                  {!!t.sub && <Text style={styles.rowSub}>{t.sub}</Text>}
                </View>
                <View style={[styles.miniBadge, { backgroundColor: t.badge.bg }]}>
                  <Text style={[styles.miniBadgeText, { color: t.badge.text }]}>{t.badge.label}</Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* WhatsApp Geçmişi */}
        <Section label="WHATSAPP GEÇMİŞİ">
          {waMsgs.length === 0 ? (
            <Text style={styles.muted}>Henüz WhatsApp mesajı yok.</Text>
          ) : (
            waMsgs.map((m) => (
              <View key={m.id} style={styles.waRow}>
                <Text style={styles.waMsg} numberOfLines={2}>{m.message}</Text>
                <Text style={styles.waMeta}>{m.status === 'sent' ? '✓ Gönderildi' : m.status === 'failed' ? '✕ Hata' : m.status} · {fmtDate(m.created_at)}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>

      {sheetOpen && (
        <AddInteractionSheet
          customerId={c.id}
          agencyId={c.agency_id ?? myAgencyId ?? ''}
          staffId={userId}
          staffName={profile?.full_name ?? null}
          onClose={() => setSheetOpen(false)}
          onSaved={() => { setSheetOpen(false); load(); }}
        />
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
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
function Badge({ text }: { text: string }) {
  return <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>{text}</Text></View>;
}
function humanize(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Type.body, color: Colors.secondary },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  // Hero (DarkHero içi)
  heroDelete: { width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  heroActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, paddingVertical: 11 },
  heroActionWA: { backgroundColor: '#22C55E' },
  heroActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  heroStat: { flex: 1, alignItems: 'center', borderRadius: Radius.md, paddingVertical: 10 },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, fontWeight: '700', color: Dark.subOnDark, marginTop: 1 },
  tagScroll: { marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
  tagRow: { paddingHorizontal: Spacing.lg, gap: 6, flexDirection: 'row' },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  tagChipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  tagText: { fontSize: 11, fontWeight: '700', color: Dark.subOnDark },
  tagTextOn: { color: Dark.hero },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { ...Type.caption, color: Colors.secondary },
  infoValue: { ...Type.body, color: Colors.heading, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },

  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowTitle: { ...Type.subhead, fontSize: 14 },
  rowSub: { ...Type.caption, marginTop: 2 },
  miniBadge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },

  noteInput: { ...Type.body, color: Colors.heading, minHeight: 64, textAlignVertical: 'top', padding: 0 },
  muayeneHint: { ...Type.caption, color: Colors.secondary },
  muayeneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  muayeneEmptyHint: { ...Type.caption, color: Colors.placeholder, marginTop: 4 },
  muayeneDateBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  muayeneDateBtnText: { ...Type.body, color: Colors.heading },
  tahminiNote: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF9C3', borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, lineHeight: 17 },
  noteSave: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: Spacing.sm },
  noteSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  tlRow: { flexDirection: 'row' },
  tlLeft: { width: 36, alignItems: 'center' },
  tlIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tlLine: { position: 'absolute', top: 30, bottom: -10, width: 2, backgroundColor: Colors.border },
  tlBody: { flex: 1, paddingBottom: 18, paddingLeft: 8 },
  tlTitle: { ...Type.subhead, fontSize: 14 },
  tlSub: { ...Type.caption, marginTop: 1 },
  tlDate: { ...Type.caption, color: Colors.placeholder, marginTop: 2 },

  waRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  waMsg: { ...Type.body, color: Colors.heading, lineHeight: 19 },
  waMeta: { ...Type.caption, color: Colors.placeholder, marginTop: 3 },
  soonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  soonEmoji: { fontSize: 18, width: 30 },
  soonText: { ...Type.body, flex: 1, color: Colors.heading, fontWeight: '600' },
  soonBadge: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  soonBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },
});
