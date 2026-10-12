import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function SeleccionRol() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <ImageBackground
      source={require("../assets/fondoRegister.png")} // Asegurate de tener esta imagen
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>¿Cómo querés empezar?</Text>
        <Text style={styles.subtitle}>
          Elegí qué querés hacer primero. Después vas a poder contratar y
          ofrecer servicios desde la misma cuenta.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.botonCliente]}
          onPress={() => navigation.navigate("RegistroCliente")}
        >
          <Text style={styles.buttonText}>Necesito contratar un servicio</Text>
          <Text style={styles.buttonHint}>Buscar o publicar un trabajo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.botonTrabajador]}
          onPress={() => navigation.navigate("RegistroTrabajador")}
        >
          <Text style={styles.buttonText}>Quiero ofrecer mis servicios</Text>
          <Text style={styles.buttonHint}>Crear mi perfil profesional</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.7)", // capa semitransparente
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    color: "#4A7C84",
    marginBottom: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 330,
    color: "#52666a",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 26,
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    marginVertical: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  botonCliente: {
    backgroundColor: "#19D4C6",
  },
  botonTrabajador: {
    backgroundColor: "#FaaB35",
  },
  buttonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "800",
  },
  buttonHint: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
});
