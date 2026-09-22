import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { useNotificationStore } from "../../store/notificationStore";
import { supabase } from "../supabase";

export const useNotificationsCount = () => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { setUnreadCount, incrementUnread, decrementUnread, resetUnread } =
    useNotificationStore();

  useEffect(() => {
    let active = true;

    const clearChannel = () => {
      if (!channelRef.current) return;
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };

    const setup = async () => {
      clearChannel();
      resetUnread();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { count, error } = await supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("receptor_id", user.id)
        .eq("leido", false);
      if (!active) return;
      if (error) {
        console.error("No se pudo obtener el contador de notificaciones:", error);
        return;
      }
      setUnreadCount(count ?? 0);

      channelRef.current = supabase
        .channel(`notificaciones-count-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notificaciones",
            filter: `receptor_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) return;
            if (payload.eventType === "INSERT" && !payload.new.leido) {
              incrementUnread();
            } else if (payload.eventType === "UPDATE") {
              const wasUnread = !payload.old.leido;
              const isUnread = !payload.new.leido;
              if (wasUnread && !isUnread) decrementUnread();
              else if (!wasUnread && isUnread) incrementUnread();
            } else if (payload.eventType === "DELETE" && !payload.old.leido) {
              decrementUnread();
            }
          },
        )
        .subscribe();
    };

    void setup();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) void setup();
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      clearChannel();
      resetUnread();
    };
  }, [decrementUnread, incrementUnread, resetUnread, setUnreadCount]);
};
