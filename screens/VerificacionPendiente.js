import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function VerificacionPendiente({ navigation, route }) {
  const [cargando, setCargando] = useState(false);
  const email = route.params?.email?.trim().toLowerCase();

  const reenviarCorreoConfirmacion = async () => {
    if (!email || cargando) return;

    setCargando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;
      Alert.alert(
        "Correo reenviado",
        "Te enviamos un nuevo enlace de verificación.",
      );
    } catch (error) {
      console.error("Error al reenviar la confirmación:", error);
      Alert.alert(
        "No se pudo reenviar",
        "Esperá unos minutos y volvé a intentarlo.",
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificá tu correo</Text>
      <Text style={styles.text}>
        Te enviamos un enlace de verificación a {email}. Después de confirmarlo,
        volvé a iniciar sesión.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace("Login")}
      >
        <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.reenviarButton, cargando && styles.disabledButton]}
        onPress={reenviarCorreoConfirmacion}
        disabled={cargando || !email}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.reenviarButtonText}>
            Reenviar correo de verificación
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 15,
    textAlign: "center",
  },
  text: {
    fontSize: 16,
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#069eb3",
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginBottom: 15,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  reenviarButton: {
    backgroundColor: "#ff9900",
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 25,
    marginTop: 5,
    minWidth: 260,
    alignItems: "center",
  },
  reenviarButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
