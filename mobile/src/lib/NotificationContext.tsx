/**
 * src/lib/NotificationContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Uygulama genelinde bildirim durumunu yöneten context.
 * Web'deki NotificationContext.tsx mantığının React Native portu.
 *
 * Sağladıkları:
 *  - notifications[]   → son gelen talepler listesi (maks 20)
 *  - unreadCount       → okunmamış sayısı → tab badge
 *  - addNotification() → realtime INSERT'ten tetiklenir
 *  - markAllRead()     → Talepler ekranı açılınca çağrılır
 *  - clearAll()        → tümünü temizle
 */

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';

export type NotifItem = {
  id: string;            // request ID
  requestType: string;
  customerName: string;
  customerPhone: string;
  agencyId: string | null;
  createdAt: string;
  isRead: boolean;
};

type CtxType = {
  notifications: NotifItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotifItem, 'isRead'>) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationContext = createContext<CtxType>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export function useNotificationStore() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const addNotification = useCallback((item: Omit<NotifItem, 'isRead'>) => {
    setNotifications((prev) => {
      // Aynı request zaten listede varsa ekleme
      if (prev.some((n) => n.id === item.id)) return prev;
      return [{ ...item, isRead: false }, ...prev].slice(0, 20);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
