/**
 * src/lib/customer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Müşteri 360° detay veri katmanı + sentetik zaman tüneli.
 * Timeline, müşteriye ait kayıtların created_at'lerinden üretilir
 * (customer/policy/request/document) — activity_log client'a kapalı olduğundan.
 * Granular olaylar (WhatsApp gönderimi vb.) Faz 3'te API köprüsüyle eklenecek.
 */

import { supabase } from './supabase';
import { Customer } from './types';
import { daysUntil } from './renewals';

export type CustomerPolicy = {
  id: string;
  policy_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  premium: number | null;
  commission: number | null;
  insurance_company: string | null;
  policy_no: string | null;
  created_at: string;
};

export type CustomerRequest = {
  id: string;
  request_type: string;
  status: string;
  price_offer: number | null;
  created_at: string;
};

export type CustomerDoc = { id: string; file_name: string; created_at: string };

export type CustomerBundle = {
  customer: Customer | null;
  policies: CustomerPolicy[];
  requests: CustomerRequest[];
  documents: CustomerDoc[];
};

export type TimelineEvent = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  date: string;
};

export async function fetchCustomerBundle(id: string): Promise<CustomerBundle> {
  const [cRes, pRes, rRes, dRes] = await Promise.all([
    (supabase.from('customers') as any).select('*').eq('id', id).maybeSingle(),
    (supabase.from('policies') as any)
      .select('id,policy_type,status,start_date,end_date,premium,commission,insurance_company,policy_no,created_at')
      .eq('customer_id', id).order('created_at', { ascending: false }),
    (supabase.from('requests') as any)
      .select('id,request_type,status,price_offer,created_at')
      .eq('customer_id', id).order('created_at', { ascending: false }),
    (supabase.from('documents') as any)
      .select('id,file_name,created_at')
      .eq('customer_id', id).order('created_at', { ascending: false }),
  ]);

  return {
    customer: cRes.data ?? null,
    policies: pRes.data ?? [],
    requests: rRes.data ?? [],
    documents: dRes.data ?? [],
  };
}

/** created_at'lerden sentetik zaman tüneli (yeniden eskiye). */
export function buildTimeline(b: CustomerBundle): TimelineEvent[] {
  const ev: TimelineEvent[] = [];

  if (b.customer) {
    ev.push({ id: `c-${b.customer.id}`, icon: '👤', title: 'Müşteri eklendi', subtitle: b.customer.name, date: b.customer.created_at });
  }
  for (const p of b.policies) {
    ev.push({ id: `p-${p.id}`, icon: '📄', title: 'Poliçe oluşturuldu', subtitle: `${p.policy_type}${p.insurance_company ? ` · ${p.insurance_company}` : ''}`, date: p.created_at });
  }
  for (const r of b.requests) {
    ev.push({ id: `r-${r.id}`, icon: '📋', title: 'Teklif oluşturuldu', subtitle: r.request_type, date: r.created_at });
  }
  for (const d of b.documents) {
    ev.push({ id: `d-${d.id}`, icon: '📁', title: 'Evrak yüklendi', subtitle: d.file_name, date: d.created_at });
  }

  return ev
    .filter((e) => !!e.date)
    .sort((a, z) => (a.date < z.date ? 1 : -1));
}

/** Yaklaşan yenileme: aktif + bitişe ≤30 gün poliçeler. */
export function upcomingRenewals(policies: CustomerPolicy[]): CustomerPolicy[] {
  return policies.filter(
    (p) => p.status === 'Aktif' && p.end_date != null && daysUntil(p.end_date) <= 30
  );
}
