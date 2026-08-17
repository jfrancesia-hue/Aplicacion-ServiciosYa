// src/hooks/useHomeData.js
import { useState, useEffect } from "react";
import { Alert, BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  perfilQueryOptions,
  servicesCountQuerKey,
} from "../queryOptions";
import queryClient from "../reactQuery";
import { getProviderProfileCompleteness } from "../utils/providerProfile";

interface UserData {
  rol: string;
  perfilCompleto: boolean;
  notificacionesNoLeidas: number;
  foto_perfil: string | null;
}

export const useHomeData = () => {
  const [conteosPorCategoria, setConteosPorCategoria] = useState({});
  const [askDniVerification, setAskDniVerification] = useState(false);
  const [askProfileCompletion, setAskProfileCompletion] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: userData } = useQuery(perfilQueryOptions);
  const profileCompleteness = getProviderProfileCompleteness(userData);
  const askProviderProfileCompletion =
    userData?.rol === "worker" && profileCompleteness.score < 100;

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

      setAskDniVerification(perfil_completo && !dni_verificado);
      setAskProfileCompletion(!perfil_completo);
    }
  }, [userData]);

  return {
    ...userData,
    askDniVerification,
    askProfileCompletion,
    askProviderProfileCompletion,
    providerProfileScore: profileCompleteness.score,
    providerMissingFields: profileCompleteness.missingLabels,
    conteosPorCategoria,
    refreshing,
    onRefresh,
  };
};
