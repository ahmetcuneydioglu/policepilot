/**
 * src/lib/realtime.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase Realtime hook — requests tablosunu dinler.
 *
 * Web'deki NotificationContext mantığının React Native karşılığı:
 * - agency_user → agency_id filtreli kanal
 * - super_admin → filtresiz global kanal
 * - INSERT → onNewRequest callback tetiklenir → local notification
 * - UPDATE  → onRequestUpdated callback (isteğe bağlı)
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

export type RealtimeRequest = {
  id: string;
  customer_id: string;
  request_type: string;
  status: string;
  agency_id: string | null;
  created_at: string;
};

type UseRealtimeRequestsOptions = {
  role: 'super_admin' | 'agency_user' | null;
  agencyId: string | null;
  enabled: boolean;
  onNewRequest: (req: RealtimeRequest, customerName: string, customerPhone: string) => void;
  onRequestUpdated?: (req: RealtimeRequest) => void;
};

/**
 * Supabase Realtime ile requests tablosunu dinler.
 * Component unmount edildiğinde channel temizlenir.
 */
export function useRealtimeRequests({
  role,
  agencyId,
  enabled,
  onNewRequest,
  onRequestUpdated,
}: UseRealtimeRequestsOptions) {
  const onNewRequestRef   = useRef(onNewRequest);
  const onRequestUpdatedRef = useRef(onRequestUpdated);

  // Her render'da ref'leri güncelle (stale closure önleme)
  useEffect(() => { onNewRequestRef.current   = onNewRequest; },   [onNewRequest]);
  useEffect(() => { onRequestUpdatedRef.current = onRequestUpdated; }, [onRequestUpdated]);

  useEffect(() => {
    if (!enabled) return;
    if (!role) return;

    // agency_user için agencyId zorunlu — yoksa abone olma
    if (role === 'agency_user' && !agencyId) return;

    // Web ile aynı kanal adı mantığı
    const channelName = agencyId
      ? `mobile-notif-requests-${agencyId}`
      : 'mobile-notif-requests-global';

    // INSERT konfigürasyonu
    const insertConfig: Record<string, unknown> = {
      event: 'INSERT',
      schema: 'public',
      table: 'requests',
    };

    // UPDATE konfigürasyonu
    const updateConfig: Record<string, unknown> = {
      event: 'UPDATE',
      schema: 'public',
      table: 'requests',
    };

    // agency_user için Realtime filtresi (web'deki realtimeAgencyFilter ile aynı)
    if (role === 'agency_user' && agencyId) {
      const filter = `agency_id=eq.${agencyId}`;
      insertConfig.filter = filter;
      updateConfig.filter = filter;
    }
    // super_admin: filtre yok → tüm INSERT'leri alır

    const channel = (supabase.channel(channelName) as any)
      .on(
        'postgres_changes',
        insertConfig,
        async (payload: { new: RealtimeRequest }) => {
          const req = payload.new;
          if (!req?.id) return;

          // Müşteri adını ve telefonunu çek
          let customerName  = 'Yeni Müşteri';
          let customerPhone = '';
          try {
            const { data } = await (supabase.from('customers') as any)
              .select('name, phone')
              .eq('id', req.customer_id)
              .limit(1)
              .maybeSingle();
            if (data) {
              customerName  = data.name  ?? 'Yeni Müşteri';
              customerPhone = data.phone ?? '';
            }
          } catch { /* sessizce geç */ }

          onNewRequestRef.current(req, customerName, customerPhone);
        }
      )
      .on(
        'postgres_changes',
        updateConfig,
        (payload: { new: RealtimeRequest }) => {
          const req = payload.new;
          if (req?.id && onRequestUpdatedRef.current) {
            onRequestUpdatedRef.current(req);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Kanala abone olundu: ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Realtime] Kanal hatası: ${channelName}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, agencyId, enabled]);
}
