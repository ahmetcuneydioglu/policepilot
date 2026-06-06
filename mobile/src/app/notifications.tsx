/**
 * src/app/notifications.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app bildirim geçmişi — son 20 yeni talep, okundu/okunmadı durumu ile.
 * Presentation: modal (stack'te tanımlı).
 */

import { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { useNotificationStore, type NotifItem } from '@/lib/NotificationContext';
import { clearBadge } from '@/lib/notifications';

// ─── Tek bildirim satırı ──────────────────────────────────────────────────────
function NotifRow({ item }: { item: NotifItem }) {
  const ago = formatAgo(item.createdAt);

  return (
    <View style={[styles.row, !item.isRead && styles.rowUnread]}>
      {/* Okunmadı noktası */}
      <View style={styles.dotWrapper}>
        {!item.isRead && <View style={styles.dot} />}
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowType} numberOfLines={1}>{item.requestType}</Text>
          <Text style={styles.rowTime}>{ago}</Text>
        </View>
        <Text style={styles.rowCustomer} numberOfLines={1}>
          {item.customerName}
          {item.customerPhone ? `  •  ${item.customerPhone}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ─── Zaman formatlama ─────────────────────────────────────────────────────────
function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return 'az önce';
  if (min < 60) return `${min}d önce`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}s önce`;
  const d = Math.floor(h / 24);
  return `${d}g önce`;
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotificationStore();

  // Ekran açılınca tüm bildirimleri okundu say
  useFocusEffect(
    useCallback(() => {
      markAllRead();
      clearBadge();
    }, [markAllRead])
  );

  const isEmpty = notifications.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount} yeni</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={clearAll} style={styles.clearBtn} disabled={isEmpty}>
          <Text style={[styles.clearBtnText, isEmpty && { opacity: 0.3 }]}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Bildirim Yok</Text>
          <Text style={styles.emptySubtitle}>Yeni teklif talebi geldiğinde burada görünecek.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotifRow item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: Colors.secondary, fontWeight: '400' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.heading },
  headerBadge: {
    backgroundColor: Colors.danger, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  clearBtn: { width: 56, alignItems: 'flex-end' },
  clearBtnText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },

  list: { paddingVertical: Spacing.sm },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 56 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    backgroundColor: Colors.card,
  },
  rowUnread: { backgroundColor: '#EFF6FF' },
  dotWrapper: { width: 20, alignItems: 'center', marginRight: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowType: { fontSize: 14, fontWeight: '700', color: Colors.heading, flex: 1, marginRight: 8 },
  rowTime: { fontSize: 12, color: Colors.secondary },
  rowCustomer: { fontSize: 13, color: Colors.secondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.heading, marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14, color: Colors.secondary, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 40,
  },
});
