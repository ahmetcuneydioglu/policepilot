"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotifItem = {
  id: string;
  request_type: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  isRead: boolean;
};

export type ToastItem = {
  id: string;
  message: string;
  sub: string;
  removing: boolean;
};

type CtxType = {
  notifications: NotifItem[];
  unreadCount: number;
  markAllRead: () => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
};

const NotificationContext = createContext<CtxType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  toasts: [],
  dismissToast: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
  }, []);

  const addToast = useCallback(
    (message: string, sub: string) => {
      const id = `t-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [{ id, message, sub, removing: false }, ...prev].slice(0, 4));
      timerRef.current[id] = setTimeout(() => dismissToast(id), 5500);
    },
    [dismissToast]
  );

  // ── Browser notification ───────────────────────────────────────────────────
  const sendBrowserNotif = useCallback((name: string, type: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("Yeni Teklif Talebi", { body: `${name} — ${type}`, icon: "/favicon.ico" });
    }
  }, []);

  // ── Add one notification + side-effects ───────────────────────────────────
  const addNotification = useCallback(
    (item: NotifItem) => {
      setNotifications((prev) => [item, ...prev].slice(0, 20));
      addToast(`Yeni teklif talebi: ${item.customer_name}`, item.request_type);
      sendBrowserNotif(item.customer_name, item.request_type);
    },
    [addToast, sendBrowserNotif]
  );

  // ── Initial load — fetch existing "Yeni" requests (no join syntax) ─────────
  useEffect(() => {
    async function bootstrap() {
      // Ask for browser notification permission
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: reqs, error } = await (supabase.from("requests") as any)
        .select("id, request_type, status, created_at, customer_id")
        .eq("status", "Yeni")
        .order("created_at", { ascending: false })
        .limit(15);

      if (error || !Array.isArray(reqs) || reqs.length === 0) return;

      // Fetch customers separately (avoids join path syntax)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids: string[] = [...new Set(reqs.map((r: any) => r.customer_id).filter(Boolean))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customers } = ids.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await (supabase.from("customers") as any).select("id, name, phone").in("id", ids)
        : { data: [] as any[] };

      const cmap: Record<string, { name: string; phone: string }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (customers ?? []).forEach((c: any) => { cmap[c.id] = c; });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: NotifItem[] = reqs.map((r: any) => ({
        id:             r.id,
        request_type:  r.request_type,
        customer_name: cmap[r.customer_id]?.name  ?? "Müşteri",
        customer_phone:cmap[r.customer_id]?.phone ?? "",
        created_at:    r.created_at,
        isRead:        false,
      }));

      setNotifications(items);
    }

    bootstrap();
  }, []);

  // ── Supabase Realtime — INSERT + UPDATE on requests ───────────────────────
  // Requires Realtime enabled for the requests table in Supabase dashboard:
  //   Database → Replication → requests → toggle on
  // Or run: ALTER TABLE public.requests REPLICA IDENTITY FULL;
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase.channel("notif-requests") as any)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "requests" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const req = payload.new;
          if (!req?.id) return;

          // Fetch customer name/phone separately
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.from("customers") as any)
            .select("name, phone")
            .eq("id", req.customer_id)
            .limit(1);

          const cust = data?.[0];
          addNotification({
            id:             req.id,
            request_type:  req.request_type  ?? "Sigorta",
            customer_name: cust?.name         ?? "Yeni Müşteri",
            customer_phone:cust?.phone        ?? "",
            created_at:    req.created_at     ?? new Date().toISOString(),
            isRead:        false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const req = payload.new;
          // Remove from unread list when status moves away from "Yeni"
          if (req?.status && req.status !== "Yeni") {
            setNotifications((prev) => prev.filter((n) => n.id !== req.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, toasts, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
}
