// navigation.ts
import type { LinkingOptions } from "@react-navigation/native";
import type { AuthStackParamList, MainStackParamList } from "../../types/navigation";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";

export const navegationLinkin: LinkingOptions<MainStackParamList | AuthStackParamList> = {
  // This is the prefix for your deep links, e.g., myapp://
  prefixes: ["solucionesya://", Linking.createURL("/"), "https://inicio.serviciosya.info"],
  config: {
    screens: {
      NotificacionesScreen: "NotificacionesScreen",
      Perfil: "completar-perfil",
      Register: "invite/:referralCode",
      "Nueva contraseña": "reset-password",

    },
  },
  //   async getInitialURL() {
  //     // First, you may want to do the default deep link handling
  //     // Check if app was opened from a deep link
  //     const url = await Linking.getInitialURL();

  //     if (url != null) {
  //       return url;
  //     }

  //     // Handle URL from expo push notifications
  //     const response = await Notifications.getLastNotificationResponseAsync();
  //     const data = response?.notification.request.content.data;

  //     if (data?.screen) {
  //       // Create a URL from the notification data
  //       // e.g., "service/uuid-123" -> becomes "myapp://service/uuid-123"
  //       const url = Linking.createURL(`${data.screen}`, {
  //         queryParams: data?.params,
  //       });
  //       // Use Expo's Linking to navigate
  //       return url;
  //     }
  //   },
  async getInitialURL() {
    return Linking.getInitialURL();
  },
};
