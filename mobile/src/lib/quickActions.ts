/**
 * App icon Quick Actions (ikona basılı tut → kısayol).
 * expo-quick-actions native modülü eski build'de yoksa sessizce no-op
 * (notifications/haptics ile aynı defansif kalıp) — crash yok, rebuild sonrası aktif.
 */

import { useEffect } from 'react';

// Modül çözümü bir kez, module-level: hook çağrısı render'lar arası stabil kalır.
let routerMod: any = null;
let qaMod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  routerMod = require('expo-quick-actions/router');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  qaMod = require('expo-quick-actions');
} catch {
  routerMod = null;
  qaMod = null;
}

export function useQuickActionsSetup() {
  // params.href → expo-router yönlendirmesi (kütüphanenin resmi köprüsü)
  routerMod?.useQuickActionRouting?.();

  useEffect(() => {
    if (!qaMod?.setItems) return;
    qaMod
      .setItems([
        { id: 'scan',     title: 'Poliçe Tara',  icon: 'symbol:camera.fill',                  params: { href: '/(tabs)/policies?scan=1' } },
        { id: 'search',   title: 'Müşteri Ara',  icon: 'symbol:magnifyingglass',              params: { href: '/search' } },
        { id: 'renewals', title: 'Yenilemeler',  icon: 'symbol:arrow.triangle.2.circlepath',  params: { href: '/(tabs)/renewals' } },
        { id: 'ai',       title: 'SigortaOS AI', icon: 'symbol:sparkles',                     params: { href: '/ai-sheet' } },
      ])
      .catch(() => {});
  }, []);
}
