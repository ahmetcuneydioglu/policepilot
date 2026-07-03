import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter, Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { deleteAccount } from '@/lib/security';
import { isAppLockEnabled, setAppLockEnabled, biometricsAvailable } from '@/lib/appLock';
import { successHaptic, warningHaptic } from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Type, Shadow, Dark } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import DarkHero, { heroGlassStrong } from '@/components/DarkHero';
import Icon from '@/components/Icon';

type Row = { emoji: string; symbol: string; label: string; href?: Href; soon?: boolean; danger?: boolean; onPress?: () => void };

export default function MoreScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { profile, role } = useProfile();
  const isSuperAdmin = role === 'super_admin';
  const isManager = isSuperAdmin || profile?.agency_role === 'owner' || profile?.agency_role === 'manager';

  function signOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  // Face ID / Touch ID uygulama kilidi
  const [lockOn, setLockOn] = useState(false);
  useEffect(() => { isAppLockEnabled().then(setLockOn); }, []);
  async function toggleAppLock() {
    if (!lockOn) {
      if (!(await biometricsAvailable())) {
        Alert.alert('Kullanılamıyor', 'Bu cihazda Face ID / Touch ID kurulu değil. Önce cihaz ayarlarından biyometri ekleyin.');
        return;
      }
      await setAppLockEnabled(true);
      setLockOn(true);
      successHaptic();
      Alert.alert('Kilit Açık', 'Uygulama artık açılışta ve arka plandan dönüşte Face ID / Touch ID isteyecek.');
    } else {
      warningHaptic();
      Alert.alert('Kilidi Kapat', 'Uygulama kilidi kapatılsın mı?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kapat', style: 'destructive', onPress: async () => { await setAppLockEnabled(false); setLockOn(false); } },
      ]);
    }
  }

  const [deleting, setDeleting] = useState(false);
  function confirmDeleteAccount() {
    if (deleting) return;
    // App Store 5.1.1(v): uygulama içi hesap silme. İki aşamalı onay.
    Alert.alert(
      'Hesabı Sil',
      'Hesabınız kalıcı olarak silinecek ve bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam Et',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Emin misiniz?', 'Bu son adım: hesabınız ve oturumunuz kalıcı olarak silinecek.', [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Hesabımı Kalıcı Sil',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  try {
                    await deleteAccount();
                    await supabase.auth.signOut(); // gate login'e atar
                  } catch (e) {
                    Alert.alert('Silinemedi', e instanceof Error ? e.message : 'Bir hata oluştu. Tekrar deneyin.');
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ]),
        },
      ]
    );
  }

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'OPERASYON',
      rows: [
        { emoji: '🎯', symbol: 'target', label: 'Fırsatlar', href: '/(tabs)/requests' },
        { emoji: '🚗', symbol: 'car.fill', label: 'Araç Muayeneleri', href: '/(tabs)/muayene' },
        { emoji: '✅', symbol: 'checklist', label: 'Görevler', href: '/gorevler' },
        { emoji: '✨', symbol: 'sparkles', label: 'SigortaOS AI', href: '/(tabs)/ai' },
        { emoji: '📄', symbol: 'doc.text.fill', label: 'Poliçeler', href: '/(tabs)/policies' },
        { emoji: '💬', symbol: 'message.fill', label: 'WhatsApp Merkezi', href: '/whatsapp' },
        { emoji: '📁', symbol: 'folder.fill', label: 'Evrak Merkezi', href: '/evraklar' },
        { emoji: '🔔', symbol: 'bell.fill', label: 'Bildirimler', href: '/notifications' },
      ],
    },
    ...(isManager ? [{
      title: 'YÖNETİM',
      rows: [
        { emoji: '🏆', symbol: 'trophy.fill', label: 'Performans', href: '/performans' as Href },
        { emoji: '📊', symbol: 'chart.bar.fill', label: 'Raporlar', href: '/raporlar' as Href },
      ] as Row[],
    }] : []),
    {
      title: 'HESAP',
      rows: [
        { emoji: '⚙️', symbol: 'gearshape.fill', label: 'Bildirim Ayarları', href: '/settings/notifications' },
        { emoji: '🔐', symbol: 'faceid', label: `Face ID Kilidi · ${lockOn ? 'Açık' : 'Kapalı'}`, onPress: toggleAppLock },
        ...(isSuperAdmin ? [{ emoji: '🛠', symbol: 'wrench.and.screwdriver.fill', label: 'Yönetim', href: '/(tabs)/admin' as Href }] : []),
        { emoji: '⏻', symbol: 'rectangle.portrait.and.arrow.right', label: 'Çıkış Yap', danger: true, onPress: signOut },
        { emoji: '🗑️', symbol: 'trash.fill', label: deleting ? 'Siliniyor…' : 'Hesabı Sil', danger: true, onPress: confirmDeleteAccount },
      ],
    },
  ];

  const displayName = profile?.full_name || 'SigortaOS Kullanıcısı';

  return (
    <View style={styles.safe}>
      <DarkHero
        title={displayName}
        subtitle={isSuperAdmin ? 'Süper Admin' : 'Acente Kullanıcısı'}
        right={(
          <LinearGradient colors={['#5B8DEF', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{displayName.trim().slice(0, 1).toUpperCase()}</Text>
          </LinearGradient>
        )}
      >
        <View style={styles.heroWelcome}>
          <Text style={styles.heroWelcomeText}>Hesabını ve menülerini buradan yönet 👋</Text>
        </View>
      </DarkHero>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.md }]} showsVerticalScrollIndicator={false}>
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
                  <View style={styles.rowIconBox}>
                    <Icon symbol={row.symbol} emoji={row.emoji} size={18} color={row.danger ? Colors.danger : Colors.heading} weight="medium" />
                  </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },

  // Hero (koyu glass)
  heroAvatar: { width: 44, height: 44, borderRadius: Radius.full, borderWidth: 1, borderColor: Dark.glassBorder, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  heroAvatarText: { color: Dark.textOnDark, fontSize: 18, fontWeight: '800' },
  heroWelcome: { ...heroGlassStrong, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  heroWelcomeText: { color: Dark.subOnDark, fontSize: 13, fontWeight: '600' },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: Spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconBox: { width: 30, alignItems: 'flex-start' },
  rowLabel: { ...Type.body, flex: 1, color: Colors.heading, fontWeight: '600' },
  chevron: { fontSize: 22, color: Colors.placeholder, fontWeight: '300' },
  soonBadge: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  soonText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },

  version: { ...Type.caption, textAlign: 'center', marginTop: Spacing.xl, color: Colors.placeholder },
});
