// src/hooks/useHomeData.js
import { useState, useEffect } from "react";
import { Alert, BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { perfilQueryOptions, servicesCountQuerKey } from "../queryOptions";
import queryClient from "../reactQuery";
import { hasProviderCapability } from "../utils/user";

interface UserData {
  rol: string;
  provider_enabled: boolean;
  perfilCompleto: boolean;
  notificacionesNoLeidas: number;
  foto_perfil: string | null;
}

export const useHomeData = () => {
  const [conteosPorCategoria, setConteosPorCategoria] = useState({});
  const [askDniVerification, setAskDniVerification] = useState(false);
  const [askProfileCompletion, setAskProfileCompletion] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: userData,
    isLoading: profileLoading,
    isError: profileIsError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery(perfilQueryOptions);
  const isProvider = hasProviderCapability(userData);

  const onRefresh = async () => {
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: servicesCountQuerKey });
    setRefreshing(false);
  };

  // Handle Back Button to exit app
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        Alert.alert("Confirmación", "¿Deseas salir de la app?", [
          { text: "Cancelar", style: "cancel", onPress: () => null },
          { text: "Salir", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    if (userData) {
      let { perfil_completo, dni_verificado } = userData;
      perfil_completo = perfil_completo ?? false;
      dni_verificado = dni_verificado ?? false;

      setAskDniVerification(isProvider && perfil_completo && !dni_verificado);
      setAskProfileCompletion(!perfil_completo);
    }
  }, [isProvider, userData]);

  return {
    ...userData,
    isProvider,
    askDniVerification,
    askProfileCompletion,
    profileLoading,
    profileIsError,
    profileError,
    refetchProfile,
    conteosPorCategoria,
    refreshing,
    onRefresh,
  };
};
