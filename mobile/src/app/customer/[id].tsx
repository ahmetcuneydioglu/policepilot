import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Alert, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow, renewalUrgency } from '@/lib/theme';
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

type WaMsg = { id: string; phone: string; message: string; status: string; created_at: string };

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function waNumber(phone: string) {
  const c = (phone ?? '').replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useProfile();

  const [bundle, setBundle] = useState<CustomerBundle | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [muayeneDate, setMuayeneDate] = useState('');
  const [savingMuayene, setSavingMuayene] = useState(false);
  const [waMsgs, setWaMsgs] = useState<WaMsg[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const b = await fetchCustomerBundle(id);
    setBundle(b);
    setTimeline(buildTimeline(b));
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Müşteri" onBack={() => router.back()} />
        <View style={styles.center}><Text style={styles.muted}>Müşteri bulunamadı.</Text></View>
      </SafeAreaView>
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
  const extra = c.extra_data ? Object.entries(c.extra_data).filter(([, v]) => v) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Müşteri Detayı" onBack={() => router.back()} onDelete={remove} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(c.name)}</Text></View>
          <Text style={styles.name}>{c.name}</Text>
          {!!c.insurance_type && <Text style={styles.sub}>{c.insurance_type}</Text>}

          <View style={styles.quickRow}>
            {!!c.phone && (
              <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)} activeOpacity={0.8}>
                <Text style={styles.quickEmoji}>📞</Text><Text style={styles.quickLabel}>Ara</Text>
              </TouchableOpacity>
            )}
            {!!c.phone && (
              <TouchableOpacity style={[styles.quickBtn, styles.quickWA]} onPress={() => Linking.openURL(`whatsapp://send?phone=${waNumber(c.phone)}`)} activeOpacity={0.8}>
                <Text style={styles.quickEmoji}>💬</Text><Text style={[styles.quickLabel, { color: '#fff' }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* İstatistik */}
        <View style={styles.statRow}>
          <Stat value={activePolicies.length} label="Aktif Poliçe" />
          <Stat value={openReqs.length} label="Açık Teklif" />
          <Stat value={renewals.length} label="Yaklaşan" accent={renewals.length > 0 ? Colors.danger : Colors.heading} />
        </View>

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
          <Section label="BEKLEYEN TEKLİFLER">
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
          <Text style={styles.muayeneHint}>Muayene bitiş tarihi (YYYY-AA-GG)</Text>
          <TextInput
            style={styles.muayeneInput}
            value={muayeneDate}
            onChangeText={setMuayeneDate}
            placeholder="2026-12-31"
            placeholderTextColor={Colors.placeholder}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
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
        <Section label="ZAMAN TÜNELİ">
          {timeline.length === 0 ? (
            <Text style={styles.muted}>Henüz hareket yok.</Text>
          ) : (
            timeline.map((e, i) => (
              <View key={e.id} style={styles.tlRow}>
                <View style={styles.tlLeft}>
                  <View style={styles.tlIcon}><Text style={{ fontSize: 14 }}>{e.icon}</Text></View>
                  {i < timeline.length - 1 && <View style={styles.tlLine} />}
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
    </SafeAreaView>
  );
}

function Header({ title, onBack, onDelete }: { title: string; onBack: () => void; onDelete?: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}><Text style={styles.headerBack}>‹ Geri</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} style={styles.headerBtn}><Text style={styles.headerDelete}>Sil</Text></TouchableOpacity>
      ) : <View style={styles.headerBtn} />}
    </View>
  );
}
function Stat({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBtn: { minWidth: 56 },
  headerBack: { ...Type.subhead, color: Colors.primary },
  headerTitle: { ...Type.heading, fontSize: 16 },
  headerDelete: { ...Type.subhead, color: Colors.danger, textAlign: 'right' },

  profileCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadow.md },
  avatar: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  name: { ...Type.title, fontSize: 20 },
  sub: { ...Type.caption, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.md, alignSelf: 'stretch' },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 11 },
  quickWA: { backgroundColor: '#22C55E' },
  quickEmoji: { fontSize: 15 },
  quickLabel: { ...Type.subhead, fontSize: 14, color: Colors.heading },

  statRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  stat: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', ...Shadow.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  statLabel: { ...Type.caption, fontSize: 11, marginTop: 2 },

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
  muayeneHint: { ...Type.caption, color: Colors.secondary, marginBottom: 6 },
  muayeneInput: { ...Type.body, color: Colors.heading, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
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
