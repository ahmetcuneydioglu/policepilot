import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';

const PROMPTS = [
  { emoji: '📞', text: 'Bugün kimi aramalıyım?' },
  { emoji: '🔄', text: 'Bu müşteriye yenileme mesajı hazırla' },
  { emoji: '📋', text: 'Bu müşteri için teklif özeti oluştur' },
  { emoji: '💰', text: 'Bugünkü satış fırsatlarını göster' },
  { emoji: '🤝', text: 'Bu müşteriyi ikna etmek için ne söyleyebilirim?' },
];

export default function AiScreen() {
  function soon() {
    Alert.alert('SigortaOS AI · Yakında', 'AI asistanı bir sonraki güncellemede aktif olacak. Müşteri, poliçe ve teklif verilerinle çalışıp sana günlük aksiyon önerileri sunacak.');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}><Text style={styles.logoEmoji}>✨</Text></View>
          <Text style={styles.title}>SigortaOS AI</Text>
          <Text style={styles.subtitle}>Acentenin dijital yardımcısı</Text>
          <View style={styles.soonPill}><Text style={styles.soonPillText}>YAKINDA</Text></View>
        </View>

        <Text style={styles.lead}>
          Verilerinle konuş. AI; müşteri, poliçe ve teklif geçmişini kullanarak bugün ne yapman
          gerektiğini söyler, mesajlarını yazar, fırsatları çıkarır.
        </Text>

        <Text style={styles.sectionLabel}>ÖRNEK KOMUTLAR</Text>
        <View style={styles.card}>
          {PROMPTS.map((p, i) => (
            <TouchableOpacity
              key={p.text}
              style={[styles.promptRow, i < PROMPTS.length - 1 && styles.promptBorder]}
              onPress={soon}
              activeOpacity={0.6}
            >
              <Text style={styles.promptEmoji}>{p.emoji}</Text>
              <Text style={styles.promptText}>{p.text}</Text>
              <Text style={styles.promptArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sahte input (yakında) */}
        <TouchableOpacity style={styles.inputBar} onPress={soon} activeOpacity={0.8}>
          <Text style={styles.inputPlaceholder}>SigortaOS AI'a sor…</Text>
          <View style={styles.sendBtn}><Text style={styles.sendEmoji}>➤</Text></View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  hero: { alignItems: 'center', paddingVertical: Spacing.lg },
  logoBadge: {
    width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.md,
  },
  logoEmoji: { fontSize: 36 },
  title: { ...Type.display },
  subtitle: { ...Type.body, color: Colors.secondary, marginTop: 2 },
  soonPill: { marginTop: 10, backgroundColor: Colors.heading, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  soonPillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  lead: { ...Type.body, color: Colors.text, textAlign: 'center', lineHeight: 21, marginVertical: Spacing.md, paddingHorizontal: Spacing.sm },

  sectionLabel: { ...Type.label, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden' },
  promptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: Spacing.md },
  promptBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  promptEmoji: { fontSize: 18, width: 30 },
  promptText: { ...Type.body, flex: 1, color: Colors.heading, fontWeight: '600' },
  promptArrow: { fontSize: 22, color: Colors.placeholder, fontWeight: '300' },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg,
    backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingLeft: Spacing.md, paddingRight: 6, height: 52, ...Shadow.sm,
  },
  inputPlaceholder: { ...Type.body, flex: 1, color: Colors.placeholder },
  sendBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendEmoji: { color: '#fff', fontSize: 16 },
});
