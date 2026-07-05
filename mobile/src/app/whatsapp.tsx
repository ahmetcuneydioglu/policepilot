/**
 * src/app/whatsapp.tsx — WhatsApp Merkezi
 * Web /api/whatsapp/* köprüsü üzerinden: ayarlar, test gönderim, kuyruk/geçmiş.
 * Bearer token ile çağrılır (lib/api). Çalışması için web köprüsü deploy edilmeli.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Switch, ActivityIndicator, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api';

type QueueItem = {
  id: string;
  phone: string;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | string;
  template_key: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
};

type Settings = { whatsapp_enabled: boolean; whatsapp_phone: string; daily_summary_enabled: boolean };

const SEGMENTS: { key: 'pending' | 'sent' | 'failed'; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'sent', label: 'Gönderildi' },
  { key: 'failed', label: 'Hatalı' },
];

function statusStyle(s: string) {
  if (s === 'sent') return { bg: Colors.successBg, fg: Colors.success, label: 'Gönderildi' };
  if (s === 'failed') return { bg: Colors.dangerBg, fg: Colors.danger, label: 'Hata' };
  if (s === 'skipped') return { bg: Colors.surface, fg: Colors.secondary, label: 'Atlandı' };
  return { bg: Colors.amberBg, fg: '#B45309', label: 'Bekliyor' };
}
function templateLabel(k: string | null) {
  switch (k) {
    case 'daily_summary': return 'Günlük Özet';
    case 'renewal_alert': case 'renewal': return 'Yenileme';
    case 'birthday': return 'Doğum Günü';
    case 'test_send': case 'test_template': return 'Test';
    default: return k ?? 'Mesaj';
  }
}
function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}d`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

export default function WhatsappCenterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({ whatsapp_enabled: false, whatsapp_phone: '', daily_summary_enabled: false });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [segment, setSegment] = useState<'pending' | 'sent' | 'failed'>('pending');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selected, setSelected] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, q] = await Promise.all([
        apiGet<{ settings: Settings }>('/api/whatsapp/settings'),
        apiGet<{ items: QueueItem[] }>('/api/whatsapp/queue?limit=100'),
      ]);
      setSettings({
        whatsapp_enabled: !!s.settings?.whatsapp_enabled,
        whatsapp_phone: s.settings?.whatsapp_phone ?? '',
        daily_summary_enabled: !!s.settings?.daily_summary_enabled,
      });
      setQueue(q.items ?? []);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? 'Sunucuya kimlik doğrulanamadı. Web köprüsü güncellemesi yayınlanmış olmalı.'
        : e instanceof Error ? e.message : 'Bağlantı hatası';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  async function saveSettings() {
    setSaving(true);
    try {
      await apiPut('/api/whatsapp/settings', settings);
      Alert.alert('Kaydedildi', 'WhatsApp tercihleri güncellendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally { setSaving(false); }
  }

  async function sendTest() {
    const phone = settings.whatsapp_phone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert('Numara gerekli', 'Önce "Alıcı Numara" alanına test edilecek WhatsApp numarasını girin (örn. 905XXXXXXXXX).');
      return;
    }
    setTesting(true);
    try {
      // Onaylı şablonla gönder — Meta, düz metni 24 saat penceresi dışında reddeder.
      await apiPost('/api/whatsapp/test-send', { use_template: true, phone });
      Alert.alert('✅ Gönderildi', `Test şablonu ${phone} numarasına gönderildi. WhatsApp'ını kontrol et.`);
      await load();
    } catch (e) {
      Alert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Hata');
    } finally { setTesting(false); }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, sent: 0, failed: 0 };
    for (const it of queue) if (c[it.status] != null) c[it.status]++;
    return c;
  }, [queue]);
  const visible = useMemo(() => queue.filter((q) => q.status === segment), [queue, segment]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>WhatsApp Merkezi</Text>
        <View style={styles.hBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {error && (
                <View style={styles.errBanner}>
                  <Text style={styles.errText}>{error}</Text>
                  <TouchableOpacity onPress={load}><Text style={styles.errRetry}>Tekrar dene</Text></TouchableOpacity>
                </View>
              )}

              {/* Ayarlar */}
              <Text style={styles.sectionLabel}>AYARLAR</Text>
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>WhatsApp Bildirimleri</Text>
                  <Switch
                    value={settings.whatsapp_enabled}
                    onValueChange={(v) => setSettings((s) => ({ ...s, whatsapp_enabled: v }))}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>Alıcı Numara (günlük özet)</Text>
                <TextInput
                  style={styles.input}
                  value={settings.whatsapp_phone}
                  onChangeText={(v) => setSettings((s) => ({ ...s, whatsapp_phone: v }))}
                  placeholder="905XXXXXXXXX" placeholderTextColor={Colors.placeholder} keyboardType="phone-pad"
                />
                <View style={[styles.toggleRow, { marginTop: Spacing.sm }]}>
                  <Text style={styles.toggleLabel}>Günlük Operasyon Özeti</Text>
                  <Switch
                    value={settings.daily_summary_enabled}
                    onValueChange={(v) => setSettings((s) => ({ ...s, daily_summary_enabled: v }))}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
                <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveSettings} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Kaydet</Text>}
                </TouchableOpacity>
              </View>

              {/* Test */}
              <TouchableOpacity style={[styles.testBtn, testing && { opacity: 0.6 }]} onPress={sendTest} disabled={testing} activeOpacity={0.85}>
                {testing ? <ActivityIndicator color="#fff" /> : <Text style={styles.testBtnText}>💬  Test Mesajı Gönder</Text>}
              </TouchableOpacity>

              {/* Kuyruk / Geçmiş */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>MESAJLAR</Text>
              <View style={styles.segRow}>
                {SEGMENTS.map((s) => {
                  const active = segment === s.key;
                  return (
                    <TouchableOpacity key={s.key} style={[styles.seg, active && styles.segActive]} onPress={() => setSegment(s.key)} activeOpacity={0.7}>
                      <Text style={[styles.segText, active && styles.segTextActive]}>{s.label} {counts[s.key] ?? 0}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}><Text style={styles.emptyEmoji}>📭</Text><Text style={styles.emptyText}>Bu kategoride mesaj yok</Text></View>
          }
          renderItem={({ item: it }) => {
            const st = statusStyle(it.status);
            return (
              <TouchableOpacity style={styles.msgCard} onPress={() => setSelected(it)} activeOpacity={0.7}>
                <View style={styles.msgTop}>
                  <Text style={styles.msgPhone}>{it.phone}</Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text></View>
                </View>
                <Text style={styles.msgBody} numberOfLines={2}>{it.message}</Text>
                <View style={styles.msgBottom}>
                  <Text style={styles.msgTag}>{templateLabel(it.template_key)}</Text>
                  <Text style={styles.msgTime}>{ago(it.created_at)} önce</Text>
                </View>
                {it.status === 'failed' && !!it.error_message && <Text style={styles.msgErr} numberOfLines={2}>{it.error_message}</Text>}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <>
              {/* Yakında: doğum günü / yenileme otomasyonları */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>OTOMASYONLAR</Text>
              <View style={styles.card}>
                <AutoRow emoji="🔄" label="Yenileme Hatırlatmaları" note="Cron ile çalışıyor" />
              </View>
            </>
          }
        />
      )}

      {selected && <MessageModal item={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
}

function MessageModal({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const st = statusStyle(item.status);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hBack}>Kapat</Text></TouchableOpacity>
          <Text style={styles.hTitle}>Mesaj</Text>
          <View style={styles.hBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.msgTop}>
            <Text style={styles.msgPhone}>{item.phone}</Text>
            <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text></View>
          </View>
          <View style={[styles.card, { marginTop: Spacing.md }]}>
            <Text style={styles.fullMsg}>{item.message}</Text>
          </View>
          <View style={[styles.card, { marginTop: Spacing.md }]}>
            <DetailRow label="Tür" value={templateLabel(item.template_key)} />
            <DetailRow label="Durum" value={st.label} />
            <DetailRow label="Oluşturma" value={new Date(item.created_at).toLocaleString('tr-TR')} />
            {!!item.sent_at && <DetailRow label="Gönderim" value={new Date(item.sent_at).toLocaleString('tr-TR')} />}
            {!!item.error_message && <DetailRow label="Hata" value={item.error_message} />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function AutoRow({ emoji, label, note }: { emoji: string; label: string; note: string }) {
  return (
    <View style={styles.autoRow}>
      <Text style={styles.autoEmoji}>{emoji}</Text>
      <Text style={styles.autoLabel}>{label}</Text>
      <Text style={styles.autoNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 56 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  errBanner: { backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#FECACA' },
  errText: { ...Type.caption, color: Colors.danger, lineHeight: 17 },
  errRetry: { ...Type.subhead, color: Colors.danger, marginTop: 6 },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { ...Type.subhead, fontSize: 14 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  fieldLabel: { ...Type.caption, marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: 14, color: Colors.heading },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: Spacing.md },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  testBtn: { backgroundColor: '#22C55E', borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md, ...Shadow.sm },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  segRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  seg: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 9, alignItems: 'center' },
  segActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segText: { ...Type.caption, color: Colors.text },
  segTextActive: { color: '#fff' },

  msgCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  msgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  msgPhone: { ...Type.subhead, fontSize: 14 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  msgBody: { ...Type.caption, color: Colors.text, lineHeight: 18 },
  msgBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  msgTag: { ...Type.caption, color: Colors.primary, fontWeight: '700' },
  msgTime: { ...Type.caption, color: Colors.placeholder },
  msgErr: { ...Type.caption, color: Colors.danger, marginTop: 6 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { ...Type.caption },

  autoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  autoEmoji: { fontSize: 18, width: 30 },
  autoLabel: { ...Type.body, flex: 1, color: Colors.heading, fontWeight: '600' },
  autoNote: { ...Type.caption, color: Colors.secondary },

  fullMsg: { ...Type.body, color: Colors.heading, lineHeight: 21 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { ...Type.caption, color: Colors.secondary },
  detailValue: { ...Type.body, color: Colors.heading, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
});
