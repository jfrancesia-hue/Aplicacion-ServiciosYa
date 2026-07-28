import { queryOptions } from "@tanstack/react-query";
import { getUserID } from "../../store/authStore";
import { supabase } from "../supabase";
import type { ServicioRow } from "../../types/db.overrides.types";
import { getChatMessagePreview } from "./audioMessage";
import { getMicaSystemMessagePreview } from "./micaMessage";
import { getBlockedUserIds } from "./trustSafety";

export interface ChatItem {
  id: string;
  avatar?: string;
  title: string;
  mensaje: string;
  date?: string;
  noLeidos: number;
  usuario_1: string;
  usuario_2: string;
  servicio: Partial<ServicioRow>;
}

function getPartner(
  user_1: string | null,
  user_2: string | null,
  userId: string,
) {
  return user_1 === userId ? user_2 : user_1;
}

async function fetchUserChats() {
  const userId = getUserID();
  const blockedIds = await getBlockedUserIds();

  type ChatWithSummary = {
    id: string;
    participant_a: string | null;
    participant_b: string | null;
    updated_at: string | null;
    latest: Array<{
      contenido: string | null;
      created_at: string | null;
      leido: boolean | null;
      remitente_id: string | null;
    }>;
    unread: Array<{ count: number }>;
  };

  // PostgREST resuelve el último mensaje y los no leídos sin descargar
  // historiales completos en el teléfono.
  const { data: rawChats } = await supabase
    .from("chats")
    .select(`
      id,
      participant_a,
      participant_b,
      updated_at,
      latest:mensajes(contenido, created_at, leido, remitente_id),
      unread:mensajes(count)
    `)
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", {
      referencedTable: "latest",
      ascending: false,
    })
    .limit(1, { referencedTable: "latest" })
    .eq("unread.leido", false)
    .neq("unread.remitente_id", userId)
    .limit(60)
    .throwOnError();

  const chatsData = (rawChats ?? []) as unknown as ChatWithSummary[];
  const visibleChats = chatsData.filter((chat) => {
    const partnerId = getPartner(
      chat.participant_a,
      chat.participant_b,
      userId,
    );
    return !partnerId || !blockedIds.has(partnerId);
  });
  if (visibleChats.length === 0) return [];

  const user_ids = visibleChats
    .map((chat) => getPartner(chat.participant_a, chat.participant_b, userId))
    .filter((id) => id !== null);

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nombre, foto_perfil")
    .in("id", user_ids);

  const chats: ChatItem[] = [];
  for (const chat of visibleChats) {
    const partnerID =
      getPartner(chat.participant_a, chat.participant_b, userId) ?? "";
    const user = (usuarios ?? []).find((item) => item.id === partnerID);
    if (!user) {
      console.warn("[fetchUserChats] partner no encontrado en `usuarios`:", {
        chatId: chat.id,
        partnerID,
      });
    }

    const lastMsg = chat.latest?.[0];
    const noLeidos = Number(chat.unread?.[0]?.count ?? 0);

    chats.push({
      id: chat.id,
      avatar: user?.foto_perfil ?? "https://picsum.photos/id/9/200/300",
      title: user?.nombre ?? "Usuario",
      noLeidos,
      mensaje:
        getMicaSystemMessagePreview(lastMsg?.contenido) ??
        getChatMessagePreview(lastMsg?.contenido),
      usuario_1: chat.participant_a ?? "",
      usuario_2: chat.participant_b ?? "",
      servicio: {},
    });
  }

  return chats.sort((left, right) => {
    const leftChat = chatsData.find((chat) => chat.id === left.id);
    const rightChat = chatsData.find((chat) => chat.id === right.id);
    const leftDate =
      leftChat?.latest?.[0]?.created_at ?? leftChat?.updated_at ?? "";
    const rightDate =
      rightChat?.latest?.[0]?.created_at ?? rightChat?.updated_at ?? "";
    return rightDate.localeCompare(leftDate);
  });
}

export const fetchUserChatQueryOptions = queryOptions({
  queryKey: ["user", "chats"],
  queryFn: fetchUserChats,
  structuralSharing: true,
});
