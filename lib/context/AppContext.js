import React, { createContext, useState, useRef, useEffect } from "react";
import { supabase } from "./../supabase";

export const AuthContext = createContext();

export const AppProvider = ({ children }) => {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const messageChannelRef = useRef(null);

  const getCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  };

  const loadUnreadMessagesCount = async () => {
    const userId = await getCurrentUser();
    if (!userId) return;

    // Obtener todos los chats donde participa el usuario
    const { data: chatsData, error: chatsError } = await supabase
      .from("chats")
      .select("id")
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

    if (chatsError || !chatsData) return;

    const chatIds = chatsData.map((c) => c.id);
    if (chatIds.length === 0) {
      setUnreadMessagesCount(0);
      return;
    }

    // Contar mensajes no leídos de todos esos chats en una sola consulta
    const { count, error } = await supabase
      .from("mensajes")
      .select("*", { count: "exact", head: true })
      .in("chat_id", chatIds)
      .eq("leido", false)
      .neq("remitente_id", userId);

    if (!error) setUnreadMessagesCount(count || 0);
  };

  // Inicializa realtime listener una vez al montar
  useEffect(() => {
    let isMounted = true;

    const setupRealtime = async () => {
      await loadUnreadMessagesCount();

      const userId = await getCurrentUser();
      if (!userId) return;

      // Limpia cualquier suscripción previa
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
      }

      // Escucha cambios en la tabla notificaciones para este usuario
      const channelMessage = supabase
        .channel("public:mensajes")
        .on(
          "postgres_changes",
          {
            event: "*", // puedes filtrar por 'INSERT' y 'UPDATE' si no necesitas DELETE
            schema: "public",
            table: "mensajes",
          },
          () => {
            if (isMounted) {
              void loadUnreadMessagesCount();
            }
          },
        )
        .subscribe();

      messageChannelRef.current = channelMessage;
    };

    void setupRealtime();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return;
      setUnreadMessagesCount(0);
      setTimeout(() => {
        if (isMounted) void setupRealtime();
      }, 0);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();

      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        unreadMessagesCount,
        loadUnreadMessages: loadUnreadMessagesCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
