import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { apiPost, ApiError } from '@/lib/api';

type Msg = { role: 'user' | 'assistant'; content: string };

const PROMPTS = [
  { emoji: '📞', text: 'Bugün kimi aramalıyım?' },
  { emoji: '🔄', text: 'Yaklaşan yenilemeleri öncelik sırasıyla özetle' },
  { emoji: '💰', text: 'En sıcak satış fırsatlarım hangileri?' },
  { emoji: '✍️', text: 'Yaklaşan bir yenileme için WhatsApp mesajı yaz' },
];

export default function AiScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const { reply } = await apiPost<{ reply: string }>('/api/ai/assistant', { messages: next });
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Bir hata oluştu';
      if (e instanceof ApiError) {
        if (e.status === 401) msg = 'Sunucu güncellemesi henüz yayınlanmamış olabilir.';
        else if (e.status === 503) msg = 'AI henüz yapılandırılmadı (sunucu tarafı).';
      }
      setMessages([...next, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoBadge}><Text style={styles.logoEmoji}>✨</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SigortaOS AI</Text>
          <Text style={styles.subtitle}>Verilerinle konuşan asistanın</Text>
        </View>
        {!empty && (
          <TouchableOpacity onPress={() => setMessages([])} style={styles.clearBtn}><Text style={styles.clearText}>Temizle</Text></TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {empty ? (
            <View style={styles.intro}>
              <Text style={styles.introLead}>
                Müşteri, poliçe ve teklif verilerinle çalışırım. Bugün ne yapman gerektiğini sorabilir,
                mesaj taslağı isteyebilirsin.
              </Text>
              {PROMPTS.map((p) => (
                <TouchableOpacity key={p.text} style={styles.promptChip} onPress={() => send(p.text)} activeOpacity={0.7}>
                  <Text style={styles.promptEmoji}>{p.emoji}</Text>
                  <Text style={styles.promptText}>{p.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.rowRight : styles.rowLeft]}>
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                  {m.role === 'user'
                    ? <Text style={[styles.bubbleText, { color: '#fff' }]}>{m.content}</Text>
                    : <RichText text={m.content} />}
                </View>
              </View>
            ))
          )}
          {sending && (
            <View style={[styles.bubbleRow, styles.rowLeft]}>
              <View style={[styles.bubble, styles.bubbleAi, styles.typing]}>
                <ActivityIndicator size="small" color={Colors.secondary} />
                <Text style={styles.typingText}>düşünüyor…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="SigortaOS AI'a sor…"
            placeholderTextColor={Colors.placeholder}
            multiline
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendEmoji}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Hafif markdown render (numaralı/madde liste + **kalın**) ────────────────
function parseInline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <Text key={`${keyBase}-${i}`} style={styles.bold}>{p.slice(2, -2)}</Text>
      : <Text key={`${keyBase}-${i}`}>{p}</Text>
  );
}

function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <View key={i} style={{ height: 6 }} />;
        const num = t.match(/^(\d+)[.)]\s+(.*)$/);
        const bul = t.match(/^[-•*]\s+(.*)$/);
        if (num) {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liMarker}>{num[1]}.</Text>
              <Text style={styles.liText}>{parseInline(num[2], String(i))}</Text>
            </View>
          );
        }
        if (bul) {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liMarker}>•</Text>
              <Text style={styles.liText}>{parseInline(bul[1], String(i))}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.para}>{parseInline(t, String(i))}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logoBadge: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoEmoji: { fontSize: 20 },
  title: { ...Type.heading, fontSize: 17 },
  subtitle: { ...Type.caption, marginTop: 1 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearText: { ...Type.caption, color: Colors.primary, fontWeight: '700' },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing.md, flexGrow: 1 },
  intro: { paddingTop: Spacing.sm },
  introLead: { ...Type.body, color: Colors.text, lineHeight: 21, marginBottom: Spacing.lg },
  promptChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: Spacing.md, marginBottom: 10, ...Shadow.sm },
  promptEmoji: { fontSize: 18, width: 30 },
  promptText: { ...Type.subhead, fontSize: 14, flex: 1 },

  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: Colors.card, borderBottomLeftRadius: 4, ...Shadow.sm },
  bubbleText: { ...Type.body, color: Colors.heading, lineHeight: 21 },
  bold: { fontWeight: '800', color: Colors.heading },
  para: { ...Type.body, color: Colors.heading, lineHeight: 21, marginBottom: 6 },
  liRow: { flexDirection: 'row', marginBottom: 6 },
  liMarker: { ...Type.body, color: Colors.primary, fontWeight: '800', width: 22 },
  liText: { ...Type.body, color: Colors.heading, flex: 1, lineHeight: 21 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { ...Type.caption, color: Colors.secondary },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  input: { flex: 1, maxHeight: 120, backgroundColor: Colors.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: Colors.heading },
  sendBtn: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendEmoji: { color: '#fff', fontSize: 17 },
});
