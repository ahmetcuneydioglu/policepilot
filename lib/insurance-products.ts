// Shared insurance product & category definitions
// Used by landing page, category selector, and form pages.

export type FieldType = "text" | "tel" | "number" | "date" | "select" | "textarea" | "radio" | "checkbox";

export type FieldDef = {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

export type ProductDef = {
  slug: string;
  label: string;
  categoryId: string;
  icon: string;
  description: string;
  fields: FieldDef[];
};

export type CategoryDef = {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string; // tailwind color name e.g. "blue"
  products: ProductDef[];
};

// ─── Turkish provinces ────────────────────────────────────────────────────────
const IL_OPTIONS = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya",
  "Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik",
  "Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum",
  "Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir",
  "Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul",
  "İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kırıkkale",
  "Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa",
  "Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize",
  "Sakarya","Samsun","Şanlıurfa","Siirt","Sinop","Şırnak","Sivas","Tekirdağ",
  "Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak",
].map((il) => ({ value: il, label: il }));

// ─── Reusable fields ──────────────────────────────────────────────────────────
const NAME_F: FieldDef = { id: "name", label: "Ad Soyad", type: "text", placeholder: "Ahmet Yılmaz", required: true };
const PHONE_F: FieldDef = { id: "phone", label: "Cep Telefonu", type: "tel", placeholder: "0532 123 45 67", required: true };
const TC_F: FieldDef = { id: "tc_vkn", label: "TC Kimlik / Vergi Kimlik No", type: "text", placeholder: "12345678901", required: true };
const IL_F: FieldDef = { id: "il", label: "İl", type: "select", required: true, options: IL_OPTIONS };
const ILCE_F: FieldDef = { id: "ilce", label: "İlçe", type: "text", placeholder: "Kadıköy", required: true };
const PLAKA_F: FieldDef = { id: "plaka", label: "Plaka", type: "text", placeholder: "34 ABC 123", required: true };
const KVKK_F: FieldDef = {
  id: "kvkk",
  label: "Kişisel verilerimin işlenmesine ve sigorta teklifi amacıyla iletişime geçilmesine onay veriyorum. (KVKK Aydınlatma Metni)",
  type: "checkbox",
  required: true,
};
const DOGUM_F: FieldDef = { id: "dogum_tarihi", label: "Doğum Tarihi", type: "date", required: true };
const CINSIYET_F: FieldDef = {
  id: "cinsiyet", label: "Cinsiyet", type: "radio", required: true,
  options: [{ value: "erkek", label: "Erkek" }, { value: "kadin", label: "Kadın" }],
};
const MARKA_MODEL_F: FieldDef = { id: "marka_model", label: "Araç Marka / Model", type: "text", placeholder: "Toyota Corolla", required: true };
const ARAC_YILI_F: FieldDef = {
  id: "arac_yili", label: "Araç Yılı", type: "select", required: true,
  options: Array.from({ length: 27 }, (_, i) => { const y = 2026 - i; return { value: String(y), label: String(y) }; }),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES: CategoryDef[] = [
  {
    id: "aracim",
    label: "Aracım",
    icon: "🚗",
    description: "Trafik, kasko ve araç güvencesi",
    color: "blue",
    products: [
      {
        slug: "trafik",
        label: "Trafik Sigortası",
        categoryId: "aracim",
        icon: "🚦",
        description: "Zorunlu trafik sigortasıyla üçüncü şahıslara verilen maddi/manevi zararları güvence altına alın.",
        fields: [NAME_F, PHONE_F, PLAKA_F,
          { id: "ruhsat_seri", label: "Ruhsat Seri No", type: "text", placeholder: "AA 000000", required: true },
          TC_F, KVKK_F],
      },
      {
        slug: "kasko",
        label: "Kasko",
        categoryId: "aracim",
        icon: "🛡️",
        description: "Kaza, hırsızlık, yangın ve doğal afetlere karşı kapsamlı araç güvencesi.",
        fields: [NAME_F, PHONE_F, PLAKA_F, MARKA_MODEL_F, ARAC_YILI_F, TC_F,
          { id: "not", label: "Ek Not (isteğe bağlı)", type: "textarea", placeholder: "Varsa ek bilgi...", optional: true },
          KVKK_F],
      },
      {
        slug: "imm",
        label: "İhtiyari Mali Mesuliyet",
        categoryId: "aracim",
        icon: "📋",
        description: "Trafik sigortasının ötesinde güçlü maddi-manevi tazminat güvencesi.",
        fields: [NAME_F, PHONE_F, PLAKA_F, MARKA_MODEL_F, TC_F, KVKK_F],
      },
      {
        slug: "yesil-kart",
        label: "Yeşil Kart",
        categoryId: "aracim",
        icon: "🌍",
        description: "Yurt dışı seyahatlerinizde aracınızı güvence altına alın.",
        fields: [NAME_F, PHONE_F, PLAKA_F,
          { id: "gidilecek_ulkeler", label: "Gidilecek Ülke(ler)", type: "text", placeholder: "Almanya, Fransa...", required: true },
          { id: "sure_gun", label: "Poliçe Süresi (gün)", type: "number", placeholder: "30", required: true },
          TC_F, KVKK_F],
      },
      {
        slug: "elektrikli-kasko",
        label: "Elektrikli Araç Kasko",
        categoryId: "aracim",
        icon: "⚡",
        description: "EV'ler için batarya ve şarj ekipmanı güvencesi dahil özel kasko.",
        fields: [NAME_F, PHONE_F, PLAKA_F,
          { id: "marka_model", label: "Araç Marka / Model", type: "text", placeholder: "Tesla Model 3", required: true },
          {
            id: "arac_yili", label: "Araç Yılı", type: "select", required: true,
            options: Array.from({ length: 10 }, (_, i) => { const y = 2026 - i; return { value: String(y), label: String(y) }; }),
          },
          TC_F, KVKK_F],
      },
    ],
  },
  {
    id: "sagligim",
    label: "Sağlığım",
    icon: "🏥",
    description: "Sağlık ve seyahat güvencesi",
    color: "emerald",
    products: [
      {
        slug: "tamamlayici-saglik",
        label: "Tamamlayıcı Sağlık",
        categoryId: "sagligim",
        icon: "💊",
        description: "SGK güvencenizi özel hastane ve ek teminatlarla destekleyin.",
        fields: [NAME_F, PHONE_F, DOGUM_F, CINSIYET_F, IL_F,
          { id: "mevcut_hastalik", label: "Mevcut Hastalık / Kronik Durum (isteğe bağlı)", type: "textarea", placeholder: "Varsa belirtiniz...", optional: true },
          KVKK_F],
      },
      {
        slug: "ozel-saglik",
        label: "Özel Sağlık Sigortası",
        categoryId: "sagligim",
        icon: "🏨",
        description: "Kapsamlı özel sağlık teminatıyla istediğiniz hastanede tedavi görün.",
        fields: [NAME_F, PHONE_F, DOGUM_F, CINSIYET_F, IL_F,
          { id: "mevcut_hastalik", label: "Mevcut Hastalık / Kronik Durum (isteğe bağlı)", type: "textarea", placeholder: "Varsa belirtiniz...", optional: true },
          KVKK_F],
      },
      {
        slug: "seyahat-saglik",
        label: "Seyahat Sağlık",
        categoryId: "sagligim",
        icon: "✈️",
        description: "Yurt dışı seyahatte acil sağlık masraflarınızı güvenceye alın.",
        fields: [NAME_F, PHONE_F,
          { id: "gidilecek_ulke", label: "Gidilecek Ülke / Bölge", type: "text", placeholder: "Schengen Bölgesi / Almanya", required: true },
          { id: "baslangic_tarihi", label: "Seyahat Başlangıç Tarihi", type: "date", required: true },
          { id: "bitis_tarihi", label: "Seyahat Bitiş Tarihi", type: "date", required: true },
          { id: "kisi_sayisi", label: "Kişi Sayısı", type: "number", placeholder: "1", required: true },
          KVKK_F],
      },
    ],
  },
  {
    id: "evim",
    label: "Evim",
    icon: "🏠",
    description: "Konut ve ev güvencesi",
    color: "amber",
    products: [
      {
        slug: "dask",
        label: "DASK",
        categoryId: "evim",
        icon: "🏗️",
        description: "Zorunlu deprem sigortasını zamanında yaptırın, konutunuzu güvenceye alın.",
        fields: [NAME_F, PHONE_F, IL_F, ILCE_F,
          { id: "adres", label: "Adres", type: "textarea", placeholder: "Mahalle, cadde, sokak, bina no, daire no", required: true },
          { id: "bina_yasi", label: "Bina Yaşı", type: "number", placeholder: "15", required: true },
          { id: "daire_m2", label: "Daire m²", type: "number", placeholder: "90", required: true },
          TC_F, KVKK_F],
      },
      {
        slug: "konut",
        label: "Konut Sigortası",
        categoryId: "evim",
        icon: "🏡",
        description: "Evinizi yangın, hırsızlık, su baskını ve diğer risklere karşı koruyun.",
        fields: [NAME_F, PHONE_F, IL_F, ILCE_F,
          {
            id: "konut_tipi", label: "Konut Tipi", type: "select", required: true,
            options: [
              { value: "daire", label: "Daire" },
              { value: "mustakil", label: "Müstakil Ev" },
              { value: "villa", label: "Villa" },
              { value: "isyeri", label: "İşyeri" },
            ],
          },
          { id: "m2", label: "Brüt m²", type: "number", placeholder: "120", required: true },
          {
            id: "esya_teminati", label: "Eşya teminatı da dahil edilsin mi?", type: "radio", required: true,
            options: [{ value: "evet", label: "Evet" }, { value: "hayir", label: "Hayır" }],
          },
          KVKK_F],
      },
      {
        slug: "esyam-guvende",
        label: "Eşyam Güvende",
        categoryId: "evim",
        icon: "📦",
        description: "Elektronik ve değerli eşyalarınızı hırsızlık ve kırılmaya karşı koruyun.",
        fields: [NAME_F, PHONE_F, IL_F,
          { id: "esya_turu", label: "Sigortalanacak Eşya Türü", type: "text", placeholder: "Laptop, telefon, TV...", required: true },
          { id: "tahmini_deger", label: "Tahmini Değer (TL)", type: "number", placeholder: "25000", required: true },
          KVKK_F],
      },
    ],
  },
  {
    id: "diger",
    label: "Diğer",
    icon: "🛡️",
    description: "Diğer sigorta çözümleri",
    color: "purple",
    products: [
      {
        slug: "evcil-hayvan",
        label: "Evcil Hayvan Sigortası",
        categoryId: "diger",
        icon: "🐾",
        description: "Evcil dostlarınız için veteriner masrafı güvencesi.",
        fields: [NAME_F, PHONE_F,
          { id: "hayvan_turu", label: "Hayvan Türü", type: "text", placeholder: "Köpek / Kedi", required: true },
          { id: "hayvan_cinsi", label: "Irk / Cins", type: "text", placeholder: "Golden Retriever", required: true },
          { id: "yas", label: "Hayvanın Yaşı (yıl)", type: "number", placeholder: "3", required: true },
          KVKK_F],
      },
      {
        slug: "cep-telefonu",
        label: "Cep Telefonu Sigortası",
        categoryId: "diger",
        icon: "📱",
        description: "Telefonunuzu kırılma, çalınma ve su hasarına karşı güvence altına alın.",
        fields: [NAME_F, PHONE_F,
          { id: "marka_model", label: "Telefon Marka / Model", type: "text", placeholder: "iPhone 15 Pro", required: true },
          { id: "satin_alma_tarihi", label: "Satın Alma Tarihi", type: "date", required: true },
          { id: "fatura_degeri", label: "Fatura Değeri (TL)", type: "number", placeholder: "45000", required: true },
          KVKK_F],
      },
      {
        slug: "ferdi-kaza",
        label: "Ferdi Kaza Sigortası",
        categoryId: "diger",
        icon: "🩺",
        description: "Kaza sonucu oluşabilecek sakatlık, hastane ve vefat risklerini güvence altına alın.",
        fields: [NAME_F, PHONE_F, DOGUM_F, CINSIYET_F,
          { id: "meslek", label: "Meslek", type: "text", placeholder: "Öğretmen, Mühendis...", required: true },
          TC_F, KVKK_F],
      },
    ],
  },
];

// Flat helpers
export const ALL_PRODUCTS: ProductDef[] = CATEGORIES.flatMap((c) => c.products);

export function findProduct(slug: string): ProductDef | undefined {
  return ALL_PRODUCTS.find((p) => p.slug === slug);
}

export function findCategory(categoryId: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === categoryId);
}

export function categoryOf(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.products.some((p) => p.slug === slug));
}
