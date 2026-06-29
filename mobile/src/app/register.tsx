/**
 * Kayıt ekranı — web app/register/page.tsx'in mobil karşılığı (yeni acente akışı).
 * supabase.auth.signUp metadata ile (agency_name/slug/phone + full_name) → trigger
 * acente + profil oluşturur. Davet modu (invite) v1'de yok; sonra eklenebilir.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** signUp sonucu: identities===[] → e-posta zaten kayıtlı; session var → anında giriş. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function interpretSignUp(data: any): { duplicate: boolean; autoSignedIn: boolean } {
  const identities = data?.user?.identities;
  const duplicate = Array.isArray(identities) && identities.length === 0;
  return { duplicate, autoSignedIn: Boolean(data?.session) };
}

const DUPLICATE_MSG = 'Bu e-posta zaten kayıtlı. Lütfen giriş yapın veya şifrenizi sıfırlayın.';

export default function RegisterScreen() {
  const router = useRouter();

  const [agencyName, setAgencyName] = useState('');
  const [agencySlug, setAgencySlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [agencyPhone, setAgencyPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [autoSignedIn, setAutoSignedIn] = useState(false);
  const [finalSlug, setFinalSlug] = useState('');

  function handleAgencyName(val: string) {
    setAgencyName(val);
    if (!slugEdited) setAgencySlug(slugify(val));
  }
  function handleSlug(val: string) {
    setSlugEdited(true);
    setAgencySlug(slugify(val) || val.toLowerCase());
  }

  async function handleSubmit() {
    if (!agencyName.trim()) { setError('Acente adı zorunludur.'); return; }
    if (!agencySlug.trim()) { setError('Acente bağlantısı zorunludur.'); return; }
    const phoneDigits = agencyPhone.replace(/\D/g, '');
    const trPhoneOk = /^(90)?0?5\d{9}$/.test(phoneDigits) || /^(90)?0?[2348]\d{9}$/.test(phoneDigits);
    if (!phoneDigits) { setError('Telefon numarası zorunludur.'); return; }
    if (!trPhoneOk) { setError('Geçerli bir Türkiye telefon numarası girin (örn. 0532 123 45 67).'); return; }
    if (!fullName.trim()) { setError('Ad Soyad zorunludur.'); return; }
    if (!email.trim()) { setError('E-posta zorunludur.'); return; }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }

    setError(''); setLoading(true);

    // Slug benzersizlik kontrolü
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('agencies') as any)
      .select('id').eq('slug', agencySlug.trim()).maybeSingle();
    if (existing) {
      setError('Bu acente bağlantısı kullanımda. Lütfen farklı bir isim seçin.');
      setLoading(false); return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          agency_name: agencyName.trim(),
          agency_slug: agencySlug.trim(),
          agency_phone: agencyPhone.trim() || null,
        },
      },
    });
    if (authError) { setError(authError.message); setLoading(false); return; }

    const { duplicate, autoSignedIn: auto } = interpretSignUp(data);
    if (duplicate) { setError(DUPLICATE_MSG); setLoading(false); return; }

    setAutoSignedIn(auto);
    setFinalSlug(agencySlug.trim());
    setDone(true);
    setLoading(false);
  }

  // ─── Başarı ekranı ───
  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}><Text style={{ fontSize: 34 }}>✅</Text></View>
          <Text style={styles.successTitle}>Hesabınız Oluşturuldu!</Text>
          <Text style={styles.successSub}>
            {autoSignedIn
              ? 'Hesabınız hazır — devam edip telefonunuzu doğrulayın.'
              : `${email} adresine doğrulama linki gönderildi. Linke tıklayıp aktive ettikten sonra giriş yapabilirsiniz. (Gelmediyse spam/gereksiz klasörünü kontrol edin.)`}
          </Text>

          {!!finalSlug && (
            <View style={styles.linkBox}>
              <Text style={styles.linkLabel}>MÜŞTERİ TEKLİF LİNKİNİZ</Text>
              <Text style={styles.linkUrl}>sigortaos.com/a/{finalSlug}/teklif-al</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace(autoSignedIn ? '/(tabs)' : '/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{autoSignedIn ? 'Devam Et' : 'Giriş Yap'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Form ───
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logoImg} resizeMode="contain" />
            <Text style={styles.appName}>Sigorta<Text style={styles.appNameAccent}>OS</Text></Text>
            <Text style={styles.tagline}>Ücretsiz başlayın — dakikalar içinde</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acentenizi Oluşturun</Text>

            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

            {/* Acente bilgileri */}
            <Text style={styles.sectionLabel}>ACENTE BİLGİLERİ</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Acente Adı *</Text>
              <TextInput style={styles.input} placeholder="Örn: Atlas Sigorta" placeholderTextColor={Colors.secondary}
                value={agencyName} onChangeText={handleAgencyName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Acente Bağlantısı *</Text>
              <View style={styles.slugRow}>
                <View style={styles.slugPrefix}><Text style={styles.slugPrefixText}>/a/</Text></View>
                <TextInput style={styles.slugInput} placeholder="atlas-sigorta" placeholderTextColor={Colors.secondary}
                  value={agencySlug} onChangeText={handleSlug} autoCapitalize="none" />
              </View>
              {!!agencySlug && <Text style={styles.slugHint}>sigortaos.com/a/{agencySlug}/teklif-al</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefon *</Text>
              <TextInput style={styles.input} placeholder="0532 123 45 67" placeholderTextColor={Colors.secondary}
                value={agencyPhone} onChangeText={setAgencyPhone} keyboardType="phone-pad" />
              <Text style={styles.fieldHint}>Günlük WhatsApp özetleri bu numaraya gönderilir.</Text>
            </View>

            {/* Yetkili bilgileri */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.sm }]}>YETKİLİ BİLGİLERİ</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ad Soyad *</Text>
              <TextInput style={styles.input} placeholder="Ahmet Yılmaz" placeholderTextColor={Colors.secondary}
                value={fullName} onChangeText={setFullName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-posta *</Text>
              <TextInput style={styles.input} placeholder="ornek@acente.com" placeholderTextColor={Colors.secondary}
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Şifre *</Text>
              <View style={styles.pwdRow}>
                <TextInput style={styles.pwdInput} placeholder="En az 6 karakter" placeholderTextColor={Colors.secondary}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPwd} autoComplete="password-new" />
                <TouchableOpacity onPress={() => setShowPwd((v) => !v)} style={styles.pwdToggle}>
                  <Text style={styles.pwdToggleText}>{showPwd ? 'Gizle' : 'Göster'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Acentemi Oluştur</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerLink} onPress={() => router.replace('/login')}>
              <Text style={styles.footerLinkText}>Hesabın var mı? <Text style={styles.footerLinkBold}>Giriş Yap</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },

  logoArea: { alignItems: 'center', marginBottom: Spacing.lg },
  logoImg: { width: 68, height: 68, borderRadius: 18, marginBottom: Spacing.sm },
  appName: { fontSize: 26, fontWeight: '800', color: Colors.heading, letterSpacing: -0.5 },
  appNameAccent: { color: Colors.primary },
  tagline: { fontSize: 14, color: Colors.secondary, marginTop: 4 },

  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: Colors.heading, marginBottom: Spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.8, marginBottom: Spacing.sm },

  errorBox: { backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.danger, fontSize: 14 },

  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: Colors.heading, marginBottom: Spacing.xs },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 13, fontSize: 15, color: Colors.heading, backgroundColor: Colors.background },
  fieldHint: { fontSize: 11, color: Colors.secondary, marginTop: 5 },

  slugRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.background },
  slugPrefix: { paddingHorizontal: 12, paddingVertical: 13, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
  slugPrefixText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },
  slugInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, color: Colors.heading },
  slugHint: { fontSize: 11, color: Colors.secondary, marginTop: 5 },

  pwdRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background },
  pwdInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: 13, fontSize: 15, color: Colors.heading },
  pwdToggle: { paddingHorizontal: 14, paddingVertical: 13 },
  pwdToggleText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  button: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footerLink: { marginTop: Spacing.md, alignItems: 'center', paddingVertical: 8 },
  footerLinkText: { fontSize: 13, color: Colors.secondary },
  footerLinkBold: { color: Colors.primary, fontWeight: '700' },

  // Başarı
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.heading, marginBottom: 8 },
  successSub: { fontSize: 14, color: Colors.secondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  linkBox: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg, alignSelf: 'stretch' },
  linkLabel: { fontSize: 10, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.6, marginBottom: 6 },
  linkUrl: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
