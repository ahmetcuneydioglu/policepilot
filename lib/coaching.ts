/**
 * SigortaOS — Ekip Koçluk Motoru (kural tabanlı grounding).
 *
 * Personel performans verisinden, acente sahibine yönelik SOMUT ve uygulanabilir
 * koçluk önerileri üretir. Gerçek sayılara dayanır (hayal etmez) → hem doğrudan
 * gösterilir hem de AI zenginleştirmesinin "grounding" kaynağıdır (route LLM'e bunu verir).
 *
 * Saf fonksiyon — DB yok. Owner HARİÇ çalışanlarla çağrılır.
 */

import type { UserPerf } from "@/lib/performance";

export type CoachingSeverity = "high" | "medium" | "low" | "positive";

export interface CoachingItem {
  user_id: string;
  user_name: string;
  severity: CoachingSeverity;
  tag: string;          // kısa etiket — "Pasif", "Düşük dönüşüm", "Şampiyon"
  observation: string;  // gerçek sayılarla gözlem
  action: string;       // önerilen somut aksiyon
}

const IDLE_DAYS = 7;
const SEV_ORDER: Record<CoachingSeverity, number> = { high: 0, medium: 1, low: 2, positive: 3 };

function daysSince(iso: string | null): number {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 9999;
}
function money(n: number): string {
  return `${Math.round(n).toLocaleString("tr-TR")} ₺`;
}

/**
 * @param staff  owner hariç çalışanlar (UserPerf[])
 * @param avgConversion  ekip dönüşüm ortalaması (kıyas eşiği)
 */
export function buildCoaching(staff: UserPerf[], avgConversion: number): CoachingItem[] {
  const items: CoachingItem[] = [];

  for (const u of staff) {
    const idle = daysSince(u.last_activity);
    const base = { user_id: u.id, user_name: u.name };

    // 1) Pasif personel — en yüksek öncelik (önce bunu çöz)
    if (idle >= IDLE_DAYS) {
      items.push({
        ...base,
        severity: idle >= 14 ? "high" : "medium",
        tag: "Pasif",
        observation: `${u.name} ${idle} gündür sistemde işlem yapmadı.`,
        action: "Kısa bir kontrol görüşmesi yap; engel mi, motivasyon mu, iş yükü mü — nedenini anla ve haftalık küçük bir hedef koy.",
      });
      continue;
    }

    // 2) Teklif çalışıyor ama kapatamıyor — düşük dönüşüm
    if (u.quotes_total >= 3 && u.conversion < Math.max(12, avgConversion - 8)) {
      items.push({
        ...base,
        severity: "high",
        tag: "Düşük dönüşüm",
        observation: `${u.quotes_total} teklif çalıştı, ${u.quotes_won} tanesi kapandı (%${u.conversion}). Ekip ortalaması %${avgConversion}.`,
        action: "Teklif sonrası 48 saatte WhatsApp takip mesajı kur; itiraz karşılama / fiyat sunumu üzerine birebir koçluk yap.",
      });
      continue;
    }

    // 3) Pipeline var, kapanış yok — müşteri ekliyor ama poliçe üretmiyor
    if (u.customers >= 5 && u.policies_total === 0) {
      items.push({
        ...base,
        severity: "medium",
        tag: "Kapanış eksik",
        observation: `${u.customers} müşteri ekledi fakat henüz poliçe üretmedi.`,
        action: "En sıcak 3 müşteriyle birlikte teklif çıkarın; ilk kapanışı hızlandırmak için süreçte takılınan adımı tespit et.",
      });
      continue;
    }

    // 4) Genel üretim düşük
    if (u.score < 30 && (u.customers > 0 || u.quotes_total > 0)) {
      items.push({
        ...base,
        severity: "medium",
        tag: "Düşük üretim",
        observation: `Performans skoru ${u.score}; üretim ekip gerisinde (${u.policies_total} poliçe, ${money(u.total_premium)} prim).`,
        action: "Net ve ulaşılabilir bir haftalık hedef belirle (ör. 3 teklif + 1 poliçe) ve gün sonu kısa takip uygula.",
      });
      continue;
    }

    // 5) Şampiyon — pozitif koçluk (görünür kıl, yöntemini yay)
    if (u.score >= 75) {
      items.push({
        ...base,
        severity: "positive",
        tag: "Şampiyon",
        observation: `Skor ${u.score} ile ekibin önünde: ${u.policies_total} poliçe, ${money(u.total_premium)} prim, %${u.conversion} dönüşüm.`,
        action: "Başarıyı ekiple paylaş; yöntemini kısa bir iç eğitimde anlattır ve küçük bir ödül/takdir düşün.",
      });
    }
  }

  return items.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).slice(0, 6);
}
