import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';

type Row = { emoji: string; label: string; href?: Href; soon?: boolean; danger?: boolean; onPress?: () => void };

export default function MoreScreen() {
  const router = useRouter();
  const { profile, role } = useProfile();
  const isSuperAdmin = role === 'super_admin';

  function signOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'OPERASYON',
      rows: [
        { emoji: '📄', label: 'Poliçeler', href: '/(tabs)/policies' },
        { emoji: '🔔', label: 'Bildirimler', href: '/notifications' },
        { emoji: '💬', label: 'WhatsApp Merkezi', href: '/whatsapp' },
        { emoji: '📁', label: 'Evrak Merkezi', href: '/evraklar' },
        { emoji: '✅', label: 'Görevler', soon: true },
        { emoji: '📊', label: 'Raporlar', soon: true },
      ],
    },
    {
      title: 'HESAP',
      rows: [
        { emoji: '⚙️', label: 'Bildirim Ayarları', href: '/settings/notifications' },
        ...(isSuperAdmin ? [{ emoji: '🛠', label: 'Yönetim', href: '/(tabs)/admin' as Href }] : []),
        { emoji: '⏻', label: 'Çıkış Yap', danger: true, onPress: signOut },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Daha</Text>

        {/* Profil özeti */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name ?? 'S').trim().slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.full_name || 'SigortaOS Kullanıcısı'}</Text>
            <Text style={styles.profileRole}>{isSuperAdmin ? 'Süper Admin' : 'Acente Kullanıcısı'}</Text>
          </View>
        </View>

        {sections.map((sec) => (
          <View key={sec.title} style={{ marginTop: Spacing.lg }}>
            <Text style={styles.sectionLabel}>{sec.title}</Text>
            <View style={styles.card}>
              {sec.rows.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[styles.row, i < sec.rows.length - 1 && styles.rowBorder]}
                  activeOpacity={row.soon ? 1 : 0.6}
                  onPress={() => {
                    if (row.soon) return;
                    if (row.onPress) return row.onPress();
                    if (row.href) router.push(row.href);
                  }}
                >
                  <Text style={styles.rowEmoji}>{row.emoji}</Text>
                  <Text style={[styles.rowLabel, row.danger && { color: Colors.danger }]}>{row.label}</Text>
                  {row.soon ? (
                    <View style={styles.soonBadge}><Text style={styles.soonText}>Yakında</Text></View>
                  ) : row.danger ? null : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>SigortaOS Mobile · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { ...Type.title, marginBottom: Spacing.md },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  avatar: { width: 48, height: 48, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  profileName: { ...Type.subhead },
  profileRole: { ...Type.caption, marginTop: 2 },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: Spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowEmoji: { fontSize: 18, width: 30 },
  rowLabel: { ...Type.body, flex: 1, color: Colors.heading, fontWeight: '600' },
  chevron: { fontSize: 22, color: Colors.placeholder, fontWeight: '300' },
  soonBadge: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  soonText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },

  version: { ...Type.caption, textAlign: 'center', marginTop: Spacing.xl, color: Colors.placeholder },
});
