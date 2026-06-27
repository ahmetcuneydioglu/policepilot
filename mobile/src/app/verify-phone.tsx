/**
 * Telefon Doğrulama (OTP) ekranı — Security Center Faz 1.
 * Açılışta otomatik kod gönderir; 6 kutulu giriş (iOS otomatik doldurma), 60 sn
 * geri sayımlı "Tekrar Gönder", 6 hane girilince otomatik doğrulama. Başarıda
 * gate (kök layout) tetiklenir → /(tabs). Yanlış hesapsa "Çıkış Yap".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/security';
import { notifyPhoneVerified } from '@/lib/securityState';
import { ApiError } from '@/lib/api';

const OTP_LEN = 6;
const RESEND_SECONDS = 60;

export default function VerifyPhoneScreen() {
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'call' | ''>('');
  const inputRef = useRef<TextInput>(null);

  // ─── Kod gönder ───
  const send = useCallback(async () => {
    setError(''); setSending(true);
    try {
      const res = await sendPhoneOtp();
      if (res.meta?.phoneMasked) setMasked(res.meta.phoneMasked);
      setChannel(res.meta?.channel ?? '');
      setDevCode(res.meta?.devCode ?? ''); // yalnız Mock'ta dolu
      setCountdown(RESEND_SECONDS);
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (e) {
      setError(errMessage(e));
    } finally { setSending(false); }
  }, []);

  // Açılışta otomatik gönder (1 kez)
  useEffect(() => { send(); }, [send]);

  // Geri sayım
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // ─── Doğrula (6 hane girilince otomatik) ───
  const verify = useCallback(async (value: string) => {
    setVerifying(true); setError('');
    try {
      const res = await verifyPhoneOtp(value);
      if (res.verified) {
        notifyPhoneVerified(); // gate açılır → /(tabs)
        return;
      }
      setError('Kod doğrulanamadı.');
    } catch (e) {
      setError(errMessage(e));
      setCode('');
    } finally { setVerifying(false); }
  }, []);

  function onChange(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, OTP_LEN);
    setCode(digits);
    if (error) setError('');
    if (digits.length === OTP_LEN) verify(digits);
  }

  async function signOut() { await supabase.auth.signOut(); }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.iconCircle}><Text style={styles.iconText}>🔐</Text></View>
          <Text style={styles.title}>Telefon Doğrulama</Text>
          <Text style={styles.subtitle}>
            {masked ? `${masked} numaranıza` : 'Telefonunuza'}{' '}
            {channel === 'whatsapp' ? 'WhatsApp ile ' : channel === 'sms' ? 'SMS ile ' : ''}
            gönderdiğimiz 6 haneli kodu girin.
          </Text>

          {devCode ? (
            <TouchableOpacity style={styles.devBanner} onPress={() => onChange(devCode)} activeOpacity={0.7}>
              <Text style={styles.devBannerText}>🧪 Test modu (Mock) — kod: <Text style={styles.devBannerCode}>{devCode}</Text></Text>
              <Text style={styles.devBannerHint}>Otomatik doldurmak için dokun</Text>
            </TouchableOpacity>
          ) : null}

          {/* 6 kutu (tek gizli input ile sürülür) */}
          <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LEN }).map((_, i) => {
              const ch = code[i] ?? '';
              const active = i === code.length;
              return (
                <View key={i} style={[styles.box, (ch || active) && styles.boxActive, error ? styles.boxError : null]}>
                  <Text style={styles.boxText}>{ch}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LEN}
            editable={!verifying}
            autoFocus
            style={styles.hiddenInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : <View style={{ height: 18 }} />}

          {verifying ? (
            <View style={styles.statusRow}><ActivityIndicator color={Colors.primary} /><Text style={styles.statusText}>Doğrulanıyor…</Text></View>
          ) : (
            <TouchableOpacity
              disabled={countdown > 0 || sending}
              onPress={send}
              style={styles.resendBtn}
            >
              {sending ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                  {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Kodu tekrar gönder'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={signOut} style={styles.signOut}>
            <Text style={styles.signOutText}>Farklı hesap · Çıkış yap</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function errMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Oturum doğrulanamadı. Sunucu güncellemesi yayınlanmamış olabilir.';
    return e.message || 'Bir hata oluştu.';
  }
  return e instanceof Error ? e.message : 'Bir hata oluştu.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },

  iconCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  iconText: { fontSize: 32 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: Colors.secondary, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 },

  devBanner: { backgroundColor: Colors.amberBg, borderColor: '#FCD34D', borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 16, marginTop: Spacing.md, alignItems: 'center' },
  devBannerText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  devBannerCode: { fontWeight: '900', letterSpacing: 2, fontSize: 15, color: '#92400E' },
  devBannerHint: { fontSize: 11, color: '#B45309', marginTop: 2 },

  boxes: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  box: { width: 46, height: 56, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: Colors.primary },
  boxError: { borderColor: Colors.danger },
  boxText: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  error: { color: Colors.danger, fontSize: 13, marginTop: 14, textAlign: 'center', minHeight: 18 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md },
  statusText: { color: Colors.secondary, fontSize: 14 },

  resendBtn: { marginTop: Spacing.md, paddingVertical: 10, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  resendText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  resendDisabled: { color: Colors.placeholder },

  signOut: { marginTop: Spacing.xl, paddingVertical: 8 },
  signOutText: { color: Colors.secondary, fontSize: 13 },
});
