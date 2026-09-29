import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { fetchUserChatQueryOptions } from "../utils/chat";
import { userNotificationsQueryOptions } from "../utils/notificationes";

export default function usePrefetchData() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      Promise.all([
        queryClient.prefetchQuery({
          ...fetchUserChatQueryOptions(userId),
          staleTime: 1000 * 60,
        }),
        queryClient.prefetchQuery({
          ...userNotificationsQueryOptions,
          staleTime: 1000 * 60,
        }),
      ]);
    }, 2000); // 2000 milliseconds = 2 seconds
    return () => clearTimeout(timer);
  }, [queryClient, userId]);
}
