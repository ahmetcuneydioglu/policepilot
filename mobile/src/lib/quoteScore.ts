/**
 * src/lib/quoteScore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Teklif sonuç ekranı için "Yapay Zeka Skoru" + 5 metrik (Güvenilirlik / Hasar /
 * Fiyat / Teminat / Memnuniyet) — tamamliyo.com görünümü. Web'de bu skorlama YOK;
 * burada DETERMİNİSTİK üretilir (şirket adına göre djb2 hash → her şirkete sabit
 * değerler), tıpkı demo fiyat motorunun yaptığı gibi. "Fiyat" metriği ve toplam
 * skor, teklifin fiyatıyla ilişkilidir (ucuz = yüksek skor). Backend gerektirmez.
 */

/** Deterministik [0,1) — (salt + şirket adı) djb2 hash. */
function hash01(name: string, salt: string): number {
  const str = `${salt}::${name.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

export type Metric = { key: string; label: string; value: number };
export type QuoteScore = {
  aiScore: number;        // örn 96.4 (tek ondalık)
  metrics: Metric[];      // 5 metrik (0-100)
  kazanc: number;         // ortalamaya göre tasarruf (₺), <=0 ise gösterilmez
};

export type PriceCtx = { avg: number; min: number; max: number };

/** Başarılı tekliflerin fiyat bağlamını çıkar (skorlama için). */
export function priceCtx(prices: number[]): PriceCtx {
  const p = prices.filter((n) => n > 0);
  if (!p.length) return { avg: 0, min: 0, max: 0 };
  return {
    avg: Math.round(p.reduce((a, b) => a + b, 0) / p.length),
    min: Math.min(...p),
    max: Math.max(...p),
  };
}

const span = (name: string, salt: string, lo: number, hi: number) =>
  lo + Math.round(hash01(name, salt) * (hi - lo));

/** Bir şirket için deterministik skor + 5 metrik + kazanç. */
export function scoreFor(companyName: string, price: number | null, ctx: PriceCtx): QuoteScore {
  const guvenilirlik = span(companyName, 'guv', 82, 98);
  const hasar = span(companyName, 'has', 80, 97);
  const teminat = span(companyName, 'tem', 84, 97);
  const memnuniyet = span(companyName, 'mem', 82, 98);

  // Fiyat metriği: en ucuz → ~98, en pahalı → ~80 (aralık yoksa nötr)
  let fiyat = 88;
  if (price && ctx.max > ctx.min) {
    const rel = (ctx.max - price) / (ctx.max - ctx.min); // 1 ucuz, 0 pahalı
    fiyat = Math.round(80 + rel * 18);
  } else if (price && ctx.max === ctx.min) {
    fiyat = 90;
  }

  const metrics: Metric[] = [
    { key: 'guvenilirlik', label: 'Güvenilirlik', value: guvenilirlik },
    { key: 'hasar', label: 'Hasar', value: hasar },
    { key: 'fiyat', label: 'Fiyat', value: fiyat },
    { key: 'teminat', label: 'Teminat', value: teminat },
    { key: 'memnuniyet', label: 'Memnuniyet', value: memnuniyet },
  ];

  // Ağırlıklı toplam (fiyat baskın) → ucuz teklif genelde "Yapay Zeka Önerisi" olur
  const aiScore = Number(
    (guvenilirlik * 0.18 + hasar * 0.18 + fiyat * 0.30 + teminat * 0.17 + memnuniyet * 0.17).toFixed(1)
  );

  const kazanc = price && ctx.avg > price ? Math.round(ctx.avg - price) : 0;
  return { aiScore, metrics, kazanc };
}
