import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CURRENT_LEGAL_DOCUMENT_SET } from "../lib/constants/legal";
import { supabase } from "../lib/supabase";
import { getUserID } from "../store/authStore";
import type { MainStackParamList } from "../types/navigation";

export default function InicioRouter() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verificarRuta = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const userId = getUserID();
      if (!userId) {
        throw new Error("No encontramos una sesión activa.");
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select("perfil_completo, rol")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data?.rol === "guest") {
        navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        return;
      }

      if (!data?.perfil_completo) {
        navigation.reset({
          index: 0,
          routes: [{ name: "SeleccionRol" }],
        });
        return;
      }

      const { data: acceptance, error: acceptanceError } = await supabase
        .from("user_legal_acceptances")
        .select("id")
        .eq("user_id", userId)
        .eq("document_set", CURRENT_LEGAL_DOCUMENT_SET)
        .maybeSingle();

      if (acceptanceError) throw acceptanceError;

      navigation.reset({
        index: 0,
        routes: [{ name: acceptance?.id ? "Home" : "LegalAcceptance" }],
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos cargar tu perfil.",
      );
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    void verificarRuta();
  }, [verificarRuta]);

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#069eb3" />
          <Text style={styles.message}>Cargando tu cuenta…</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>No pudimos abrir tu cuenta</Text>
          <Text style={styles.message}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={verificarRuta}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f0fafa",
  },
  title: {
    color: "#174f59",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: "#52666a",
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: "#069eb3",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
