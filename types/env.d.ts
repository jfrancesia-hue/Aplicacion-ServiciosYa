declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL: string;
      EXPO_PUBLIC_API_IP_LOCATION_KEY: string;
      EXPO_PUBLIC_SERVICIOSYA_SYNC_BASE_URL?: string;
      EXPO_PUBLIC_SERVICIOSYA_APP_SYNC_TOKEN?: string;
      EXPO_PUBLIC_SERVICIOSYA_APP_API_BASE_URL?: string;
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
      // Add other environment variables here
    }
  }
}

declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.jpg" {
  const value: number;
  export default value;
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}

declare module "react-native-vector-icons/MaterialIcons" {
  import type { ComponentType } from "react";
  import type { TextProps } from "react-native";

  const MaterialIcons: ComponentType<
    TextProps & { name: string; size?: number; color?: string }
  >;
  export default MaterialIcons;
}
