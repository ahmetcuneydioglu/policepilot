/**
 * src/lib/quoteFields.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web yeni-teklif sihirbazının ürüne-özel risk alanı şeması (app/(crm)/quote-center/new).
 * Ürün grubu → form alanları. product_data anahtarları web ile BİREBİR aynı.
 */

export type FieldType = 'text' | 'number' | 'select' | 'date';
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  autoCap?: boolean;
};
export type ProductGroup = 'vehicle' | 'property' | 'health' | 'travel';

export function groupOf(product: string): ProductGroup {
  if (['Trafik', 'Kasko', 'İMM'].includes(product)) return 'vehicle';
  if (['DASK', 'Konut'].includes(product)) return 'property';
  if (['TSS', 'Ferdi Kaza', 'Özel Sağlık'].includes(product)) return 'health';
  return 'travel';
}

export const FIELDS_BY_GROUP: Record<ProductGroup, FieldDef[]> = {
  vehicle: [
    { key: 'plaka', label: 'Plaka', type: 'text', required: true, placeholder: '34 ABC 123', autoCap: true },
    { key: 'ruhsatSeri', label: 'Ruhsat Seri/No', type: 'text', placeholder: 'AB-123456', autoCap: true },
    { key: 'kullanimTarzi', label: 'Kullanım Tarzı', type: 'text', placeholder: 'OTOMOBİL', autoCap: true },
    { key: 'marka', label: 'Marka', type: 'text', placeholder: 'TOYOTA', autoCap: true },
    { key: 'model', label: 'Model', type: 'text', placeholder: 'COROLLA 1.6' },
    { key: 'modelYili', label: 'Model Yılı', type: 'number', placeholder: '2020' },
    { key: 'motorNo', label: 'Motor No', type: 'text', placeholder: 'ABC123', autoCap: true },
    { key: 'sasiNo', label: 'Şasi No', type: 'text', placeholder: 'WDD…', autoCap: true },
    { key: 'tescilTarihi', label: 'Tescil Tarihi', type: 'date', placeholder: 'GG.AA.YYYY' },
    { key: 'il', label: 'İl', type: 'text', placeholder: 'İSTANBUL', autoCap: true },
    { key: 'ilce', label: 'İlçe', type: 'text', placeholder: 'KADIKÖY', autoCap: true },
  ],
  property: [
    { key: 'il', label: 'İl', type: 'text', placeholder: 'İSTANBUL', autoCap: true },
    { key: 'ilce', label: 'İlçe', type: 'text', placeholder: 'KADIKÖY', autoCap: true },
    { key: 'metrekare', label: 'Metrekare', type: 'number', placeholder: '120' },
    { key: 'binaYili', label: 'Bina Yapım Yılı', type: 'number', placeholder: '2005' },
  ],
  health: [
    { key: 'yas', label: 'Yaş', type: 'number', placeholder: '35' },
    { key: 'cinsiyet', label: 'Cinsiyet', type: 'select', options: ['Erkek', 'Kadın'] },
    { key: 'il', label: 'İl', type: 'text', placeholder: 'İSTANBUL', autoCap: true },
    { key: 'ilce', label: 'İlçe', type: 'text', placeholder: 'KADIKÖY', autoCap: true },
  ],
  travel: [],
};

/** Bu grup için Plaka Sorgula (demo araç lookup) gösterilsin mi. */
export function hasPlakaLookup(group: ProductGroup): boolean {
  return group === 'vehicle';
}
