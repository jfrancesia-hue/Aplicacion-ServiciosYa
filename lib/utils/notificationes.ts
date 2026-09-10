import { getUserID } from "../../store/authStore";
import { supabase } from "../supabase";

export async function fetchUserNotifications() {
  const userId = getUserID();
  const { data } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("receptor_id", userId)
    .order("created_at", { ascending: false })
    .throwOnError();

  if (data.length === 0) return [];

  const userIds = data.map((n) => n.emisor_id).filter((id) => id !== null);

  const { data: users } = await supabase
    .from("user_public_profiles")
    .select("id, foto_perfil")
    .in("id", userIds)
    .throwOnError();

  return data.map((n) => {
    const user = users.find((u) => u.id === n.emisor_id);
    return {
      ...n,
      foto_perfil: user?.foto_perfil ?? "https://picsum.photos/id/9/200/300",
    };
  });
}

export const userNotificationsQueryOptions = {
  queryKey: ["user", "notifications"],
  queryFn: fetchUserNotifications,
};
