/**
 * SigortaOS — Demo Mode
 *
 * DEMO_MODE = true  → sistemi gerçek API olmadan tam deneyimle çalıştırır
 * DEMO_MODE = false → sadece manuel teklif girişi (production)
 *
 * İleride ACTIVE_PROVIDER değiştirilerek gerçek entegrasyona geçilir:
 *   "demo"         → deterministik sahte veri
 *   "manual"       → kullanıcı manuel fiyat girer
 *   "insurgateway" → InsurGateway entegrasyonu (henüz aktif değil)
 *   "company_api"  → Şirket direkt API (henüz aktif değil)
 */

export const DEMO_MODE = true;

export type QuoteProvider = "demo" | "manual" | "insurgateway" | "company_api";
export const ACTIVE_PROVIDER: QuoteProvider = DEMO_MODE ? "demo" : "manual";

// ─── Deterministic hash (djb2) ────────────────────────────────────────────────
function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h >>> 0);
}

function pick<T>(arr: T[], h: number): T {
  return arr[h % arr.length];
}

function deterministicCode(seed: number, chars: string, len: number): string {
  let s = "";
  let h = seed;
  for (let i = 0; i < len; i++) {
    h = Math.abs((Math.imul(h, 1664525) + 1013904223) | 0);
    s += chars[h % chars.length];
  }
  return s;
}

// ─── Person data ──────────────────────────────────────────────────────────────
const NAMES_MALE = [
  "AHMET", "MEHMET", "MUSTAFA", "HASAN", "HÜSEYİN", "ALİ", "İBRAHİM",
  "İSMAİL", "ÖMER", "KEMAL", "YUSUF", "ONUR", "MURAT", "SERKAN",
  "BURAK", "CAN", "EMRE", "FATİH", "UĞUR", "VOLKAN",
];
const NAMES_FEMALE = [
  "FATMA", "AYŞE", "EMİNE", "HATİCE", "ZELİHA", "MERVE", "BÜŞRA",
  "ESRA", "GÜLŞEN", "DİLEK", "SEDA", "PINAR", "ÖZGE", "EBRU",
  "NUR", "GİZEM", "ŞEYMA", "TUĞBA", "YILDIZ", "BETÜL",
];
const SURNAMES = [
  "YILMAZ", "KAYA", "DEMİR", "ÇELİK", "ŞAHİN", "ÖZTÜRK", "ARSLAN",
  "DOĞAN", "KILIÇ", "YILDIZ", "AYDIN", "ŞEN", "KARATAŞ", "POLAT",
  "ERDOĞAN", "ATEŞ", "TEKİN", "GÜNEŞ", "BULUT", "KOÇAK",
];

const CITIES_DISTRICTS: Record<string, string[]> = {
  "İSTANBUL":  ["KADIKÖY", "BEŞİKTAŞ", "ÜSKÜDAR", "MALTEPE", "KARTAL", "ŞİŞLİ", "BAKIRKÖY", "ATAŞEHİR", "PENDİK", "BAĞCILAR"],
  "ANKARA":    ["ÇANKAYA", "KEÇİÖREN", "MAMAK", "ETİMESGUT", "SİNCAN", "YENİMAHALLE"],
  "İZMİR":     ["KONAK", "KARŞIYAKA", "BORNOVA", "BUCA", "BAYRAKLI", "KARABAĞLAR"],
  "BURSA":     ["NİLÜFER", "OSMANGAZİ", "YILDIRIM", "GEMLİK"],
  "ANTALYA":   ["MURATPAŞA", "KEPEZ", "KONYAALTI", "ALANYA", "MANAVGAT"],
  "ADANA":     ["SEYHAN", "ÇUKUROVA", "YÜREĞİR", "SARÇAM"],
  "KOCAELİ":   ["İZMİT", "GEBZE", "DARİCA", "KÖRFEZ"],
  "GAZİANTEP": ["ŞAHİNBEY", "ŞEHİTKAMİL", "NİZİP"],
  "KONYA":     ["SELÇUKLU", "MERAM", "KARATAY"],
  "ESKİŞEHİR": ["TEPEBAŞİ", "ODUNPAZARİ"],
};
const CITY_LIST = Object.keys(CITIES_DISTRICTS);

export type PersonData = {
  name: string;
  city: string;
  district: string;
  dob: string;
};

/**
 * Deterministic person from TC.
 * Aynı TC → her zaman aynı kişi.
 */
export function getPersonFromTc(tc: string): PersonData {
  const h = hash32(tc.trim());
  const isMale  = h % 2 === 0;
  const fname   = pick(isMale ? NAMES_MALE : NAMES_FEMALE, h >>> 2);
  const surname = pick(SURNAMES, h >>> 4);
  const city    = pick(CITY_LIST, h >>> 6);
  const districts = CITIES_DISTRICTS[city] ?? ["MERKEZ"];
  const district  = pick(districts, h >>> 8);

  const age   = 20 + ((h >>> 10) % 50);
  const year  = new Date().getFullYear() - age;
  const month = 1 + ((h >>> 14) % 12);
  const day   = 1 + ((h >>> 16) % 28);
  const dob   = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;

  return { name: `${fname} ${surname}`, city, district, dob };
}

