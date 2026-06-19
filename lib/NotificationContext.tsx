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
import { useAuth } from "@/lib/AuthContext";
import { withAgencyFilter, realtimeAgencyFilter } from "@/lib/tenant";

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
  customerName: string;
  requestType: string;
  phone: string;
  removing: boolean;
};

type CtxType = {
  notifications: NotifItem[];
  unreadCount: number;
  markAllRead: () => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  bellShaking: boolean;
  newNotifAt: number;
};

const NotificationContext = createContext<CtxType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  toasts: [],
  dismissToast: () => {},
  soundEnabled: false,
  setSoundEnabled: () => {},
  bellShaking: false,
  newNotifAt: 0,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { role, agencyId, loading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [bellShaking, setBellShaking] = useState(false);
  const [newNotifAt, setNewNotifAt] = useState(0);

  const bellTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundEnabledRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCtxRef     = useRef<any>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Load persisted sound preference ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("notif_sound_enabled");
    if (saved === "true") {
      setSoundEnabledState(true);
      soundEnabledRef.current = true;
    }
  }, []);

  // ── Document title: update when tab is hidden + unread count changes ───────
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (unreadCount > 0 && document.visibilityState !== "visible") {
      document.title = `(${unreadCount}) Yeni teklif - SigortaOS`;
    }
  }, [unreadCount]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    function handleVis() {
      if (document.visibilityState === "visible") {
        document.title = "SigortaOS";
      }
    }
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, []);

  // ── setSoundEnabled: must be called from a user-gesture handler ───────────
  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    soundEnabledRef.current = v;
    if (typeof window !== "undefined") {
      localStorage.setItem("notif_sound_enabled", String(v));
      if (v && !audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) audioCtxRef.current = new AC();
      }
    }
  }, []);

  // ── Web Audio beep ─────────────────────────────────────────────────────────
  const playBeep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    } catch {/* audio unavailable */}
  }, []);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
  }, []);

  const addToast = useCallback(
    (customerName: string, requestType: string, phone: string) => {
      const id = `t-${Date.now()}-${Math.random()}`;
      setToasts((prev) =>
        [{ id, customerName, requestType, phone, removing: false }, ...prev].slice(0, 5)
      );
    },
    []
  );

  // ── Browser notification ───────────────────────────────────────────────────
  const sendBrowserNotif = useCallback((name: string, type: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const n = new Notification("Yeni teklif talebi", {
      body: `${name} - ${type}`,
      icon: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      window.location.href = "/firsatlar";
    };
  }, []);

  // ── Bell shake for 5 s ────────────────────────────────────────────────────
  const triggerBellShake = useCallback(() => {
    setBellShaking(true);
    if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
    bellTimerRef.current = setTimeout(() => setBellShaking(false), 5000);
  }, []);

  // ── Add notification (realtime INSERT only — no sound on bootstrap) ────────
  const addNotification = useCallback(
    (item: NotifItem) => {
      setNotifications((prev) => [item, ...prev].slice(0, 20));
      addToast(item.customer_name, item.request_type, item.customer_phone);
      sendBrowserNotif(item.customer_name, item.request_type);
      triggerBellShake();
      setNewNotifAt(Date.now());
      if (soundEnabledRef.current) playBeep();
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        document.title = `Yeni teklif - SigortaOS`;
      }
    },
    [addToast, sendBrowserNotif, triggerBellShake, playBeep]
  );

  // ── Bootstrap: load existing "Yeni" requests — agency-scoped ──────────────
  // Waits for auth to finish so agencyId is available before querying.
  useEffect(() => {
    if (authLoading) return; // Don't bootstrap until auth is resolved

    // agency_user without an agency yet → nothing to load
    if (role === "agency_user" && !agencyId) {
      setNotifications([]);
      return;
    }

    async function bootstrap() {
      // Build base query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseQ = (supabase.from("requests") as any)
        .select("id, request_type, status, created_at, customer_id")
        .eq("status", "Yeni Lead")
        .order("created_at", { ascending: false })
        .limit(15);

      // Apply agency filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = withAgencyFilter(baseQ, role, agencyId);
      const { data: reqs, error } = await q;

      if (error || !Array.isArray(reqs) || reqs.length === 0) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids: string[] = [...new Set(reqs.map((r: any) => r.customer_id).filter(Boolean))];
      const { data: customers } = ids.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await (supabase.from("customers") as any).select("id, name, phone").in("id", ids)
        : { data: [] as { id: string; name: string; phone: string }[] };

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
    // Re-run when auth resolves or agencyId changes
  }, [authLoading, role, agencyId]);

  // ── Supabase Realtime — agency-scoped subscription ─────────────────────────
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve

    const rtFilter = realtimeAgencyFilter(role, agencyId);

    // agency_user with no agencyId yet → skip subscription entirely
    if (rtFilter === null) return;

    // Build channel config: add filter only for agency_user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertConfig: Record<string, any> = {
      event: "INSERT",
      schema: "public",
      table: "requests",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateConfig: Record<string, any> = {
      event: "UPDATE",
      schema: "public",
      table: "requests",
    };

    if (rtFilter !== undefined) {
      // agency_user: scope to their agency
      insertConfig.filter = rtFilter;
      updateConfig.filter = rtFilter;
    }
    // super_admin: no filter — receives all events globally

    // Use agency-specific channel name to avoid conflicts between sessions
    const channelName = agencyId ? `notif-requests-${agencyId}` : "notif-requests-global";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase.channel(channelName) as any)
      .on(
        "postgres_changes",
        insertConfig,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const req = payload.new;
          if (!req?.id) return;
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
        updateConfig,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const req = payload.new;
          if (req?.status && req.status !== "Yeni Lead") {
            setNotifications((prev) => prev.filter((n) => n.id !== req.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authLoading, role, agencyId, addNotification]);

  // ── Renewal notifications — notifications tablosu realtime aboneliği ──────
  // Cron job'ın ürettiği yenileme bildirimleri buradan browser notification'a dönüşür.
  useEffect(() => {
    if (authLoading) {
      console.log("[NOTIF] auth yükleniyor, abonelik bekliyor");
      return;
    }

    const rtFilter = realtimeAgencyFilter(role, agencyId);
    if (rtFilter === null) {
      console.log("[NOTIF] agencyId yok, abonelik atlandı (role:", role, ")");
      return; // agency_user, henüz agencyId yok
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertConfig: Record<string, any> = {
      event: "INSERT",
      schema: "public",
      table: "notifications",
    };
    if (rtFilter !== undefined) insertConfig.filter = rtFilter;

    const channelName = agencyId ? `notif-renewals-${agencyId}` : "notif-renewals-global";
    console.log("[NOTIF] kanal oluşturuluyor:", channelName, "filter:", rtFilter ?? "(yok — super_admin)");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase.channel(channelName) as any)
      .on(
        "postgres_changes",
        insertConfig,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          console.log("[NOTIF] insert received", payload);
          const notif = payload.new;
          if (!notif?.id) {
            console.warn("[NOTIF] payload.new boş veya id yok — atlandı");
            return;
          }

          // Bell badge: bildirimi zil listesine ekle → unreadCount artar
          setNotifications((prev) => [
            {
              id:             notif.id,
              request_type:   notif.type === "renewal" ? "Yenileme" : (notif.type ?? "Bildirim"),
              customer_name:  notif.title ?? "SigortaOS",
              customer_phone: "",
              created_at:     notif.created_at ?? new Date().toISOString(),
              isRead:         false,
            },
            ...prev,
          ].slice(0, 20));

          // Browser notification
          const perm = typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "unsupported";
          console.log("[NOTIF] Notification.permission =", perm);

          if (perm === "granted") {
            console.log("[NOTIF] showing browser notification", { title: notif.title, body: notif.body, link: notif.link });
            const n = new Notification(notif.title ?? "SigortaOS", {
              body: notif.body ?? "",
              icon: "/favicon.ico",
              tag:  `pp-notif-${notif.id}`, // aynı bildirim iki kez gösterilmez
            });
            n.onclick = () => {
              window.focus();
              window.location.href = notif.link ?? "/renewals";
            };
          } else {
            console.warn("[NOTIF] browser notification GÖSTERİLMEDİ — permission:", perm);
          }

          triggerBellShake();
          setNewNotifAt(Date.now());
          if (soundEnabledRef.current) playBeep();
        }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .subscribe((status: any, err: any) => {
        if (status === "SUBSCRIBED") console.log("[NOTIF] subscribed —", channelName);
        else console.log("[NOTIF] kanal durumu:", status, err ? `hata: ${err.message ?? err}` : "");
      });

    return () => {
      console.log("[NOTIF] kanal kapatılıyor:", channelName);
      supabase.removeChannel(channel);
    };
  }, [authLoading, role, agencyId, triggerBellShake, playBeep]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (typeof document !== "undefined") document.title = "SigortaOS";
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications, unreadCount, markAllRead,
        toasts, dismissToast,
        soundEnabled, setSoundEnabled,
        bellShaking, newNotifAt,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
