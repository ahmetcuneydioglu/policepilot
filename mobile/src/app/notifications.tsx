/**
 * src/app/notifications.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bildirim Merkezi — kalıcı `notifications` tablosundan okur (yenileme/talep/sistem).
 * Okundu işaretleme + tümünü okundu + pull-to-refresh.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';

type Notif = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string;
};

function iconFor(type: string | null): string {
  switch (type) {
    case 'renewal': return '🔄';
    case 'request': return '📋';
    case 'system':  return '⚙️';
    default:        return '🔔';
  }
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min}d önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}s önce`;
  const d = Math.floor(h / 24);
  return `${d}g önce`;
}

/** Web route'unu mobil sekmeye eşle (varsa). */
function mobileHref(link: string | null): Href | null {
  if (!link) return null;
  if (link.includes('renewal')) return '/(tabs)/renewals';
  if (link.includes('firsat') || link.includes('request') || link.includes('teklif')) return '/(tabs)/requests';
  if (link.includes('police') || link.includes('policies')) return '/(tabs)/policies';
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let q = (supabase.from('notifications') as any)
      .select('id,type,title,body,link,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (agencyId) q = q.eq('agency_id', agencyId);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  async function markAll() {
    if (!unread) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    let q = (supabase.from('notifications') as any).update({ is_read: true }).eq('is_read', false);
    if (agencyId) q = q.eq('agency_id', agencyId);
    await q;
  }

  async function onTap(n: Notif) {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', n.id);
    }
    const href = mobileHref(n.link);
    if (href) router.push(href);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unread > 0 && <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{unread} yeni</Text></View>}
        </View>
        <TouchableOpacity onPress={markAll} style={styles.clearBtn} disabled={!unread}>
          <Text style={[styles.clearBtnText, !unread && { opacity: 0.3 }]}>Okundu</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Bildirim Yok</Text>
          <Text style={styles.emptySubtitle}>Yenileme zamanı geldiğinde veya yeni talep oluştuğunda burada görünecek.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.row, !item.is_read && styles.rowUnread]} onPress={() => onTap(item)} activeOpacity={0.7}>
              <View style={styles.iconWrap}><Text style={styles.icon}>{iconFor(item.type)}</Text></View>
              <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title ?? 'Bildirim'}</Text>
                  <Text style={styles.rowTime}>{formatAgo(item.created_at)}</Text>
                </View>
                {!!item.body && <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>}
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: Colors.secondary, fontWeight: '400' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.heading, fontSize: 16 },
  headerBadge: { backgroundColor: Colors.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  clearBtn: { width: 64, alignItems: 'flex-end' },
  clearBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  list: { paddingVertical: Spacing.sm },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14, backgroundColor: Colors.card },
  rowUnread: { backgroundColor: '#F5F9FF' },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 18 },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  rowTitle: { ...Type.subhead, fontSize: 14, flex: 1, marginRight: 8 },
  rowTime: { ...Type.caption, color: Colors.placeholder },
  rowBody: { ...Type.caption, color: Colors.secondary, lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...Type.heading, marginBottom: 8 },
  emptySubtitle: { ...Type.body, color: Colors.secondary, textAlign: 'center', lineHeight: 20 },
});