// ─── Vehicle data ─────────────────────────────────────────────────────────────
const VEHICLES = [
  { brand: "Toyota",     models: ["Corolla 1.6 Hybrid", "Yaris 1.5 Hybrid", "RAV4 2.5 Hybrid", "C-HR 1.8 Hybrid"] },
  { brand: "Hyundai",    models: ["i20 1.4 MPI", "i30 1.6 CRDI", "Tucson 1.6 T-GDi", "Kona 1.0 T-GDi"] },
  { brand: "Renault",    models: ["Clio 1.0 TCe", "Megane 1.3 TCe", "Kadjar 1.5 Blue dCi", "Duster 1.3 TCe"] },
  { brand: "Volkswagen", models: ["Golf 1.5 eTSI", "Polo 1.0 TSI", "Passat 2.0 TDI", "T-Roc 1.5 TSI"] },
  { brand: "Ford",       models: ["Focus 1.5 EcoBoost", "Fiesta 1.0 EcoBoost", "Puma 1.0 EcoBoost", "Kuga 2.5 Hybrid"] },
  { brand: "Opel",       models: ["Corsa 1.2 Turbo", "Astra 1.2 Turbo", "Mokka 1.2 Turbo"] },
  { brand: "Fiat",       models: ["Egea 1.4 FireFly", "500e", "Tipo 1.4 FireFly Cross"] },
  { brand: "BMW",        models: ["3 Serisi 320i", "1 Serisi 118i", "X3 xDrive20d", "X1 sDrive18i"] },
  { brand: "Mercedes",   models: ["C 180 AMG Line", "A 200 AMG Line", "E 220d AMG", "GLA 200"] },
  { brand: "Dacia",      models: ["Duster 1.3 TCe", "Logan 1.0 SCe", "Sandero 1.0 TCe", "Spring Electric"] },
  { brand: "Kia",        models: ["Sportage 1.6 CRDI", "Ceed 1.5 T-GDi", "Picanto 1.0 MPI", "Stonic 1.0 T-GDi"] },
  { brand: "Nissan",     models: ["Qashqai 1.3 MHEV", "Juke 1.0 DIG-T", "Micra 1.0 IG-T"] },
];

const USAGE_TYPES = ["OTOMOBİL", "OTOMOBİL", "OTOMOBİL", "OTOMOBİL", "KAMYONET", "MİNİBÜS"];
const MODEL_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ALPHA = "ABCDEFGHJKLMNPRSTUVWYZ";
const ALNUM = "ABCDEFGHJKLMNPRSTUVWYZ0123456789";

export type VehicleData = {
  marka: string;
  model: string;
  modelYili: string;
  kullanimTarzi: string;
  motorNo: string;
  sasiNo: string;
  tescilTarihi: string;
};

/**
 * Deterministic vehicle from plate.
 * Aynı plaka → her zaman aynı araç.
 */
export function getVehicleFromPlaka(plaka: string): VehicleData {
  const p = plaka.toUpperCase().replace(/\s/g, "");
  const h = hash32(p);

  const vg    = pick(VEHICLES, h);
  const model = pick(vg.models, h >>> 4);
  const year  = pick(MODEL_YEARS, h >>> 8);
  const usage = pick(USAGE_TYPES, h >>> 10);

  const motorNo = deterministicCode(h, ALNUM, 9);
  const sasiNo  = deterministicCode(h >>> 3, ALNUM, 17);

  const regMonth = 1 + ((h >>> 14) % 12);
  const regDay   = 1 + ((h >>> 16) % 28);
  const tescilTarihi = `${String(regDay).padStart(2, "0")}.${String(regMonth).padStart(2, "0")}.${year}`;

  return { marka: vg.brand, model, modelYili: String(year), kullanimTarzi: usage, motorNo, sasiNo, tescilTarihi };
}

// ─── Quote companies & pricing ────────────────────────────────────────────────
export const DEMO_COMPANIES = [
  "Allianz Sigorta",
  "AXA Sigorta",
  "Anadolu Sigorta",
  "HDI Sigorta",
  "Mapfre Sigorta",
  "Sompo Sigorta",
  "Ray Sigorta",
  "Neova Sigorta",
  "Türkiye Sigorta",
  "Aksigorta",
  "Zurich Sigorta",
  "Quick Sigorta",
];

/** Gerçekçi fiyat aralıkları (TL) */
export const PRICE_RANGES: Record<string, [number, number]> = {
  "Trafik":      [12_000, 35_000],
  "Kasko":       [15_000, 80_000],
  "İMM":         [3_000,  15_000],
  "DASK":        [500,    4_000],
  "Konut":       [2_000,  12_000],
  "TSS":         [2_000,  15_000],
  "Ferdi Kaza":  [800,    5_000],
  "Özel Sağlık": [8_000,  50_000],
  "Seyahat":     [200,    2_000],
};

const DEFAULT_RANGE: [number, number] = [5_000, 30_000];

/**
 * Deterministic quote result for (productType, company, seed).
 * Seed = TC + plaka gibi form alanlarından türetilir.
 * ~10% şans "teklif yok".
 */
export function getDemoQuoteResult(
  productType: string,
  companyName: string,
  seed: string
): { price: number | null; noOffer: boolean } {
  const h = hash32(`${productType}||${companyName}||${seed}`);

  // %10 teklif yok
  if (h % 10 === 0) return { price: null, noOffer: true };

  const [min, max] = PRICE_RANGES[productType] ?? DEFAULT_RANGE;
  const range  = max - min;
  const raw    = min + (h % range);
  const round  = productType === "DASK" || productType === "Seyahat" ? 10 : 100;
  const price  = Math.round(raw / round) * round;

  return { price, noOffer: false };
}
