/**
 * AddInteractionSheet — saha personelinin 30 saniyede görüşme kaydetmesi için
 * chip-ağırlıklı form (IRM Faz 1). pageSheet modal; kaydette haptic.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, Radius, Type } from '@/lib/theme';
import { successHaptic, errorHaptic, tapHaptic } from '@/lib/haptics';
import {
  CHANNELS, LOCATIONS, INTERACTION_PRODUCTS, OUTCOMES, NEXT_ACTIONS,
  addInteraction,
} from '@/lib/relationship';

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={() => { tapHaptic(); onPress(); }}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function AddInteractionSheet({
  customerId, agencyId, staffId, staffName, onClose, onSaved, initialChannel,
}: {
  customerId: string;
  agencyId: string;
  staffId: string | null;
  staffName: string | null;
  onClose: () => void;
  onSaved: () => void;
  /** Nudge akışı: "aramadan döndün → kaydet?" kanal ön-seçili gelir */
  initialChannel?: string;
}) {
  const [channel, setChannel] = useState(initialChannel ?? 'phone');
  const [location, setLocation] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [when, setWhen] = useState(new Date());
  const [showWhenPicker, setShowWhenPicker] = useState(false); // Android
  const [product, setProduct] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<Date | null>(null);
  const [showNextPicker, setShowNextPicker] = useState(false); // Android
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await addInteraction({
      agency_id: agencyId,
      customer_id: customerId,
      staff_id: staffId,
      staff_name: staffName,
      occurred_at: when.toISOString(),
      channel,
      location,
      location_note: location ? (locationNote.trim() || null) : null,
      product,
      outcome,
      note: note.trim() || null,
      next_action: nextAction,
      next_action_date: nextAction && nextDate ? toLocalISO(nextDate) : null,
    });
    setSaving(false);
    if (error) {
      errorHaptic();
      Alert.alert('Kaydedilemedi', error);
      return;
    }
    successHaptic();
    onSaved();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}>
            <Text style={styles.hCancel}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={styles.hTitle}>Görüşme Ekle</Text>
          <View style={styles.hBtn} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="İLETİŞİM TÜRÜ">
              <View style={styles.chipRow}>
                {CHANNELS.map((c) => (
                  <Chip key={c.key} on={channel === c.key} label={`${c.emoji} ${c.label}`} onPress={() => setChannel(c.key)} />
                ))}
              </View>
            </Field>

            <Field label="LOKASYON (OPSİYONEL)">
              <View style={styles.chipRow}>
                {LOCATIONS.map((l) => (
                  <Chip key={l.key} on={location === l.key} label={l.label} onPress={() => setLocation(location === l.key ? null : l.key)} />
                ))}
              </View>
              {location && (
                <TextInput
                  style={styles.input}
                  value={locationNote}
                  onChangeText={setLocationNote}
                  placeholder="Örn: Acıbadem Hastanesi B blok"
                  placeholderTextColor={Colors.placeholder}
                />
              )}
            </Field>

            <Field label="TARİH & SAAT">
              {Platform.OS === 'ios' ? (
                <View style={styles.dateRow}>
                  <DateTimePicker
                    value={when}
                    mode="datetime"
                    display="compact"
                    locale="tr-TR"
                    onChange={(_e, d) => { if (d) setWhen(d); }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.input} onPress={() => setShowWhenPicker(true)}>
                    <Text style={{ color: Colors.heading }}>
                      {when.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showWhenPicker && (
                    <DateTimePicker value={when} mode="date"
                      onChange={(_e, d) => { setShowWhenPicker(false); if (d) setWhen(d); }} />
                  )}
                </>
              )}
            </Field>

            <Field label="İLGİLİ ÜRÜN (OPSİYONEL)">
              <View style={styles.chipRow}>
                {INTERACTION_PRODUCTS.map((p) => (
                  <Chip key={p} on={product === p} label={p} onPress={() => setProduct(product === p ? null : p)} />
                ))}
              </View>
            </Field>

            <Field label="GÖRÜŞME SONUCU (OPSİYONEL)">
              <View style={styles.chipRow}>
                {OUTCOMES.map((o) => (
                  <Chip key={o.key} on={outcome === o.key} label={o.label} onPress={() => setOutcome(outcome === o.key ? null : o.key)} />
                ))}
              </View>
            </Field>

            <Field label="NOT (OPSİYONEL)">
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Ne konuşuldu? Fiyat itirazı, özel talep…"
                placeholderTextColor={Colors.placeholder}
                multiline
              />
            </Field>

            <Field label="SONRAKİ AKSİYON (OPSİYONEL)">
              <View style={styles.chipRow}>
                {NEXT_ACTIONS.map((n) => (
                  <Chip key={n.key} on={nextAction === n.key} label={`${n.emoji} ${n.label}`} onPress={() => setNextAction(nextAction === n.key ? null : n.key)} />
                ))}
              </View>
              {nextAction && (
                Platform.OS === 'ios' ? (
                  <View style={[styles.dateRow, { marginTop: 8 }]}>
                    <Text style={styles.dateHint}>Tarih</Text>
                    <DateTimePicker
                      value={nextDate ?? new Date()}
                      mode="date"
                      display="compact"
                      locale="tr-TR"
                      onChange={(_e, d) => { if (d) setNextDate(d); }}
                    />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity style={styles.input} onPress={() => setShowNextPicker(true)}>
                      <Text style={{ color: Colors.heading }}>
                        {nextDate ? nextDate.toLocaleDateString('tr-TR') : 'Tarih seç'}
                      </Text>
                    </TouchableOpacity>
                    {showNextPicker && (
                      <DateTimePicker value={nextDate ?? new Date()} mode="date"
                        onChange={(_e, d) => { setShowNextPicker(false); if (d) setNextDate(d); }} />
                    )}
                  </>
                )
              )}
            </Field>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Görüşmeyi Kaydet</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hBtn: { minWidth: 64 },
  hCancel: { ...Type.subhead, color: Colors.secondary },
  hTitle: { ...Type.heading, fontSize: 16 },

  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  fieldLabel: { ...Type.label, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  chipTextOn: { color: '#fff' },
  input: {
    marginTop: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.heading,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateHint: { ...Type.caption, color: Colors.secondary },
  saveBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
