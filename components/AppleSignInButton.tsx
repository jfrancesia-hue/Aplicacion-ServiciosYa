import React from "react";
import { Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../lib/supabase";
import vexo from "../lib/vexo";

export default function AppleSignInButton() {
  const [loading, setLoading] = React.useState(false);

  const handleAppleLogin = async () => {
    if (loading) return;

    if (Platform.OS !== "ios") {
      Alert.alert("Disponible solo en iOS");
      return;
    }

    try {
      setLoading(true);

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!appleCredential.identityToken) {
        Alert.alert("Error", "No se obtuvo token de Apple.");
        return;
      }

      // Iniciar sesión con el token de Apple
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: appleCredential.identityToken,
      });

      if (error) {
        console.log("Error Supabase:", error.message);
        Alert.alert("Error", error.message);
        return;
      }

      // Verificar si el usuario ya existe en la tabla "usuarios"
      const userId = data.user?.id;
      const userEmail = data.user?.email;

      if (!userId || !userEmail) {
        Alert.alert("Error", "No se pudo obtener información del usuario.");
        return;
      }

      const { data: existingUser, error: fetchError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("id", userId)
        .single();

      console.log('existingUser ', existingUser);

      // Si no se encuentra, insertarlo
      if (existingUser == null) {
        console.log('registrar usuario ');
        const { error: insertError } = await supabase
          .from("usuarios")
          .insert([{ id: userId, email: userEmail }]);

        if (insertError) {
          console.error("Error insertando nuevo usuario:", insertError);
          Alert.alert("Error", "No se pudo registrar el usuario.");
          return;
        }
      }

      vexo.login("apple");

      Alert.alert("¡Sesión iniciada con Apple!");

    } catch (error: unknown) {
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (errorCode === "ERR_CANCELED") {
        Alert.alert("Cancelado por el usuario");
      } else {
        console.error("Apple login error", error);
        Alert.alert("Error", "No se pudo iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={30}
      style={{ width: "100%", height: 55, paddingVertical: 15, borderRadius: 30 }}
      onPress={handleAppleLogin}
    />
  );
}
