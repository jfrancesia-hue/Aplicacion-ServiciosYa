import type { Session } from "@supabase/supabase-js";
import {
  type QueryClient,
  focusManager,
  useQuery,
} from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
// app/hooks/useAuth.ts
import { useCallback, useEffect } from "react";
import { Alert, AppState, type AppStateStatus, Platform } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { registrarTokenPush } from "../notificaciones";
import { sessionQueryOptions } from "../queryOptions";
import { lastUserId } from "../storage";
import { supabase } from "../supabase";
import { clearSettingsToStorage, queryKey } from "./useUserSettings";

// Prevenir que la pantalla de inicio se oculte automáticamente antes de que estemos listos
SplashScreen.preventAutoHideAsync();

// Definir y exportar la clave de consulta para consistencia en toda la aplicación
export const sessionQueryKey = ["session"];

/**
 * Un hook para inicializar y gestionar la sesión del usuario.
 * Está diseñado para llamarse una vez en el componente raíz (ej. App.tsx),
 * pasando la instancia de queryClient directamente.
 *
 * @param queryClient - La instancia del cliente TanStack Query.
 */
export function useAuth(queryClient: QueryClient) {
  const { isAuth, isInitialized, initialize, session } = useAuthStore();

  useEffect(() => {
    const bootstrap = async () => {
      // Initialize auth (loads cache synchronously, verifies in background)
      await initialize();

      // Hide splash - auth is ready (either from cache or fresh)
      await SplashScreen.hideAsync();
    };

    bootstrap();

    return () => {
      useAuthStore.getState().cleanup();
    };
  }, []);

  const handleDeepLink = useCallback(async (event: { url: string }) => {
    const { url } = event;
    const fragment = url.split("#")[1];
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      // `setSession` activará el listener `onAuthStateChange` abajo,
      // que luego actualizará la caché de TanStack Query.
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("Error de sesión URL:", error.message);
        Alert.alert(
          "Error de inicio de sesión",
          "No se pudo procesar la redirección de login",
        );
      }
    } else {
      const errorDescription = params.get("error_description");
      if (errorDescription) Alert.alert("Error OAuth", errorDescription);
    }
  }, []);

  // Configurar listeners para el estado de autenticación y deep linking
  useEffect(() => {
    // 1. Comprobación inicial de deep link para cuando la app se inicia desde una URL
    // Some legacy user queries do not include the user id in their key. Track
    // which identity owns the current cache so another account can never reuse
    // a previous account's profile, role or private data.
    let queryCacheUserId =
      queryClient.getQueryData<Session | null>(sessionQueryKey)?.user.id ??
      useAuthStore.getState().session?.user.id ??
      null;

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // 2. Listener de cambios de estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const nextUserId = newSession?.user.id ?? null;

      if (queryCacheUserId !== nextUserId) {
        queryClient.clear();
      }

      // Actualizar manualmente la caché de consultas cuando cambia el estado de autenticación.
      // Este es el modelo "push" que mantiene nuestros datos actualizados.
      queryClient.setQueryData(sessionQueryKey, newSession);
      queryCacheUserId = nextUserId;
      if (_event === "SIGNED_IN" && newSession)
        onSignedIn(newSession, queryClient);
    });

    // 3. Listener de deep link para cuando la app ya está en ejecución
    const linkingSubscription = Linking.addEventListener("url", handleDeepLink);

    // 4. Función de limpieza
    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
    // Las dependencias son estables, por lo que este efecto se ejecuta solo una vez.
  }, [queryClient, handleDeepLink]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Limpieza al desmontar
    return () => {
      subscription.remove();
    };
  }, []);

  // Manejar cambio de usuario y limpieza de almacenamiento
  useEffect(() => {
    const handleUserChange = async () => {
      if (!session?.user) return;

      try {
        const storedUserId = await lastUserId.get();
        const currentUserId = session.user.id;

        if (storedUserId && storedUserId !== currentUserId) {
          // Limpiar almacenamiento específico del usuario cuando inicia sesión un usuario diferente
          await clearSettingsToStorage(); // Reemplazar con tu clave
          queryClient.invalidateQueries({
            queryKey: queryKey,
          });
        }

        // Actualizar el último ID de usuario en el almacenamiento
        await lastUserId.set(currentUserId);
      } catch (error) {
        console.error("Error al manejar cambio de usuario:", error);
      }
    };

    handleUserChange();
  }, [session?.user?.id, queryClient]); // Solo se ejecuta cuando cambia el ID de usuario

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => subscription.remove();
  }, []);

  return {
    session,
    isInitialized,
    isAuth,
  };
}

function onSignedIn(session: Session, client: QueryClient) {
  registrarTokenPush();
}

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}
