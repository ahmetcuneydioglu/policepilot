/**
 * src/lib/tasks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Görevler" veri katmanı — TÜRETİLMİŞ yapılacaklar listesi (yeni tablo YOK).
 * Dört kaynaktan tek tip Task[] üretir:
 *   1) Yenileme  → policies (Aktif, bitiş ±30 gün)
 *   2) Takip     → requests (next_follow_up_date ≤ bugün, açık aşama)
 *   3) Yeni Lead → requests (status='Yeni Lead', ilk temas bekleyen)
 *   4) Görüşme   → customer_interactions (next_action vadesi gelmiş, tamamlanmamış)
 * RLS zaten acente bazlı; agencyId verilirse ek filtre uygulanır.
 *
 * Cihaz aksiyon linkleri (Ara / WhatsApp) renewals.ts yardımcılarından gelir.
 */

import { supabase } from './supabase';
import { fetchUpcomingRenewals, daysUntil } from './renewals';
import { nextActionMeta } from './relationship';

export type TaskKind = 'renewal' | 'followup' | 'lead' | 'interaction';
export type TaskUrgency = 'overdue' | 'today' | 'soon' | 'normal';

export type Task = {
  id: string;                 // benzersiz (kind + kaynak id)
  kind: TaskKind;
  title: string;              // müşteri adı
  subtitle: string;           // "Kasko · 3 gün kaldı" / "Trafik · Teklif Hazırlanıyor"
  urgency: TaskUrgency;
  daysLeft?: number;          // yenileme/takip için (negatif = gecikmiş)
  customerId: string;
  customerPhone: string;
  refId: string;              // kaynak satır id (policy/request)
};

export type TaskSection = {
  section: 'Gecikmiş' | 'Bugün' | 'Bu Hafta' | 'Yaklaşan';
  items: Task[];
};

const DAY = 86_400_000;

// Satış hattında "kapalı" sayılan aşamalar → görev üretmez.
const CLOSED = new Set(['Kazanıldı', 'Kaybedildi']);

/** Gün sayısına göre aciliyet kademesi. */
function urgencyFromDays(daysLeft: number): TaskUrgency {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft === 0) return 'today';
  if (daysLeft <= 7) return 'soon';
  return 'normal';
}

