/**
 * new-request.tsx
 * Yeni Talep Ekle — 2-adımlı teklif formu wizard
 *
 * Adım 1: Kategori + Ürün seçimi
 * Adım 2: Müşteri (mevcut seç / yeni oluştur) + ürüne özgü alanlar + kaydet
 *
 * Web'deki /teklif-al/[product] mantığıyla birebir eşleşir:
 *   - Müşteri → customers tablosuna insert
 *   - Talep   → requests tablosuna insert (status: Yeni)
 *   - Agency filtresi uygulanır (RLS kırılmaz)
 *   - Service role kullanılmaz
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import type { Customer } from '@/lib/types';

const W = Dimensions.get('window').width;

// ─── Inline product definitions (mirrors lib/insurance-products.ts) ───────────

type FieldType = 'text' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'radio' | 'checkbox';

type FieldDef = {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
};

type ProductDef = {
  slug: string;
  label: string;
  icon: string;
  description: string;
  fields: FieldDef[];
};

type CategoryDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  products: ProductDef[];
};

// ── Reusable field shorthands ─────────────────────────────────────────────────

const IL_OPTIONS = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya',
  'Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik',
  'Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum',
  'Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir',
  'Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul',
  'İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kırıkkale',
  'Kırklareli','Kırşehir','Kilis','Kocaeli','Konya','Kütahya','Malatya','Manisa',
  'Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize',
  'Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Şırnak','Sivas','Tekirdağ',
  'Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak',
].map((il) => ({ value: il, label: il }));

const YILLAR = Array.from({ length: 27 }, (_, i) => {
  const y = 2026 - i; return { value: String(y), label: String(y) };
});

const F = {
  TC:     { id: 'tc_vkn',       label: 'TC Kimlik / Vergi No',   type: 'text'   as FieldType, placeholder: '12345678901', required: true },
  IL:     { id: 'il',           label: 'İl',                      type: 'select' as FieldType, required: true, options: IL_OPTIONS },
  ILCE:   { id: 'ilce',         label: 'İlçe',                    type: 'text'   as FieldType, placeholder: 'Kadıköy', required: true },
  PLAKA:  { id: 'plaka',        label: 'Plaka',                   type: 'text'   as FieldType, placeholder: '34 ABC 123', required: true },
  DOGUM:  { id: 'dogum_tarihi', label: 'Doğum Tarihi',            type: 'date'   as FieldType, required: true },
  CIN:    { id: 'cinsiyet',     label: 'Cinsiyet',                type: 'radio'  as FieldType, required: true, options: [{ value: 'erkek', label: 'Erkek' }, { value: 'kadin', label: 'Kadın' }] },
  MARKA:  { id: 'marka_model',  label: 'Araç Marka / Model',      type: 'text'   as FieldType, placeholder: 'Toyota Corolla', required: true },
  YILI:   { id: 'arac_yili',    label: 'Araç Yılı',               type: 'select' as FieldType, required: true, options: YILLAR },
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'aracim', label: 'Aracım', icon: '🚗', color: Colors.primary,
    products: [
      {
        slug: 'trafik', label: 'Trafik Sigortası', icon: '🚦',
        description: 'Zorunlu trafik sigortasıyla üçüncü şahıslara verilen zararları güvence altına alın.',
        fields: [F.PLAKA, { id: 'ruhsat_seri', label: 'Ruhsat Seri No', type: 'text', placeholder: 'AA 000000', required: true }, F.TC],
      },
      {
        slug: 'kasko', label: 'Kasko', icon: '🛡️',
        description: 'Kaza, hırsızlık, yangın ve doğal afetlere karşı kapsamlı araç güvencesi.',
        fields: [F.PLAKA, F.MARKA, F.YILI, F.TC, { id: 'not', label: 'Ek Not', type: 'textarea', placeholder: 'Varsa ek bilgi...', optional: true }],
      },
      {
        slug: 'imm', label: 'İhtiyari Mali Mesuliyet', icon: '📋',
        description: 'Trafik sigortasının ötesinde güçlü maddi-manevi tazminat güvencesi.',
        fields: [F.PLAKA, F.MARKA, F.TC],
      },
      {
        slug: 'yesil-kart', label: 'Yeşil Kart', icon: '🌍',
        description: 'Yurt dışı seyahatlerinizde aracınızı güvence altına alın.',
        fields: [F.PLAKA, { id: 'gidilecek_ulkeler', label: 'Gidilecek Ülke(ler)', type: 'text', placeholder: 'Almanya, Fransa...', required: true }, { id: 'sure_gun', label: 'Poliçe Süresi (gün)', type: 'number', placeholder: '30', required: true }, F.TC],
      },
      {
        slug: 'elektrikli-kasko', label: 'Elektrikli Araç Kasko', icon: '⚡',
        description: "EV'ler için batarya ve şarj ekipmanı güvencesi dahil özel kasko.",
        fields: [F.PLAKA, { id: 'marka_model', label: 'Araç Marka / Model', type: 'text', placeholder: 'Tesla Model 3', required: true }, { id: 'arac_yili', label: 'Araç Yılı', type: 'select', required: true, options: Array.from({ length: 10 }, (_, i) => { const y = 2026 - i; return { value: String(y), label: String(y) }; }) }, F.TC],
      },
    ],
  },
  {
    id: 'sagligim', label: 'Sağlığım', icon: '🏥', color: Colors.success,
    products: [
      {
        slug: 'tamamlayici-saglik', label: 'Tamamlayıcı Sağlık', icon: '💊',
        description: 'SGK güvencenizi özel hastane ve ek teminatlarla destekleyin.',
        fields: [F.DOGUM, F.CIN, F.IL, { id: 'mevcut_hastalik', label: 'Mevcut Hastalık (isteğe bağlı)', type: 'textarea', placeholder: 'Varsa belirtiniz...', optional: true }],
      },
      {
        slug: 'ozel-saglik', label: 'Özel Sağlık Sigortası', icon: '🏨',
        description: 'Kapsamlı özel sağlık teminatıyla istediğiniz hastanede tedavi görün.',
        fields: [F.DOGUM, F.CIN, F.IL, { id: 'mevcut_hastalik', label: 'Mevcut Hastalık (isteğe bağlı)', type: 'textarea', placeholder: 'Varsa belirtiniz...', optional: true }],
      },
      {
        slug: 'seyahat-saglik', label: 'Seyahat Sağlık', icon: '✈️',
        description: 'Yurt dışı seyahatte acil sağlık masraflarınızı güvenceye alın.',
        fields: [
          { id: 'gidilecek_ulke', label: 'Gidilecek Ülke / Bölge', type: 'text', placeholder: 'Schengen Bölgesi / Almanya', required: true },
          { id: 'baslangic_tarihi', label: 'Seyahat Başlangıç Tarihi', type: 'date', required: true },
          { id: 'bitis_tarihi', label: 'Seyahat Bitiş Tarihi', type: 'date', required: true },
          { id: 'kisi_sayisi', label: 'Kişi Sayısı', type: 'number', placeholder: '1', required: true },
        ],
      },
    ],
  },
  {
    id: 'evim', label: 'Evim', icon: '🏠', color: Colors.warning,
    products: [
      {
        slug: 'dask', label: 'DASK', icon: '🏗️',
        description: 'Zorunlu deprem sigortasını zamanında yaptırın, konutunuzu güvenceye alın.',
        fields: [F.IL, F.ILCE, { id: 'adres', label: 'Adres', type: 'textarea', placeholder: 'Mahalle, cadde, sokak, bina no, daire no', required: true }, { id: 'bina_yasi', label: 'Bina Yaşı', type: 'number', placeholder: '15', required: true }, { id: 'daire_m2', label: 'Daire m²', type: 'number', placeholder: '90', required: true }, F.TC],
      },
      {
        slug: 'konut', label: 'Konut Sigortası', icon: '🏡',
        description: 'Evinizi yangın, hırsızlık, su baskını ve diğer risklere karşı koruyun.',
        fields: [
          F.IL, F.ILCE,
          { id: 'konut_tipi', label: 'Konut Tipi', type: 'select', required: true, options: [{ value: 'daire', label: 'Daire' }, { value: 'mustakil', label: 'Müstakil Ev' }, { value: 'villa', label: 'Villa' }, { value: 'isyeri', label: 'İşyeri' }] },
          { id: 'm2', label: 'Brüt m²', type: 'number', placeholder: '120', required: true },
          { id: 'esya_teminati', label: 'Eşya teminatı dahil edilsin mi?', type: 'radio', required: true, options: [{ value: 'evet', label: 'Evet' }, { value: 'hayir', label: 'Hayır' }] },
        ],
      },
      {
        slug: 'esyam-guvende', label: 'Eşyam Güvende', icon: '📦',
        description: 'Elektronik ve değerli eşyalarınızı hırsızlık ve kırılmaya karşı koruyun.',
        fields: [F.IL, { id: 'esya_turu', label: 'Eşya Türü', type: 'text', placeholder: 'Laptop, telefon, TV...', required: true }, { id: 'tahmini_deger', label: 'Tahmini Değer (TL)', type: 'number', placeholder: '25000', required: true }],
      },
    ],
  },
  {
    id: 'diger', label: 'Diğer', icon: '🛡️', color: '#7C3AED',
    products: [
      {
        slug: 'evcil-hayvan', label: 'Evcil Hayvan Sigortası', icon: '🐾',
        description: 'Evcil dostlarınız için veteriner masrafı güvencesi.',
        fields: [{ id: 'hayvan_turu', label: 'Hayvan Türü', type: 'text', placeholder: 'Köpek / Kedi', required: true }, { id: 'hayvan_cinsi', label: 'Irk / Cins', type: 'text', placeholder: 'Golden Retriever', required: true }, { id: 'yas', label: 'Hayvanın Yaşı (yıl)', type: 'number', placeholder: '3', required: true }],
      },
      {
        slug: 'cep-telefonu', label: 'Cep Telefonu Sigortası', icon: '📱',
        description: 'Telefonunuzu kırılma, çalınma ve su hasarına karşı güvence altına alın.',
        fields: [{ id: 'marka_model', label: 'Telefon Marka / Model', type: 'text', placeholder: 'iPhone 15 Pro', required: true }, { id: 'satin_alma_tarihi', label: 'Satın Alma Tarihi', type: 'date', required: true }, { id: 'fatura_degeri', label: 'Fatura Değeri (TL)', type: 'number', placeholder: '45000', required: true }],
      },
      {
        slug: 'ferdi-kaza', label: 'Ferdi Kaza Sigortası', icon: '🩺',
        description: 'Kaza sonucu oluşabilecek sakatlık, hastane ve vefat risklerini güvence altına alın.',
        fields: [F.DOGUM, F.CIN, { id: 'meslek', label: 'Meslek', type: 'text', placeholder: 'Öğretmen, Mühendis...', required: true }, F.TC],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNote(product: ProductDef, values: Record<string, string>): string {
  const skip = new Set(['name', 'phone', 'kvkk']);
  return product.fields
    .filter((f) => !skip.has(f.id) && values[f.id])
    .map((f) => `${f.label}: ${values[f.id]}`)
    .join('\n');
}

function isRequiredField(f: FieldDef) {
  return f.required && !f.optional;
}

// ─── SelectModal ──────────────────────────────────────────────────────────────

function SelectModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
        <View style={selectStyles.header}>
          <Text style={selectStyles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={selectStyles.closeBtn}>
            <Text style={selectStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        {options.length > 8 && (
          <View style={selectStyles.searchRow}>
            <TextInput
              style={selectStyles.searchInput}
              placeholder="Ara..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={Colors.secondary}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
        )}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[selectStyles.option, item.value === selected && selectStyles.optionSelected]}
              onPress={() => { onSelect(item.value); onClose(); }}
            >
              <Text style={[selectStyles.optionText, item.value === selected && selectStyles.optionTextSelected]}>
                {item.label}
              </Text>
              {item.value === selected && <Text style={selectStyles.checkmark}>✓</Text>}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const selectStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  title: { fontSize: 17, fontWeight: '700', color: Colors.heading },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 15, color: Colors.secondary, fontWeight: '700' },
  searchRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { backgroundColor: Colors.background, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.heading, borderWidth: 1, borderColor: Colors.border },
  option: { paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionSelected: { backgroundColor: Colors.primaryLight },
  optionText: { fontSize: 15, color: Colors.heading },
  optionTextSelected: { color: Colors.primary, fontWeight: '700' },
  checkmark: { fontSize: 16, color: Colors.primary, fontWeight: '800' },
});

// ─── FieldInput (mobile) ──────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const [selectVisible, setSelectVisible] = useState(false);

  const inputStyle = [
    fi.input,
    error ? fi.inputError : null,
  ];

  if (field.type === 'select') {
    const label = field.options?.find((o) => o.value === value)?.label ?? '';
    return (
      <>
        <TouchableOpacity
          style={[fi.selectBtn, error ? fi.inputError : null]}
          onPress={() => setSelectVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={label ? fi.selectBtnText : fi.selectBtnPlaceholder}>
            {label || 'Seçiniz...'}
          </Text>
          <Text style={fi.selectArrow}>▾</Text>
        </TouchableOpacity>
        <SelectModal
          visible={selectVisible}
          title={field.label}
          options={field.options ?? []}
          selected={value}
          onSelect={onChange}
          onClose={() => setSelectVisible(false)}
        />
      </>
    );
  }

  if (field.type === 'radio') {
    return (
      <View style={fi.radioRow}>
        {field.options?.map((o, i) => (
          <TouchableOpacity
            key={o.value}
            style={[fi.radioChip, value === o.value && fi.radioChipSelected, i > 0 ? { marginLeft: 8 } : {}]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[fi.radioChipText, value === o.value && fi.radioChipTextSelected]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (field.type === 'textarea') {
    return (
      <TextInput
        style={[inputStyle, fi.textarea]}
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={Colors.secondary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    );
  }

  return (
    <TextInput
      style={inputStyle}
      value={value}
      onChangeText={onChange}
      placeholder={field.type === 'date' ? 'YYYY-AA-GG' : field.placeholder}
      placeholderTextColor={Colors.secondary}
      keyboardType={field.type === 'number' ? 'numeric' : field.type === 'tel' ? 'phone-pad' : 'default'}
      autoCapitalize={field.id === 'plaka' ? 'characters' : 'words'}
    />
  );
}

const fi = StyleSheet.create({
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.heading,
  },
  inputError: { borderColor: Colors.danger },
  textarea: { height: 80, textAlignVertical: 'top' },
  selectBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBtnText: { fontSize: 15, color: Colors.heading, flex: 1 },
  selectBtnPlaceholder: { fontSize: 15, color: Colors.secondary, flex: 1 },
  selectArrow: { fontSize: 14, color: Colors.secondary, marginLeft: 8 },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap' },
  radioChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, marginBottom: 6 },
  radioChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  radioChipText: { fontSize: 14, fontWeight: '600', color: Colors.secondary },
  radioChipTextSelected: { color: '#fff' },
});

// ─── Step 1: Product Selection ────────────────────────────────────────────────

function ProductStep({ onSelect }: { onSelect: (p: ProductDef) => void }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const cat = CATEGORIES.find((c) => c.id === activeCategory)!;
  const prodW = (W - Spacing.lg * 2 - 12) / 2;

  return (
    <View style={{ flex: 1 }}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s1.catScroll} contentContainerStyle={s1.catRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[s1.catChip, activeCategory === c.id && { backgroundColor: c.color, borderColor: c.color }]}
            onPress={() => setActiveCategory(c.id)}
          >
            <Text style={s1.catIcon}>{c.icon}</Text>
            <Text style={[s1.catLabel, activeCategory === c.id && { color: '#fff' }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product grid */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s1.grid} showsVerticalScrollIndicator={false}>
        <View style={s1.gridWrap}>
          {cat.products.map((p, i) => (
            <TouchableOpacity
              key={p.slug}
              style={[s1.prodCard, { width: prodW }, i % 2 === 0 ? { marginRight: 12 } : {}]}
              onPress={() => onSelect(p)}
              activeOpacity={0.75}
            >
              <Text style={s1.prodIcon}>{p.icon}</Text>
              <Text style={s1.prodLabel}>{p.label}</Text>
              <Text style={s1.prodDesc} numberOfLines={2}>{p.description}</Text>
              <View style={s1.prodBtn}>
                <Text style={s1.prodBtnText}>Teklif Al →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s1 = StyleSheet.create({
  catScroll: { flexGrow: 0 },
  catRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, alignItems: 'center' },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, marginRight: 8 },
  catIcon: { fontSize: 16, marginRight: 6 },
  catLabel: { fontSize: 13, fontWeight: '700', color: Colors.heading },
  grid: { paddingHorizontal: Spacing.lg, paddingBottom: 60, paddingTop: Spacing.sm },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  prodCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  prodIcon: { fontSize: 32, marginBottom: 8 },
  prodLabel: { fontSize: 14, fontWeight: '800', color: Colors.heading, marginBottom: 4 },
  prodDesc: { fontSize: 11, color: Colors.secondary, lineHeight: 15, marginBottom: 12 },
  prodBtn: { backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingVertical: 6, alignItems: 'center' },
  prodBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
});

// ─── Step 2: Form (Customer + Product Fields) ─────────────────────────────────

function FormStep({
  product,
  agencyId,
  onSuccess,
}: {
  product: ProductDef;
  agencyId: string | null;
  onSuccess: () => void;
}) {
  // Customer mode
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Pick<Customer, 'id' | 'name' | 'phone'>[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Pick<Customer, 'id' | 'name' | 'phone'> | null>(null);

  // New customer fields
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Product-specific field values
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  // Product fields (excluding name/phone/kvkk since we handle those separately)
  const productFields = product.fields.filter((f) => !['name', 'phone', 'kvkk'].includes(f.id));

  async function searchCustomers(text: string) {
    setCustomerSearch(text);
    if (text.length < 2) { setCustomerResults([]); setShowSuggestions(false); return; }
    let q = (supabase.from('customers') as any).select('id, name, phone').ilike('name', `%${text}%`).limit(5);
    if (agencyId) q = q.eq('agency_id', agencyId);
    const { data } = await q;
    setCustomerResults(data ?? []);
    setShowSuggestions(true);
  }

  function setField(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
    if (errors[id]) setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (customerMode === 'existing' && !selectedCustomer) {
      errs._customer = 'Müşteri seçiniz.';
    }
    if (customerMode === 'new') {
      if (!newName.trim()) errs._name = 'Ad Soyad zorunludur.';
      if (!newPhone.trim()) errs._phone = 'Telefon numarası zorunludur.';
    }

    for (const f of productFields) {
      if (isRequiredField(f) && !values[f.id]?.trim()) {
        errs[f.id] = 'Bu alan zorunludur.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    try {
      let customerId: string;

      if (customerMode === 'existing' && selectedCustomer) {
        customerId = selectedCustomer.id;
      } else {
        // Build note from product fields
        const noteText = buildNote(product, values);

        const customerPayload: Record<string, unknown> = {
          name: newName.trim(),
          phone: newPhone.trim(),
          insurance_type: product.label,
          note: noteText || null,
          identity_no: values.tc_vkn?.trim() || null,
          vehicle_plate: values.plaka ? values.plaka.replace(/\s/g, '').toUpperCase() : null,
          extra_data: {},
        };
        if (agencyId) customerPayload.agency_id = agencyId;

        const { data: custData, error: custErr } = await (supabase.from('customers') as any)
          .insert(customerPayload)
          .select('id')
          .single();

        if (custErr) {
          Alert.alert('Hata', `Müşteri kaydı oluşturulamadı: ${custErr.message}`);
          setSaving(false);
          return;
        }
        customerId = custData.id;
      }

      // Insert request
      const requestPayload: Record<string, unknown> = {
        customer_id: customerId,
        request_type: product.label,
        status: 'Yeni Lead',
        price_offer: null,
      };
      if (agencyId) requestPayload.agency_id = agencyId;

      const { error: reqErr } = await (supabase.from('requests') as any).insert(requestPayload);

      if (reqErr) {
        Alert.alert('Hata', `Talep oluşturulamadı: ${reqErr.message}`);
        setSaving(false);
        return;
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Hata', `Beklenmeyen hata: ${msg}`);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s2.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Product badge */}
        <View style={s2.productBadge}>
          <Text style={s2.productIcon}>{product.icon}</Text>
          <View>
            <Text style={s2.productLabel}>{product.label}</Text>
            <Text style={s2.productDesc}>{product.description}</Text>
          </View>
        </View>

        {/* ── Customer section ───────────────────────────────────────────── */}
        <View style={s2.section}>
          <Text style={s2.sectionTitle}>Müşteri</Text>

          {/* Mode toggle */}
          <View style={s2.modeRow}>
            <TouchableOpacity
              style={[s2.modeBtn, customerMode === 'existing' && s2.modeBtnActive]}
              onPress={() => { setCustomerMode('existing'); setSelectedCustomer(null); setCustomerSearch(''); }}
            >
              <Text style={[s2.modeBtnText, customerMode === 'existing' && s2.modeBtnTextActive]}>Mevcut Müşteri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s2.modeBtn, customerMode === 'new' && s2.modeBtnActive]}
              onPress={() => setCustomerMode('new')}
            >
              <Text style={[s2.modeBtnText, customerMode === 'new' && s2.modeBtnTextActive]}>Yeni Müşteri</Text>
            </TouchableOpacity>
          </View>

          {errors._customer ? <Text style={s2.fieldError}>{errors._customer}</Text> : null}

          {customerMode === 'existing' ? (
            selectedCustomer ? (
              <TouchableOpacity
                style={s2.selectedCustomer}
                onPress={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
              >
                <View style={s2.selectedCustLeft}>
                  <Text style={s2.selectedCustName}>{selectedCustomer.name}</Text>
                  <Text style={s2.selectedCustPhone}>{selectedCustomer.phone}</Text>
                </View>
                <Text style={s2.selectedCustChange}>Değiştir ×</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <TextInput
                  style={[fi.input, errors._customer ? fi.inputError : null]}
                  placeholder="Müşteri adı ile ara..."
                  value={customerSearch}
                  onChangeText={searchCustomers}
                  placeholderTextColor={Colors.secondary}
                />
                {showSuggestions && customerResults.length > 0 && (
                  <View style={s2.suggestions}>
                    {customerResults.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={s2.suggestion}
                        onPress={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowSuggestions(false); if (errors._customer) setErrors((p) => { const n = { ...p }; delete n._customer; return n; }); }}
                      >
                        <Text style={s2.suggestionName}>{c.name}</Text>
                        <Text style={s2.suggestionPhone}>{c.phone}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {showSuggestions && customerResults.length === 0 && customerSearch.length >= 2 && (
                  <View style={s2.noResults}>
                    <Text style={s2.noResultsText}>Sonuç bulunamadı — "Yeni Müşteri" ile oluşturun</Text>
                  </View>
                )}
              </View>
            )
          ) : (
            <View>
              <Text style={s2.fieldLabel}>Ad Soyad *</Text>
              <TextInput
                style={[fi.input, errors._name ? fi.inputError : null]}
                placeholder="Ahmet Yılmaz"
                value={newName}
                onChangeText={(v) => { setNewName(v); if (errors._name) setErrors((p) => { const n = { ...p }; delete n._name; return n; }); }}
                placeholderTextColor={Colors.secondary}
              />
              {errors._name ? <Text style={s2.fieldError}>{errors._name}</Text> : null}

              <Text style={[s2.fieldLabel, { marginTop: 12 }]}>Cep Telefonu *</Text>
              <TextInput
                style={[fi.input, errors._phone ? fi.inputError : null]}
                placeholder="0532 123 45 67"
                value={newPhone}
                onChangeText={(v) => { setNewPhone(v); if (errors._phone) setErrors((p) => { const n = { ...p }; delete n._phone; return n; }); }}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.secondary}
              />
              {errors._phone ? <Text style={s2.fieldError}>{errors._phone}</Text> : null}
            </View>
          )}
        </View>

        {/* ── Product-specific fields ────────────────────────────────────── */}
        {productFields.length > 0 && (
          <View style={s2.section}>
            <Text style={s2.sectionTitle}>Sigorta Bilgileri</Text>

            {productFields.map((f) => (
              <View key={f.id} style={{ marginBottom: 14 }}>
                <Text style={s2.fieldLabel}>
                  {f.label}
                  {f.optional ? <Text style={s2.optionalLabel}> (isteğe bağlı)</Text> : ''}
                  {isRequiredField(f) ? <Text style={{ color: Colors.danger }}> *</Text> : ''}
                </Text>
                {f.hint ? <Text style={s2.fieldHint}>{f.hint}</Text> : null}
                <FieldInput
                  field={f}
                  value={values[f.id] ?? ''}
                  error={errors[f.id]}
                  onChange={(v) => setField(f.id, v)}
                />
                {errors[f.id] ? <Text style={s2.fieldError}>⚠ {errors[f.id]}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s2.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s2.submitBtnText}>Talebi Kaydet →</Text>
          )}
        </TouchableOpacity>

        <Text style={s2.trustNote}>🔒 Verileriniz güvenli şekilde işlenmektedir</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s2 = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: 60 },
  productBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: 14, marginBottom: 16 },
  productIcon: { fontSize: 36, marginRight: 14 },
  productLabel: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  productDesc: { fontSize: 12, color: Colors.primary, opacity: 0.8, marginTop: 2, maxWidth: W - 120 },
  section: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  modeRow: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: Radius.md, padding: 3, marginBottom: 14 },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: Colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  modeBtnTextActive: { color: Colors.heading },
  selectedCustomer: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectedCustLeft: {},
  selectedCustName: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  selectedCustPhone: { fontSize: 12, color: Colors.primary, opacity: 0.8, marginTop: 2 },
  selectedCustChange: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  suggestions: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden' },
  suggestion: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionName: { fontSize: 14, fontWeight: '600', color: Colors.heading },
  suggestionPhone: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  noResults: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  noResultsText: { fontSize: 13, color: Colors.secondary, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading, marginBottom: 6 },
  optionalLabel: { fontWeight: '400', color: Colors.secondary },
  fieldHint: { fontSize: 11, color: Colors.secondary, marginBottom: 6 },
  fieldError: { fontSize: 12, color: Colors.danger, marginTop: 4, fontWeight: '500' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  trustNote: { textAlign: 'center', fontSize: 11, color: Colors.secondary, marginTop: 12 },
});

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ product, onDone }: { product: ProductDef; onDone: () => void }) {
  return (
    <View style={suc.container}>
      <View style={suc.card}>
        <Text style={suc.checkEmoji}>✅</Text>
        <Text style={suc.title}>Talep Oluşturuldu!</Text>
        <Text style={suc.subtitle}>
          <Text style={{ fontWeight: '700', color: Colors.primary }}>{product.label}</Text>
          {' '}talebi başarıyla kaydedildi. Talepler ekranında görüntüleyebilirsiniz.
        </Text>
        <TouchableOpacity style={suc.btn} onPress={onDone}>
          <Text style={suc.btnText}>Talepler Ekranına Git</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const suc = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl, alignSelf: 'stretch', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  checkEmoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.heading, marginBottom: 10 },
  subtitle: { fontSize: 14, color: Colors.secondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Step = 'product' | 'form' | 'success';

export default function NewRequestScreen() {
  const router = useRouter();
  const { agencyId } = useProfile();
  const [step, setStep] = useState<Step>('product');
  const [selectedProduct, setSelectedProduct] = useState<ProductDef | null>(null);

  function handleProductSelect(p: ProductDef) {
    setSelectedProduct(p);
    setStep('form');
  }

  function handleBack() {
    if (step === 'form') { setStep('product'); }
    else { router.back(); }
  }

  function handleSuccess() {
    setStep('success');
  }

  function handleDone() {
    router.replace('/(tabs)/requests');
  }

  const headerTitle =
    step === 'product' ? 'Sigorta Türü Seç' :
    step === 'form'    ? (selectedProduct?.label ?? 'Teklif Formu') :
    'Talep Oluşturuldu';

  return (
    <SafeAreaView style={ms.safe} edges={['top']}>
      {/* Header */}
      {step !== 'success' && (
        <View style={ms.header}>
          <TouchableOpacity style={ms.backBtn} onPress={handleBack}>
            <Text style={ms.backBtnText}>‹ Geri</Text>
          </TouchableOpacity>
          <Text style={ms.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <View style={{ width: 60 }} />
        </View>
      )}

      {/* Steps */}
      {step === 'product' && (
        <ProductStep onSelect={handleProductSelect} />
      )}

      {step === 'form' && selectedProduct && (
        <FormStep
          product={selectedProduct}
          agencyId={agencyId}
          onSuccess={handleSuccess}
        />
      )}

      {step === 'success' && selectedProduct && (
        <SuccessScreen product={selectedProduct} onDone={handleDone} />
      )}
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4, minWidth: 60 },
  backBtnText: { fontSize: 17, color: Colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.heading, flex: 1, textAlign: 'center' },
});
