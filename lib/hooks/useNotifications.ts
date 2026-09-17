import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
// hooks/useNotifications.ts
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { getUserID } from "../../store/authStore";
import { supabase } from "../supabase";
import {
  URGENT_WORK_CHANNEL_ID,
  URGENT_WORK_SOUND,
} from "../utils/urgentWorkNotification";
import { useNotificationsCount } from "./useNotificationsCount";

export const useNotifications = () => {
  useNotificationsCount();
  const queryClient = useQueryClient();
  const [expoPushToken, setExpoPushToken] = useState<string>("");
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTokenToSupabase = useCallback(async (token: string) => {
    try {
      const userId = getUserID();

      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ expo_token: token })
        .eq("id", userId);

      if (updateError) {
        console.error("Error saving push token:", updateError);
        setError("Failed to save notification settings");
      }
    } catch (err) {
      console.error("Unexpected error saving token:", err);
      setError("Failed to save notification settings");
    }
  }, []);

  const registerForPushNotificationsAsync = useCallback(async (): Promise<
    string | null
  > => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if device supports notifications
      if (!Device.isDevice) {
        Alert.alert(
          "Dispositivo no compatible",
          "Las notificaciones push solo están disponibles en dispositivos físicos",
        );
        return null;
      }

      // Setup Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });

        await Notifications.setNotificationChannelAsync(
          URGENT_WORK_CHANNEL_ID,
          {
            name: "Trabajos urgentes",
            importance: Notifications.AndroidImportance.MAX,
            sound: URGENT_WORK_SOUND,
            vibrationPattern: [0, 900, 250, 900, 250, 1200, 350, 1200],
            lightColor: "#FF3B30",
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
          },
        );
      }

      // Check/request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Permiso requerido",
          "Las notificaciones push están deshabilitadas. Por favor, actívalas en la configuración de tu dispositivo para recibir actualizaciones.",
          [{ text: "OK" }],
        );
        return null;
      }

      // Get project ID
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        throw new Error("Project ID not found in app configuration");
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      if (!token) {
        throw new Error("Failed to get push token");
      }

      return token;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Push notification registration failed:", errorMessage);
      setError(`Failed to register for notifications: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeNotifications = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();

    if (token) {
      setExpoPushToken(token);
      await saveTokenToSupabase(token);
    }
  }, [registerForPushNotificationsAsync, saveTokenToSupabase]);

  useEffect(() => {
    // Initialize notifications
    initializeNotifications();

    // Setup listeners
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
        console.log("Notification received:", {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
        });
      },
    );

    // Cleanup function
    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
    };
  }, [initializeNotifications]);

  // Public API for re-registering notifications (useful for settings screens)
  const refreshNotificationToken = useCallback(async () => {
    await initializeNotifications();
  }, [initializeNotifications]);

  return {
    expoPushToken,
    notification,
    isLoading,
    error,
    refreshNotificationToken,
  };
};
