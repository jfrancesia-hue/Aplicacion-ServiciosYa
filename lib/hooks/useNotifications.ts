import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { getUserID } from "../../store/authStore";
import { supabase } from "../supabase";
import {
  URGENT_WORK_CHANNEL_ID,
  URGENT_WORK_SOUND,
} from "../utils/urgentWorkNotification";
import { useNotificationsCount } from "./useNotificationsCount";

async function configureAndroidNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Notificaciones",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
  await Notifications.setNotificationChannelAsync(URGENT_WORK_CHANNEL_ID, {
    name: "Trabajos urgentes",
    importance: Notifications.AndroidImportance.MAX,
    sound: URGENT_WORK_SOUND,
    vibrationPattern: [0, 900, 250, 900, 250, 1200, 350, 1200],
    lightColor: "#FF3B30",
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function registerPushToken(requestPermission: boolean) {
  if (!Device.isDevice) {
    if (requestPermission) {
      throw new Error(
        "Las notificaciones push s\u00f3lo est\u00e1n disponibles en dispositivos f\u00edsicos.",
      );
    }
    return null;
  }

  await configureAndroidNotificationChannels();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus === "granted"
      ? existingStatus
      : requestPermission
        ? (await Notifications.requestPermissionsAsync()).status
        : existingStatus;

  if (finalStatus !== "granted") {
    if (requestPermission) {
      throw new Error(
        "No habilitaste las notificaciones. Pod\u00e9s activarlas desde los ajustes de Android.",
      );
    }
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("La aplicaci\u00f3n no tiene configurado el identificador de Expo.");
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!token) throw new Error("No se pudo obtener el token de notificaciones.");

  const userId = getUserID();
  if (!userId) throw new Error("Necesit\u00e1s iniciar sesi\u00f3n nuevamente.");
  const { error } = await supabase
    .from("usuarios")
    .update({ expo_token: token })
    .eq("id", userId);
  if (error) throw new Error("No se pudo guardar el permiso de notificaciones.");

  return token;
}

export async function requestPushNotificationPermission() {
  return registerPushToken(true);
}

export const useNotifications = () => {
  useNotificationsCount();
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeNotifications = useCallback(
    async (requestPermission = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await registerPushToken(requestPermission);
        if (token) setExpoPushToken(token);
        return token;
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "No se pudieron configurar las notificaciones.";
        setError(message);
        if (requestPermission) throw new Error(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Si el permiso ya existe, renovamos el token. El pedido de permiso queda
    // reservado para la acci\u00f3n expl\u00edcita del usuario en Configuraci\u00f3n.
    void initializeNotifications(false);

    const notificationListener = Notifications.addNotificationReceivedListener(
      (receivedNotification) => setNotification(receivedNotification),
    );
    return () => notificationListener.remove();
  }, [initializeNotifications]);

  const refreshNotificationToken = useCallback(
    () => initializeNotifications(true),
    [initializeNotifications],
  );

  return {
    expoPushToken,
    notification,
    isLoading,
    error,
    refreshNotificationToken,
  };
};