/** "Kasko" + 3 → "Kasko · 3 gün kaldı" (gün durumuna göre Türkçe). */
function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} gün gecikti`;
  if (daysLeft === 0) return 'Bugün';
  return `${daysLeft} gün kaldı`;
}

/**
 * Üç kaynağı paralel çeker, tek tip Task[] döndürür.
 * Sıralama: en acil (gecikmiş) en üstte; daysLeft yoksa (lead) sona yakın.
 */
export async function fetchTasks(agencyId: string | null): Promise<Task[]> {
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── 2 & 3) Talepler: takip + yeni lead (tek çekim) ─────────────────────────
  let reqQ = (supabase.from('requests') as any)
    .select('id,customer_id,request_type,status,next_follow_up_date,customers(name,phone)')
    .order('next_follow_up_date', { ascending: true });
  if (agencyId) reqQ = reqQ.eq('agency_id', agencyId);

  // ── 4) Görüşme sonrası aksiyonlar: vadesi gelmiş, tamamlanmamış ────────────
  let intQ = (supabase.from('customer_interactions') as any)
    .select('id,customer_id,next_action,next_action_date,product,staff_name,customers(name,phone)')
    .not('next_action', 'is', null)
    .eq('next_action_done', false)
    .lte('next_action_date', todayStr)
    .order('next_action_date', { ascending: true })
    .limit(100);
  if (agencyId) intQ = intQ.eq('agency_id', agencyId);

  const [renewals, reqRes, intRes] = await Promise.all([
    fetchUpcomingRenewals(agencyId),
    reqQ,
    intQ,
  ]);

  const tasks: Task[] = [];

  // 1) YENİLEME görevleri
  for (const r of renewals) {
    tasks.push({
      id: `renewal:${r.id}`,
      kind: 'renewal',
      title: r.customerName,
      subtitle: `${r.policy_type} · ${daysLabel(r.daysLeft)}`,
      urgency: urgencyFromDays(r.daysLeft),
      daysLeft: r.daysLeft,
      customerId: r.customer_id,
      customerPhone: r.customerPhone,
      refId: r.id,
    });
  }

  const reqs: any[] = reqRes?.data ?? [];

  for (const q of reqs) {
    const status: string = q.status ?? '';
    if (CLOSED.has(status)) continue;

    const name: string = q.customers?.name ?? 'Müşteri';
    const phone: string = q.customers?.phone ?? '';
    const type: string = q.request_type ?? 'Talep';

    // 2) TAKİP görevi: next_follow_up_date bugün ya da geçmiş
    if (q.next_follow_up_date && q.next_follow_up_date <= todayStr) {
      const d = daysUntil(q.next_follow_up_date, todayStr);
      tasks.push({
        id: `followup:${q.id}`,
        kind: 'followup',
        title: name,
        subtitle: `${type} · ${daysLabel(d)} · ${status}`,
        urgency: urgencyFromDays(d),
        daysLeft: d,
        customerId: q.customer_id,
        customerPhone: phone,
        refId: q.id,
      });
      continue; // bir talep aynı anda hem takip hem lead görevi üretmesin
    }

    // 3) YENİ LEAD: ilk temas bekleyen (takip tarihi henüz dolmamışsa atla)
    if (status === 'Yeni Lead') {
      tasks.push({
        id: `lead:${q.id}`,
        kind: 'lead',
        title: name,
        subtitle: `${type} · İlk temas bekliyor`,
        urgency: 'today', // ilk teması bugünün işi say
        customerId: q.customer_id,
        customerPhone: phone,
        refId: q.id,
      });
    }
  }

  // 4) GÖRÜŞME AKSİYONU görevleri (IRM: "sonraki aksiyon" buraya akar)
  for (const it of (intRes?.data ?? []) as any[]) {
    const d = it.next_action_date ? daysUntil(it.next_action_date, todayStr) : 0;
    const action = nextActionMeta(it.next_action)?.label ?? 'Takip';
    tasks.push({
      id: `interaction:${it.id}`,
      kind: 'interaction',
      title: it.customers?.name ?? 'Müşteri',
      subtitle: `${action}${it.product ? ' · ' + it.product : ''} · ${daysLabel(d)}${it.staff_name ? ' · ' + it.staff_name : ''}`,
      urgency: urgencyFromDays(d),
      daysLeft: d,
      customerId: it.customer_id,
      customerPhone: it.customers?.phone ?? '',
      refId: it.id,
    });
  }

  // Sırala: gecikmiş < bugün < yakın < normal; aynı kademede daysLeft artan.
  const rank: Record<TaskUrgency, number> = { overdue: 0, today: 1, soon: 2, normal: 3 };
  tasks.sort((a, b) => {
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    const da = a.daysLeft ?? 999;
    const db = b.daysLeft ?? 999;
    return da - db;
  });

  return tasks;
}

/**
 * Görevleri zaman bölümlerine ayırır (boş bölüm atlanır).
 * Gecikmiş → daysLeft<0; Bugün → 0 gün / lead; Bu Hafta → 1–7 gün; Yaklaşan → kalan.
 */
export function groupTasks(tasks: Task[]): TaskSection[] {
  const buckets: Record<TaskSection['section'], Task[]> = {
    'Gecikmiş': [],
    'Bugün': [],
    'Bu Hafta': [],
    'Yaklaşan': [],
  };

  for (const t of tasks) {
    if (t.urgency === 'overdue') buckets['Gecikmiş'].push(t);
    else if (t.urgency === 'today') buckets['Bugün'].push(t);
    else if (t.urgency === 'soon') buckets['Bu Hafta'].push(t);
    else buckets['Yaklaşan'].push(t);
  }

  const order: TaskSection['section'][] = ['Gecikmiş', 'Bugün', 'Bu Hafta', 'Yaklaşan'];
  return order
    .map((section) => ({ section, items: buckets[section] }))
    .filter((s) => s.items.length > 0);
}

// ─── Görev → WhatsApp mesajı (kind'e göre metin) ──────────────────────────────

/** TR telefonunu wa.me formatına çevirir (90XXXXXXXXXX). */
function waDigits(phone: string): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('90')) return d;
  if (d.length === 10) return `90${d}`;
  return d;
}

export function buildTaskCallUrl(phone: string): string {
  return `tel:${(phone ?? '').replace(/[^\d+]/g, '')}`;
}

/** Görev türüne göre kısa, samimi bir ilk mesaj hazırlar. */
export function buildTaskWhatsappUrl(task: Task): string {
  const digits = waDigits(task.customerPhone);
  let msg: string;
  if (task.kind === 'renewal') {
    msg = `Merhaba ${task.title}, poliçenizin yenileme zamanı yaklaşıyor. Size en uygun teklifi hazırlayalım mı? 🙂`;
  } else if (task.kind === 'followup') {
    msg = `Merhaba ${task.title}, görüşmemizin takibi için yazıyorum. Size nasıl yardımcı olabilirim? 🙂`;
  } else {
    msg = `Merhaba ${task.title}, talebiniz için teşekkürler! Detayları konuşmak isterseniz buradayım. 🙂`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

/** Görüşme-aksiyonu görevini tamamla (next_action_done=true). */
export async function completeInteractionTask(interactionId: string): Promise<void> {
  await (supabase.from('customer_interactions') as any)
    .update({ next_action_done: true })
    .eq('id', interactionId);
}
