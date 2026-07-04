/**
 * src/app/gorevler.tsx — "Görevler" (route: /gorevler)
 * ─────────────────────────────────────────────────────────────────────────────
 * Türetilmiş yapılacaklar listesi (yeni tablo YOK). Üç kaynak:
 *   🔄 Yenileme · 📞 Takip · ✨ Yeni Lead → tek tip Task[] (lib/tasks.ts).
 * Bölümlü liste (Gecikmiş / Bugün / Bu Hafta / Yaklaşan) + tek-tık aksiyonlar.
 * Acente sahibi için "bugün ne yapılmalı" özetini öne çıkarır.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow, renewalUrgency } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import ActionBtn from '@/components/ActionBtn';
import { useCachedQuery } from '@/lib/query';
import {
  fetchTasks, groupTasks, buildTaskCallUrl, buildTaskWhatsappUrl,
  completeInteractionTask, Task, TaskKind, TaskUrgency,
} from '@/lib/tasks';

const KIND_META: Record<TaskKind, { emoji: string; label: string; tint: string; bg: string }> = {
  renewal:  { emoji: '🔄', label: 'Yenileme', tint: Colors.primary, bg: Colors.primaryLight },
  followup: { emoji: '📞', label: 'Takip',    tint: '#D97706',      bg: Colors.warningBg },
  lead:     { emoji: '✨', label: 'Yeni Lead', tint: Colors.success, bg: Colors.successBg },
  interaction: { emoji: '🤝', label: 'Görüşme', tint: '#7C3AED', bg: Colors.infoBg },
};

/** Aciliyet rozeti: gün bilgisi varsa renewalUrgency'den, yoksa kind'e göre. */
function badgeFor(task: Task): { bg: string; text: string; dot: string; label: string } {
  if (typeof task.daysLeft === 'number') {
    const u = renewalUrgency(task.daysLeft);
    return { bg: u.bg, text: u.text, dot: u.dot, label: u.label };
  }
  // Lead (gün yok) → kind rengiyle
  const k = KIND_META[task.kind];
  return { bg: k.bg, text: k.tint, dot: k.tint, label: 'İlk temas' };
}

export default function GorevlerScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();

  const { data, loading, refreshing, onRefresh } = useCachedQuery(
    ['tasks', agencyId], () => fetchTasks(agencyId)
  );
  const tasks = data ?? [];

  const sections = useMemo(() => groupTasks(tasks), [tasks]);

  const summary = useMemo(() => {
    let overdue = 0, today = 0;
    for (const t of tasks) {
      if (t.urgency === 'overdue') overdue++;
      else if (t.urgency === 'today') today++;
    }
    return { overdue, today, total: tasks.length };
  }, [tasks]);

  function call(task: Task) {
    if (!task.customerPhone) return Alert.alert('Telefon yok', 'Bu müşteride kayıtlı telefon yok.');
    Linking.openURL(buildTaskCallUrl(task.customerPhone)).catch(() => {});
  }
  function whatsapp(task: Task) {
    if (!task.customerPhone) return Alert.alert('Telefon yok', 'WhatsApp için telefon gerekli.');
    Linking.openURL(buildTaskWhatsappUrl(task)).catch(() =>
      Alert.alert('WhatsApp açılamadı', 'Cihazda WhatsApp yüklü olmayabilir.')
    );
  }
  function detail(task: Task) {
    router.push(`/customer/${task.customerId}`);
  }
  async function complete(task: Task) {
    await completeInteractionTask(task.refId);
    onRefresh();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}>
          <Text style={styles.hBack}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.hTitle}>Görevler</Text>
        <View style={styles.hBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections.map((sec) => ({ title: sec.section, data: sec.items }))}
          keyExtractor={(task) => task.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            tasks.length > 0 ? (
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: Colors.danger }]}>{summary.overdue}</Text>
                  <Text style={styles.summaryLabel}>Gecikmiş</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: Colors.primary }]}>{summary.today}</Text>
                  <Text style={styles.summaryLabel}>Bugün</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: Colors.heading }]}>{summary.total}</Text>
                  <Text style={styles.summaryLabel}>Toplam</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Bugün için görev yok</Text>
              <Text style={styles.emptySub}>Yenileme, takip ve yeni leadler burada birikecek. Aşağı çekerek yenileyebilirsin.</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{section.data.length}</Text>
              </View>
            </View>
          )}
          renderItem={({ item: task }) => {
            const km = KIND_META[task.kind];
            const b = badgeFor(task);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.kindIcon, { backgroundColor: km.bg }]}>
                    <Text style={styles.kindEmoji}>{km.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{task.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{task.subtitle}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: b.bg }]}>
                    <View style={[styles.badgeDot, { backgroundColor: b.dot }]} />
                    <Text style={[styles.badgeText, { color: b.text }]} numberOfLines={1}>{b.label}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <ActionBtn symbol="phone.fill" emoji="📞" label="Ara" onPress={() => call(task)} />
                  <ActionBtn symbol="message.fill" emoji="💬" label="WhatsApp" tint="#25D366" onPress={() => whatsapp(task)} />
                  {task.kind === 'interaction' && (
                    <ActionBtn symbol="checkmark" emoji="✓" label="Tamam" tint={Colors.success} onPress={() => complete(task)} />
                  )}
                  <ActionBtn symbol="arrow.right" emoji="→" label="Detay" tint={Colors.primary} onPress={() => detail(task)} />
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hBtn: { minWidth: 64 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  // Özet şeridi
  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, marginBottom: Spacing.lg, ...Shadow.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { ...Type.caption, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  // Bölüm
  section: { marginBottom: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: 8 },
  sectionTitle: { ...Type.label, color: Colors.secondary },
  sectionCount: { backgroundColor: Colors.surface, borderRadius: Radius.full, minWidth: 20, paddingHorizontal: 6, height: 18, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 10, fontWeight: '800', color: Colors.secondary },

  // Kart
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  kindIcon: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  kindEmoji: { fontSize: 20 },
  name: { ...Type.subhead },
  meta: { ...Type.caption, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8, maxWidth: 124 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', marginTop: Spacing.md, gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: 9,
  },
  actionEmoji: { fontSize: 14 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: Colors.text },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { ...Type.heading, textAlign: 'center' },
  emptySub: { ...Type.caption, textAlign: 'center', marginTop: 6, paddingHorizontal: 30, lineHeight: 18 },
});
