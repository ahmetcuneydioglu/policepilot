/**
 * Veri katmanı standardı — TanStack Query + AsyncStorage persist (offline cache).
 *
 * Amaç: açılışta SON BİLİNEN veri anında gelir (disk cache), arkada tazelenir;
 * şebeke yokken ekranlar boş kalmaz. Ekranlardaki useState+useEffect+onRefresh
 * üçlüsünün yerini `useCachedQuery` alır.
 *
 * Not: cache yalnız OKUMA içindir; yazmalar (insert/update) aynen kalır —
 * yazma sonrası ekran kendi refetch'ini çağırır.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, focusManager, useQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// Uygulama öne gelince stale sorgular otomatik tazelensin (web'deki window-focus karşılığı)
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,               // 30 sn taze — ekranlar arası gidip-gelmede tekrar çekmez
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 gün diskte kalır (offline açılış)
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'sigortaos.queryCache',
  throttleTime: 2000,
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: 'v1', // cache şeması değişirse artır
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * Ekran deseni: { data, loading, refreshing, onRefresh, refetch }.
 * Disk cache'i varsa loading=false ile anında veri döner (arkada tazelenir).
 */
export function useCachedQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>, enabled = true) {
  const q = useQuery({ queryKey: key as unknown[], queryFn: fetcher, enabled });
  const [refreshing, setRefreshing] = useState(false);
  const refetch = q.refetch;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  return {
    data: q.data,
    loading: q.isPending,
    refreshing,
    onRefresh,
    refetch,
  };
}
