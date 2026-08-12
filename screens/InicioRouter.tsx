import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { CURRENT_LEGAL_DOCUMENT_SET } from "../lib/constants/legal";
import { supabase } from "../lib/supabase";
import { getUserID } from "../store/authStore";
import type { MainStackParamList } from "../types/navigation";

export default function InicioRouter() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [loading] = useState(true);

  useEffect(() => {
    const verificarRuta = async () => {
      const userId = getUserID();

      if (!userId) {
        navigation.reset({
          index: 0,
          routes: [{ name: "RegistroTrabajador" }],
        });
        return;
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select("perfil_completo")
        .eq("id", userId)
        .single();

      let hasCurrentLegalAcceptance = false;
      if (!error && data?.perfil_completo) {
        const { data: acceptance } = await supabase
          .from("user_legal_acceptances")
          .select("id")
          .eq("user_id", userId)
          .eq("document_set", CURRENT_LEGAL_DOCUMENT_SET)
          .maybeSingle();
        hasCurrentLegalAcceptance = Boolean(acceptance?.id);
      }

      const routeName =
        !error && data?.perfil_completo
          ? hasCurrentLegalAcceptance
            ? "Home"
            : "LegalAcceptance"
          : "RegistroTrabajador";

      navigation.reset({
        index: 0,
        routes: [
          {
            name: routeName,
          },
        ],
      });
    };

    verificarRuta();
  }, [navigation]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {loading ? <ActivityIndicator size="large" color="#FFA13C" /> : null}
    </View>
  );
}
