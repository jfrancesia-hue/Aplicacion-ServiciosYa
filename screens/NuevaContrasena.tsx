import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../types/navigation";


type Props = NativeStackScreenProps<AuthStackParamList, "Nueva contraseña">;

export default function NuevaContrasena({ navigation }: Props) {
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    if (!contrasena || contrasena.length < 12) {
      Alert.alert("Contraseña inválida", "Usá mínimo 12 caracteres.");
      return;
    }
    if (contrasena !== confirmacion) {
      Alert.alert("No coincide", "La confirmación no coincide.");
      return;
    }

    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: contrasena });
    setCargando(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Listo", "Tu contraseña fue actualizada.", [
  {
    text: "Aceptar",
    onPress: async () => {
      await supabase.auth.signOut();
      navigation.replace("Login");
    },
  },
]);

  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Nueva contraseña</Text>

      <TextInput
        placeholder="Nueva contraseña"
        secureTextEntry
        value={contrasena}
        onChangeText={setContrasena}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 12,
          borderRadius: 10,
        }}
      />

      <TextInput
        placeholder="Confirmar contraseña"
        secureTextEntry
        value={confirmacion}
        onChangeText={setConfirmacion}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 12,
          borderRadius: 10,
        }}
      />

      <TouchableOpacity
        onPress={guardar}
        disabled={cargando}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          opacity: cargando ? 0.6 : 1,
          backgroundColor: "#16C2B8",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {cargando ? "Guardando..." : "Guardar contraseña"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
