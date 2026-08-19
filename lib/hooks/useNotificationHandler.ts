import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import type { MainStackParamList } from "../../types/navigation";

// Mostrar notificaciones incluso con la app en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const useNotificationHandler = () => {
  const navigationRef =
    useRef<NavigationContainerRef<MainStackParamList>>(null);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      const screen = data?.screen;
      const params = data?.params;

      if (!navigationRef.current?.isReady() || typeof screen !== "string") {
        return;
      }

      if (screen === "ChatIndividual") {
        const chatParams = params as MainStackParamList["ChatIndividual"] | undefined;
        if (chatParams?.chatId && chatParams?.usuarioId1 && chatParams?.usuarioId2) {
          navigationRef.current.navigate("ChatIndividual", {
            chatId: chatParams.chatId,
            nombre: chatParams.nombre ?? "Chat",
            servicio: chatParams.servicio ?? {},
            servicioId: chatParams.servicioId ?? "",
            usuarioId1: chatParams.usuarioId1,
            usuarioId2: chatParams.usuarioId2,
          });
        }
        return;
      }

      const navigate = navigationRef.current.navigate as unknown as (
        routeName: keyof MainStackParamList,
        routeParams?: unknown,
      ) => void;
      navigate(screen as keyof MainStackParamList, params);
    },
    [],
  );

  const handleInitialNotification = useCallback(async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) handleNotificationResponse(response);
  }, [handleNotificationResponse]);

  // Setup ongoing notification listener
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  return {
    navigationRef,
    handleInitialNotification,
  };
};
