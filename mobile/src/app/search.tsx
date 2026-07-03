/**
 * src/app/search.tsx — Global arama (⌘K'nin mobil karşılığı).
 * Tek kutu: müşteri adı / telefon / TC / plaka + poliçe no.
 * Sonuçtan tek dokunuş: müşteri kartı, ara, WhatsApp.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, FlatList, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { tapHaptic } from '@/lib/haptics';
import Icon from '@/components/Icon';

type CustomerHit = { kind: 'customer'; id: string; name: string; phone: string | null; vehicle_plate: string | null };
type PolicyHit = { kind: 'policy'; id: string; policy_no: string | null; policy_type: string; customer_id: string; customerName: string };
type Hit = CustomerHit | PolicyHit;

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function waNumber(phone: string) {
  const c = phone.replace(/\D/g, '');
  return c.startsWith('0') ? '90' + c.slice(1) : c;
}

export default function SearchScreen() {
  const router = useRouter();
  const { role, agencyId } = useProfile();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setHits([]); setSearched(false); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(() => runSearch(term), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, agencyId]);

  async function runSearch(term: string) {
    const mySeq = ++seq.current;
    const like = `%${term}%`;
    const scoped = (query: any) =>
      role === 'agency_user' && agencyId ? query.eq('agency_id', agencyId) : query;

    const [custRes, polRes] = await Promise.all([
      scoped((supabase.from('customers') as any)
        .select('id, name, phone, vehicle_plate')
        .or(`name.ilike.${like},phone.ilike.${like},identity_no.ilike.${like},vehicle_plate.ilike.${like}`))
        .order('created_at', { ascending: false })
        .limit(15),
      scoped((supabase.from('policies') as any)
        .select('id, policy_no, policy_type, customer_id, customers(name)')
        .ilike('policy_no', like))
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (mySeq !== seq.current) return; // eski sorgu sonucu — at

    const customers: Hit[] = (custRes.data ?? []).map((c: any) => ({
      kind: 'customer', id: c.id, name: c.name, phone: c.phone, vehicle_plate: c.vehicle_plate,
    }));
    const policies: Hit[] = (polRes.data ?? []).map((p: any) => ({
      kind: 'policy', id: p.id, policy_no: p.policy_no, policy_type: p.policy_type,
      customer_id: p.customer_id, customerName: p.customers?.name ?? 'Müşteri',
    }));
    setHits([...customers, ...policies]);
    setSearched(true);
    setLoading(false);
  }

  function openCustomer(id: string) {
    tapHaptic();
    Keyboard.dismiss();
    router.push(`/customer/${id}`);
  }
  function call(phone: string | null) {
    if (!phone) return;
    tapHaptic();
    Linking.openURL(`tel:${phone}`).catch(() => {});
  }
  function whatsapp(phone: string | null) {
    if (!phone) return;
    tapHaptic();
    Linking.openURL(`https://wa.me/${waNumber(phone)}`).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Arama başlığı */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Icon symbol="magnifyingglass" emoji="🔍" size={16} color={Colors.secondary} />
          <TextInput
            style={styles.input}
            placeholder="Müşteri, telefon, TC, plaka, poliçe no…"
            placeholderTextColor={Colors.placeholder}
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />}

      {!loading && !searched && (
        <View style={styles.hintBox}>
          <Icon symbol="magnifyingglass" emoji="🔍" size={34} color={Colors.border} />
          <Text style={styles.hintTitle}>Her şeyi tek kutudan bul</Text>
          <Text style={styles.hintSub}>İsim, telefon, TC kimlik, plaka veya poliçe numarası yaz — en az 2 karakter.</Text>
        </View>
      )}

      {!loading && searched && (
        <FlatList
          data={hits}
          keyExtractor={(h) => `${h.kind}-${h.id}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.hintBox}>
              <Text style={styles.hintTitle}>Sonuç yok</Text>
              <Text style={styles.hintSub}>{`"${q.trim()}" ile eşleşen müşteri veya poliçe bulunamadı.`}</Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'customer' ? (
              <TouchableOpacity style={styles.row} onPress={() => openCustomer(item.id)} activeOpacity={0.7}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.phone, item.vehicle_plate].filter(Boolean).join(' · ') || 'Müşteri'}
                  </Text>
                </View>
                {!!item.phone && (
                  <>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => call(item.phone)} activeOpacity={0.7}>
                      <Icon symbol="phone.fill" emoji="📞" size={15} color={Colors.heading} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => whatsapp(item.phone)} activeOpacity={0.7}>
                      <Icon symbol="message.fill" emoji="💬" size={15} color="#25D366" />
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.row} onPress={() => openCustomer(item.customer_id)} activeOpacity={0.7}>
                <View style={[styles.avatar, { backgroundColor: '#FEF3C7' }]}>
                  <Icon symbol="doc.text.fill" emoji="📄" size={16} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.policy_no || 'Poliçe'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.policy_type} · {item.customerName}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border, height: 44,
  },
  input: { flex: 1, ...Type.body, color: Colors.heading, paddingVertical: 0 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { ...Type.body, color: Colors.primary, fontWeight: '600' },

  hintBox: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 40, gap: 8 },
  hintTitle: { ...Type.heading, color: Colors.heading, marginTop: 8 },
  hintSub: { ...Type.caption, color: Colors.secondary, textAlign: 'center', lineHeight: 18 },

  list: { padding: Spacing.lg, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 12, ...Shadow.sm,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  name: { ...Type.body, fontWeight: '700', color: Colors.heading },
  meta: { ...Type.caption, color: Colors.secondary, marginTop: 1 },
  quickBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  chevron: { fontSize: 20, color: Colors.placeholder, paddingHorizontal: 4 },
});
